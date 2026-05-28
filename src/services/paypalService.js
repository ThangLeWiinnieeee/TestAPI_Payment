'use strict';

const axios = require('axios');

const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_ENV,
  PAYPAL_API_BASE,
  PAYPAL_CURRENCY,
  PAYPAL_BRAND_NAME,
  PAYPAL_RETURN_URL,
  PAYPAL_CANCEL_URL,
  isPaypalConfigured,
} = require('../config/paypal');
const {
  normalizeAmountForCurrency,
  normalizeCurrency,
  normalizeIp,
  normalizeOrderInfo,
  generateTxnRef,
} = require('../helpers');
const vnpayStore = require('../stores/vnpayStore');
const stripeStore = require('../stores/stripeStore');
const momoStore = require('../stores/momoStore');
const paypalStore = require('../stores/paypalStore');

let tokenCache = {
  accessToken: '',
  expiresAt: 0,
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertPaypalConfigured() {
  if (!isPaypalConfigured()) {
    throw createHttpError(
      500,
      'Chua cau hinh PayPal. Vui long thiet lap PAYPAL_CLIENT_ID va PAYPAL_CLIENT_SECRET trong .env.'
    );
  }
}

function getRawIp({ headers, socket, ip } = {}) {
  return headers?.['x-forwarded-for'] || socket?.remoteAddress || ip;
}

function assertPaypalCurrency(currency) {
  const normalizedCurrency = normalizeCurrency(currency || PAYPAL_CURRENCY);
  if (normalizedCurrency !== PAYPAL_CURRENCY) {
    throw createHttpError(
      400,
      `PayPal trong ung dung nay chi ho tro ${PAYPAL_CURRENCY.toUpperCase()}.`
    );
  }

  return normalizedCurrency;
}

function formatPaypalAmount(amount, currency) {
  const normalizedAmount = normalizeAmountForCurrency(amount, currency);
  if (normalizedAmount === null) {
    throw createHttpError(400, 'So tien khong hop le voi PayPal.');
  }

  return currency === 'vnd'
    ? String(normalizedAmount)
    : normalizedAmount.toFixed(2);
}

function createDraftOrder(body, ipAddr) {
  const currency = assertPaypalCurrency(body.currency);
  const amount = normalizeAmountForCurrency(body.amount, currency);

  if (amount === null) {
    throw createHttpError(400, 'So tien khong hop le voi PayPal.');
  }

  return {
    txnRef: (body.txnRef || '').toString().trim() || generateTxnRef(),
    amount,
    currency,
    orderInfo: normalizeOrderInfo(body.orderInfo || 'Thanh toan PayPal'),
    orderType: (body.orderType || 'paypal').toString(),
    ipAddr,
  };
}

async function assertOrderNotPaid(txnRef) {
  const [vnpayPayment, stripePayment, momoPayment, paypalPayment] = await Promise.all([
    vnpayStore.findByRef(txnRef),
    stripeStore.findByRef(txnRef),
    momoStore.findByRef(txnRef),
    paypalStore.findByRef(txnRef),
  ]);

  if (vnpayPayment?.status === 'success') {
    throw createHttpError(409, 'Don hang da duoc thanh toan bang VNPAY.');
  }

  if (stripePayment?.status === 'success') {
    throw createHttpError(409, 'Don hang da duoc thanh toan bang Stripe.');
  }

  if (momoPayment?.status === 'success') {
    throw createHttpError(409, 'Don hang da duoc thanh toan bang MoMo.');
  }

  if (paypalPayment?.status === 'success') {
    throw createHttpError(409, 'Don hang da duoc thanh toan bang PayPal.');
  }
}

async function getAccessToken() {
  assertPaypalConfigured();

  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60000) {
    return tokenCache.accessToken;
  }

  const auth = Buffer
    .from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)
    .toString('base64');

  const { data } = await axios.post(
    `${PAYPAL_API_BASE}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    }
  );

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + Math.max(0, Number(data.expires_in || 0) - 60) * 1000,
  };

  return tokenCache.accessToken;
}

async function paypalRequest(method, path, body) {
  const accessToken = await getAccessToken();

  try {
    const { data } = await axios({
      method,
      url: `${PAYPAL_API_BASE}${path}`,
      data: body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    return data;
  } catch (error) {
    const detail = error.response?.data?.message || error.response?.data?.name || error.message;
    throw createHttpError(error.response?.status || 502, `PayPal API error: ${detail}`);
  }
}

function getClientConfig() {
  return {
    configured: isPaypalConfigured(),
    clientId: isPaypalConfigured() ? PAYPAL_CLIENT_ID : '',
    currency: PAYPAL_CURRENCY,
    environment: PAYPAL_ENV,
  };
}

async function createOrder({ body, headers, socket, ip }) {
  assertPaypalConfigured();

  const ipAddr = normalizeIp(getRawIp({ headers, socket, ip }));
  const order = createDraftOrder(body, ipAddr);
  await assertOrderNotPaid(order.txnRef);

  const currencyCode = order.currency.toUpperCase();
  const value = formatPaypalAmount(order.amount, order.currency);
  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: order.txnRef,
        custom_id: order.txnRef,
        description: order.orderInfo,
        amount: {
          currency_code: currencyCode,
          value,
        },
      },
    ],
    application_context: {
      brand_name: PAYPAL_BRAND_NAME,
      landing_page: 'LOGIN',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
      return_url: PAYPAL_RETURN_URL,
      cancel_url: PAYPAL_CANCEL_URL,
    },
  };

  const paypalOrder = await paypalRequest('post', '/v2/checkout/orders', payload);

  return {
    id: paypalOrder.id,
    paypalOrderId: paypalOrder.id,
    txnRef: order.txnRef,
    currency: order.currency,
  };
}

async function captureOrder({ paypalOrderId, body, headers, socket, ip }) {
  assertPaypalConfigured();

  if (!paypalOrderId) {
    throw createHttpError(400, 'Thieu PayPal order id.');
  }

  const ipAddr = normalizeIp(getRawIp({ headers, socket, ip }));
  const paypalOrder = await paypalRequest(
    'post',
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {}
  );
  const payment = await paypalStore.updateAfterCapture(paypalOrder, {
    ipAddr,
    fallbackDraft: body?.draft || body,
  });

  return {
    txnRef: payment.txnRef,
    paypalOrderId: payment.paypalOrderId,
    captureId: payment.captureId,
    status: payment.status,
    paypalStatus: payment.paypalStatus,
    amount: payment.amount,
    currency: payment.currency,
  };
}

async function cancelOrder({ body, headers, socket, ip }) {
  const draft = body?.draft || {};
  const txnRef = (body?.txnRef || draft.txnRef || '').toString().trim();
  const currency = assertPaypalCurrency(draft.currency || PAYPAL_CURRENCY);
  const amount = normalizeAmountForCurrency(draft.amount, currency);

  if (!txnRef || amount === null) {
    throw createHttpError(400, 'Thieu du lieu huy thanh toan PayPal.');
  }

  const payment = await paypalStore.updateCancelled({
    txnRef,
    paypalOrderId: body?.paypalOrderId || body?.orderId,
    amount,
    currency,
    orderInfo: normalizeOrderInfo(draft.orderInfo || 'Thanh toan PayPal da bi huy'),
    ipAddr: normalizeIp(getRawIp({ headers, socket, ip })),
    rawEvent: {
      id: `manual_cancel:${txnRef}`,
      type: 'paypal.order.cancelled',
      created: Math.floor(Date.now() / 1000),
    },
  });

  return {
    txnRef: payment.txnRef,
    paypalOrderId: payment.paypalOrderId,
    status: payment.status,
    paypalStatus: payment.paypalStatus,
    amount: payment.amount,
    currency: payment.currency,
  };
}

async function findPaymentByRef(txnRef) {
  return paypalStore.findByRef(txnRef);
}

module.exports = {
  getClientConfig,
  createOrder,
  captureOrder,
  cancelOrder,
  findPaymentByRef,
};
