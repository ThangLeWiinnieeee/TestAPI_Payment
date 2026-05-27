'use strict';

const crypto = require('crypto');
const axios = require('axios');

const {
  MOMO_PARTNER_CODE,
  MOMO_ACCESS_KEY,
  MOMO_SECRET_KEY,
  MOMO_CREATE_URL,
  MOMO_REDIRECT_URL,
  MOMO_IPN_URL,
  MOMO_REQUEST_TYPE,
  MOMO_AUTO_CAPTURE,
  MOMO_LANG,
  isMomoConfigured,
} = require('../config/momo');
const {
  generateTxnRef,
  normalizeAmountForCurrency,
  normalizeCurrency,
  normalizeIp,
  normalizeOrderInfo,
} = require('../helpers');
const vnpayStore = require('../stores/vnpayStore');
const stripeStore = require('../stores/stripeStore');
const momoStore = require('../stores/momoStore');

const CREATE_SIGNATURE_KEYS = [
  'accessKey',
  'amount',
  'extraData',
  'ipnUrl',
  'orderId',
  'orderInfo',
  'partnerCode',
  'redirectUrl',
  'requestId',
  'requestType',
];

const RESULT_SIGNATURE_KEYS = [
  'accessKey',
  'amount',
  'extraData',
  'message',
  'orderId',
  'orderInfo',
  'orderType',
  'partnerCode',
  'payType',
  'requestId',
  'responseTime',
  'resultCode',
  'transId',
];

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertMomoConfigured() {
  if (!isMomoConfigured()) {
    throw createHttpError(
      500,
      'Chưa cấu hình MoMo. Vui lòng thiết lập MOMO_PARTNER_CODE, MOMO_ACCESS_KEY và MOMO_SECRET_KEY trong .env.'
    );
  }
}

function getRawIp({ headers, socket, ip }) {
  return headers?.['x-forwarded-for'] || socket?.remoteAddress || ip;
}

function valueOf(value) {
  return value === undefined || value === null ? '' : String(value);
}

function buildSignatureData(keys, data) {
  return keys.map((key) => `${key}=${valueOf(data[key])}`).join('&');
}

