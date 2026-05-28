'use strict';

const {
  getStripeClient,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL,
  STRIPE_CURRENCY,
  isStripeConfigured,
} = require('../config/stripe');
const {
  generateTxnRef,
  normalizeIp,
  normalizeOrderInfo,
  normalizeCurrency,
  isSupportedCurrency,
  normalizeAmountForCurrency,
  toStripeUnitAmount,
} = require('../helpers');
const vnpayStore = require('../stores/vnpayStore');
const stripeStore = require('../stores/stripeStore');
const momoStore = require('../stores/momoStore');
const paypalStore = require('../stores/paypalStore');

const PRODUCTS = {
  coffee: {
    name: 'Cà phê Việt Nam 500g',
    description: 'Sản phẩm sandbox',
    unitAmount: 50000,
  },
  tea: {
    name: 'Hộp quà trà sen',
    description: 'Sản phẩm sandbox',
    unitAmount: 120000,
  },
  handicraft: {
    name: 'Bộ đồ trang trí thủ công',
    description: 'Sản phẩm sandbox',
    unitAmount: 250000,
  },
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertStripeConfigured() {
  if (!isStripeConfigured()) {
    throw createHttpError(
      500,
      'Chưa cấu hình Stripe. Vui lòng thiết lập STRIPE_SECRET_KEY trong .env.'
    );
  }
}

function appendQueryParams(url, params) {
  const separator = url.includes('?') ? '&' : '?';
  const query = new URLSearchParams(params);
  return `${url}${separator}${query.toString()}`;
}

function getRawIp({ headers, socket, ip }) {
  return headers['x-forwarded-for'] || socket.remoteAddress || ip;
}

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function createOrderLineItem(order, currency) {
  const unitAmount = toStripeUnitAmount(order.amount, currency);

  if (unitAmount === null) {
    throw createHttpError(400, 'Số tiền không hợp lệ với đơn vị tiền tệ đã chọn.');
  }

  return {
    price_data: {
      currency,
      product_data: {
        name: `Đơn hàng ${order.txnRef}`,
        description: order.orderInfo || 'Thanh toán đơn hàng',
      },
      unit_amount: unitAmount,
    },
    quantity: 1,
  };
}

function createDraftOrder(body, txnRef, ipAddr) {
  const currency = normalizeCurrency(body.currency);
  const amount = normalizeAmountForCurrency(body.amount, currency);

  if (!isSupportedCurrency(currency) || amount === null) {
    return null;
  }

  return {
    txnRef: txnRef || generateTxnRef(),
    amount,
    currency,
    orderInfo: normalizeOrderInfo(body.orderInfo),
    orderType: (body.orderType || 'stripe').toString(),
    ipAddr,
  };
}

function createCartLineItems(items, currency) {
  return items
    .map((item) => {
      const product = PRODUCTS[item.productId];
      const quantity = toPositiveInteger(item.quantity);

      if (!product || !quantity || quantity > 20) {
        return null;
      }

      return {
        lineItem: {
          price_data: {
            currency,
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: product.unitAmount,
          },
          quantity,
        },
        snapshot: {
          productId: item.productId,
          name: product.name,
          unitAmount: product.unitAmount,
          quantity,
        },
      };
    })
    .filter(Boolean);
}

function getProducts() {
  return {
    currency: STRIPE_CURRENCY,
    products: PRODUCTS,
  };
}

async function findPaymentByRef(txnRef) {
  return stripeStore.findByRef(txnRef);
}

async function syncSessionStatus(session, event) {
  return stripeStore.updateAfterCheckout(session, event);
}

async function syncCheckoutSession(sessionId) {
  assertStripeConfigured();

  const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
  await syncSessionStatus(session, {
    id: `manual_sync:${session.id}`,
    type: 'checkout.session.sync',
    created: Math.floor(Date.now() / 1000),
  });

  return {
    txnRef: session.client_reference_id || session.metadata?.txnRef,
    sessionId: session.id,
    status: session.payment_status === 'paid' ? 'success' : 'failed',
    paymentStatus: session.payment_status,
  };
}

async function cancelCheckout({ sessionId, txnRef, draft }) {
  assertStripeConfigured();

  const now = Math.floor(Date.now() / 1000);

  if (sessionId) {
    const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
    await syncSessionStatus(session, {
      id: `manual_cancel:${session.id}`,
      type: 'checkout.session.cancelled',
      created: now,
    });

    return {
      txnRef: session.client_reference_id || session.metadata?.txnRef,
      sessionId: session.id,
      status: session.payment_status === 'paid' ? 'success' : 'failed',
      paymentStatus: session.payment_status,
    };
  }

  const finalTxnRef = (txnRef || draft?.txnRef || '').toString().trim();
  const currency = normalizeCurrency(draft?.currency || STRIPE_CURRENCY);
  const amount = toStripeUnitAmount(draft?.amount, currency);

  if (!finalTxnRef || !isSupportedCurrency(currency) || amount === null) {
    throw createHttpError(400, 'Thiếu dữ liệu hủy thanh toán hoặc dữ liệu không hợp lệ.');
  }

  await stripeStore.updateCheckoutCancelled({
    txnRef: finalTxnRef,
    amount,
    currency,
    orderInfo: normalizeOrderInfo(draft?.orderInfo || 'Thanh toán Stripe đã bị hủy'),
    ipAddr: draft?.ipAddr,
    event: {
      id: `manual_cancel:${finalTxnRef}`,
      type: 'checkout.session.cancelled',
      created: now,
    },
  });

  return {
    txnRef: finalTxnRef,
    status: 'failed',
    paymentStatus: 'cancelled',
  };
}

async function createCheckoutSession({ body, headers, socket, ip }) {
  assertStripeConfigured();

  let currency = normalizeCurrency(body.currency || STRIPE_CURRENCY);
  if (!isSupportedCurrency(currency)) {
    throw createHttpError(400, 'Đơn vị tiền tệ chỉ hỗ trợ VND hoặc USD.');
  }

  let txnRef = (body.txnRef || '').toString().trim();
  let stripeItems = [];
  let lineItems = [];
  let orderInfo = 'Thanh toán Stripe';
  let ipAddr = normalizeIp(getRawIp({ headers, socket, ip }));

  if (txnRef) {
    const order = (await vnpayStore.findByRef(txnRef)) || createDraftOrder(body, txnRef, ipAddr);

    if (!order) {
      throw createHttpError(400, 'Thiếu dữ liệu đơn hàng hoặc dữ liệu không hợp lệ.');
    }

    if (order.status === 'success') {
      throw createHttpError(409, 'Đơn hàng đã được thanh toán.');
    }

    const existingStripePayment = await stripeStore.findByRef(txnRef);
    if (existingStripePayment?.status === 'success') {
      throw createHttpError(409, 'Đơn hàng đã được thanh toán bằng Stripe.');
    }

    const [existingMomoPayment, existingPaypalPayment] = await Promise.all([
      momoStore.findByRef(txnRef),
      paypalStore.findByRef(txnRef),
    ]);

    if (existingMomoPayment?.status === 'success') {
      throw createHttpError(409, 'Đơn hàng đã được thanh toán bằng MoMo.');
    }

    if (existingPaypalPayment?.status === 'success') {
      throw createHttpError(409, 'Đơn hàng đã được thanh toán bằng PayPal.');
    }

    currency = normalizeCurrency(order.currency || currency);
    if (!isSupportedCurrency(currency)) {
      throw createHttpError(400, 'Đơn vị tiền tệ chỉ hỗ trợ VND hoặc USD.');
    }

    orderInfo = order.orderInfo || 'Thanh toán đơn hàng';
    ipAddr = order.ipAddr || ipAddr;
    lineItems = [createOrderLineItem(order, currency)];
    stripeItems = [
      {
        name: `Đơn hàng ${order.txnRef}`,
        amount: order.amount,
        quantity: 1,
        currency,
      },
    ];
  } else {
    const cartItems = Array.isArray(body.items) ? body.items : [];
    const parsedItems = createCartLineItems(cartItems, currency);

    if (parsedItems.length === 0) {
      throw createHttpError(400, 'Giỏ hàng không có sản phẩm hợp lệ.');
    }

    txnRef = generateTxnRef();
    lineItems = parsedItems.map((item) => item.lineItem);
    stripeItems = parsedItems.map((item) => item.snapshot);
    orderInfo = normalizeOrderInfo(body.orderInfo || 'Thanh toán Stripe');
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: lineItems,
    success_url: STRIPE_SUCCESS_URL,
    cancel_url: appendQueryParams(STRIPE_CANCEL_URL, { txnRef }),
    client_reference_id: txnRef,
    metadata: {
      txnRef,
      provider: 'stripe',
      currency,
      orderInfo,
      ipAddr,
    },
  });

  return {
    url: session.url,
    sessionId: session.id,
    txnRef,
  };
}

async function handleWebhook(rawBody, signature) {
  if (!isStripeConfigured()) {
    throw createHttpError(500, 'Chưa cấu hình Stripe.');
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    throw createHttpError(500, 'Chưa cấu hình Stripe webhook secret.');
  }

  if (!signature) {
    throw createHttpError(400, 'Thiếu chữ ký Stripe.');
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    throw createHttpError(400, `Webhook Error: ${error.message}`);
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const session = event.data.object;
      await syncSessionStatus(session, event);
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      await stripeStore.updateCheckoutExpired(session, event);
    }
  } catch (error) {
    throw createHttpError(500, `Webhook handler failed: ${error.message}`);
  }

  return { received: true };
}

module.exports = {
  getProducts,
  findPaymentByRef,
  syncCheckoutSession,
  cancelCheckout,
  createCheckoutSession,
  handleWebhook,
};
