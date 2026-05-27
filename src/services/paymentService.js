'use strict';

const moment = require('moment');
const qs = require('qs');

const {
  VNP_TMNCODE,
  VNP_URL,
  VNP_RETURNURL,
  isConfigured,
} = require('../config');

const {
  normalizeIp,
  sortObject,
  signParams,
  generateTxnRef,
  normalizeOrderInfo,
  normalizeVnpayOrderInfo,
  normalizeCurrency,
  normalizeAmountForCurrency,
} = require('../helpers');

const vnpayStore = require('../stores/vnpayStore');

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getRawIp({ headers, socket, ip }) {
  return headers['x-forwarded-for'] || socket.remoteAddress || ip;
}

function verifyVnpayQuery(query) {
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = query;
  const params = sortObject(rest);
  const checkHash = signParams(params);
  const verified = Boolean(vnp_SecureHash) && checkHash === vnp_SecureHash;

  return { params, verified };
}

async function createPaymentUrl({ body, headers, socket, ip }) {
  if (!isConfigured()) {
    throw createHttpError(
      500,
      'Thiếu cấu hình VNPAY. Vui lòng thiết lập VNP_TMNCODE và VNP_HASH_SECRET trong .env.'
    );
  }

  const existingTxnRef = (body.txnRef || '').toString().trim();
  const existingOrder = existingTxnRef ? await vnpayStore.findByRef(existingTxnRef) : null;
  const currency = normalizeCurrency(existingOrder?.currency || body.currency);

  if (currency !== 'vnd') {
    throw createHttpError(400, 'VNPAY chỉ hỗ trợ thanh toán bằng VND.');
  }

  if (existingOrder?.status === 'success') {
    throw createHttpError(409, 'Đơn hàng này đã thanh toán thành công.');
  }

  const amountInput = normalizeAmountForCurrency(
    existingOrder ? existingOrder.amount : body.amount,
    'vnd'
  );
  if (amountInput === null) {
    throw createHttpError(400, 'Số tiền VND phải là số nguyên từ 1.000 trở lên.');
  }

  const amount = Math.round(amountInput * 100);
  const date = moment().format('YYYYMMDDHHmmss');
  const expireDate = moment().add(15, 'minutes').format('YYYYMMDDHHmmss');
  const orderInfo = normalizeOrderInfo(existingOrder ? existingOrder.orderInfo : body.orderInfo);
  const txnRef = existingOrder ? existingOrder.txnRef : generateTxnRef();
  const orderType = (existingOrder ? existingOrder.orderType : body.orderType || 'other').toString();
  const ipAddr = existingOrder
    ? existingOrder.ipAddr
    : normalizeIp(getRawIp({ headers, socket, ip }));

  let params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: VNP_TMNCODE,
    vnp_Amount: amount,
    vnp_CurrCode: 'VND',
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: normalizeVnpayOrderInfo(orderInfo),
    vnp_OrderType: orderType,
    vnp_Locale: 'vn',
    vnp_ReturnUrl: VNP_RETURNURL,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: date,
    vnp_ExpireDate: expireDate,
  };

  params = sortObject(params);
  params.vnp_SecureHash = signParams(params);

  const payUrl = `${VNP_URL}?${qs.stringify(params, { encode: false })}`;
  return { payUrl, txnRef };
}

async function confirmIpn(query) {
  if (!isConfigured()) {
    return { RspCode: '99', Message: 'Config missing' };
  }

  const { params, verified } = verifyVnpayQuery(query);

  if (!verified) {
    return { RspCode: '97', Message: 'Invalid signature' };
  }

  const txnRef = params.vnp_TxnRef;
  const responseCode = params.vnp_ResponseCode || '';

  try {
    await vnpayStore.updateAfterIpn(txnRef, {
      verified,
      responseCode,
      rawData: query,
    });
  } catch (err) {
    console.error('IPN store error:', err.message);
  }

  return { RspCode: '00', Message: 'Confirm Success' };
}

async function buildReturnRedirect(query) {
  const { params, verified } = verifyVnpayQuery(query);

  const responseCode = params.vnp_ResponseCode || 'unknown';
  const txnStatus = params.vnp_TransactionStatus || 'unknown';
  const txnRef = params.vnp_TxnRef || 'unknown';
  const amountRaw = params.vnp_Amount ? Number(params.vnp_Amount) / 100 : 0;
  const success = verified && responseCode === '00';

  try {
    await vnpayStore.updateAfterReturn(txnRef, {
      verified,
      responseCode,
      txnStatus,
      rawData: query,
    });
  } catch (err) {
    console.error('Return store error:', err.message);
  }

  const resultParams = new URLSearchParams({
    txnRef,
    responseCode,
    txnStatus,
    amount: String(amountRaw),
    verified: verified ? '1' : '0',
    success: success ? '1' : '0',
  });

  return `/payment-result.html?${resultParams.toString()}`;
}

module.exports = {
  createPaymentUrl,
  confirmIpn,
  buildReturnRedirect,
};