function signMomo(rawSignature) {
  return crypto
    .createHmac('sha256', MOMO_SECRET_KEY)
    .update(rawSignature)
    .digest('hex');
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(valueOf(left), 'utf8');
  const rightBuffer = Buffer.from(valueOf(right), 'utf8');

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function verifyMomoResult(payload) {
  const rawSignature = buildSignatureData(RESULT_SIGNATURE_KEYS, {
    accessKey: MOMO_ACCESS_KEY,
    ...payload,
  });
  const expectedSignature = signMomo(rawSignature);

  return Boolean(payload.signature) && safeCompare(payload.signature, expectedSignature);
}

async function assertOrderNotPaid(txnRef) {
  const [vnpayPayment, stripePayment, momoPayment] = await Promise.all([
    vnpayStore.findByRef(txnRef),
    stripeStore.findByRef(txnRef),
    momoStore.findByRef(txnRef),
  ]);

  if (vnpayPayment?.status === 'success') {
    throw createHttpError(409, 'Đơn hàng đã được thanh toán bằng VNPAY.');
  }

  if (stripePayment?.status === 'success') {
    throw createHttpError(409, 'Đơn hàng đã được thanh toán bằng Stripe.');
  }

  if (momoPayment?.status === 'success') {
    throw createHttpError(409, 'Đơn hàng đã được thanh toán bằng MoMo.');
  }
}

function createDraftOrder(body, ipAddr) {
  const currency = normalizeCurrency(body.currency);
  if (currency !== 'vnd') {
    throw createHttpError(400, 'MoMo chỉ hỗ trợ thanh toán bằng VND.');
  }

  const amount = normalizeAmountForCurrency(body.amount, 'vnd');
  if (amount === null) {
    throw createHttpError(400, 'Số tiền VND phải là số nguyên từ 1.000 trở lên.');
  }

  return {
    txnRef: (body.txnRef || '').toString().trim() || generateTxnRef(),
    amount,
    currency,
    orderInfo: normalizeOrderInfo(body.orderInfo || 'Thanh toán MoMo'),
    orderType: (body.orderType || 'momo').toString(),
    ipAddr,
  };
}

async function createPayment({ body, headers, socket, ip }) {
  assertMomoConfigured();

  const ipAddr = normalizeIp(getRawIp({ headers, socket, ip }));
  const order = createDraftOrder(body, ipAddr);
  await assertOrderNotPaid(order.txnRef);

  const amount = String(order.amount);
  const orderId = order.txnRef;
  const requestId = orderId;
  const extraData = '';
  const requestType = MOMO_REQUEST_TYPE;

  const signatureData = {
    accessKey: MOMO_ACCESS_KEY,
    amount,
    extraData,
    ipnUrl: MOMO_IPN_URL,
    orderId,
    orderInfo: order.orderInfo,
    partnerCode: MOMO_PARTNER_CODE,
    redirectUrl: MOMO_REDIRECT_URL,
    requestId,
    requestType,
  };
  const signature = signMomo(buildSignatureData(CREATE_SIGNATURE_KEYS, signatureData));

  const requestBody = {
    partnerCode: MOMO_PARTNER_CODE,
    partnerName: 'API_VNPAY sandbox',
    storeId: 'API_VNPAY',
    requestId,
    amount,
    orderId,
    orderInfo: order.orderInfo,
    redirectUrl: MOMO_REDIRECT_URL,
    ipnUrl: MOMO_IPN_URL,
    lang: MOMO_LANG,
    requestType,
    autoCapture: MOMO_AUTO_CAPTURE,
    extraData,
    signature,
  };

  const { data } = await axios.post(MOMO_CREATE_URL, requestBody, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  if (Number(data.resultCode) !== 0 || !data.payUrl) {
    throw createHttpError(502, data.message || 'Không thể tạo URL thanh toán MoMo.');
  }

  return {
    payUrl: data.payUrl,
    deeplink: data.deeplink,
    qrCodeUrl: data.qrCodeUrl,
    orderId,
    requestId,
    txnRef: order.txnRef,
  };
}

function getResultPayload(input) {
  return Object.fromEntries(
    Object.entries(input || {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  );
}

async function confirmIpn(body, reqInfo = {}) {
  assertMomoConfigured();

  const payload = getResultPayload(body);
  if (!payload.orderId) {
    throw createHttpError(400, 'Thiếu orderId từ MoMo.');
  }

  const verified = verifyMomoResult(payload);
  await momoStore.updateFromIpn(payload, {
    verified,
    ipAddr: normalizeIp(getRawIp(reqInfo)),
  });

  if (!verified) {
    throw createHttpError(400, 'Chữ ký MoMo IPN không hợp lệ.');
  }

  return {
    resultCode: 0,
    message: 'Received',
    orderId: payload.orderId,
  };
}

async function buildReturnRedirect(query, reqInfo = {}) {
  const payload = getResultPayload(query);
  const orderId = payload.orderId || 'unknown';
  const resultCode = valueOf(payload.resultCode || 'unknown');
  const amount = valueOf(payload.amount || 0);

  // Chỉ verify chữ ký nếu MoMo đã được cấu hình, còn không thì verified = false
  const verified = isMomoConfigured() && payload.orderId
    ? verifyMomoResult(payload)
    : false;
  const success = verified && resultCode === '0';

  if (payload.orderId) {
    try {
      await momoStore.updateFromReturn(payload, {
        verified,
        ipAddr: normalizeIp(getRawIp(reqInfo)),
      });
    } catch (error) {
      console.error('MoMo return store error:', error.message);
    }
  }

  const resultParams = new URLSearchParams({
    provider: 'momo',
    txnRef: orderId,
    orderId,
    responseCode: resultCode,
    resultCode,
    txnStatus: payload.message || resultCode,
    amount,
    verified: verified ? '1' : '0',
    success: success ? '1' : '0',
  });

  return `/payment-result.html?${resultParams.toString()}`;
}

async function findPaymentByRef(txnRef) {
  return momoStore.findByRef(txnRef);
}

module.exports = {
  createPayment,
  confirmIpn,
  buildReturnRedirect,
  findPaymentByRef,
};
