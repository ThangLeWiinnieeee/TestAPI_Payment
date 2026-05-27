'use strict';

const MomoPayment = require('../models/MomoPayment');

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function buildUpdatePayload(payload, { verified, source, ipAddr }) {
  const resultCode = normalizeNumber(payload.resultCode);
  const success = verified && resultCode === 0;
  const amount = normalizeNumber(payload.amount) || 0;
  const rawField = source === 'ipn' ? 'momoRawIpn' : 'momoRawReturn';
  const verifiedField = source === 'ipn' ? 'ipnVerified' : 'returnVerified';
  const receivedAtField = source === 'ipn' ? 'ipnReceivedAt' : 'returnReceivedAt';

  return {
    txnRef: payload.orderId,
    orderId: payload.orderId,
    requestId: payload.requestId || payload.orderId,
    partnerCode: payload.partnerCode,
    transId: payload.transId === undefined || payload.transId === null
      ? undefined
      : String(payload.transId),
    amount,
    currency: 'vnd',
    orderInfo: payload.orderInfo || 'Thanh toán MoMo',
    ipAddr: ipAddr || payload.ipAddr || '127.0.0.1',
    status: success ? 'success' : 'failed',
    resultCode,
    message: payload.message,
    orderType: payload.orderType,
    payType: payload.payType,
    responseTime: normalizeNumber(payload.responseTime),
    extraData: payload.extraData || '',
    [verifiedField]: verified,
    [receivedAtField]: new Date(),
    [rawField]: payload,
    ...(success && { paidAt: new Date() }),
  };
}

async function findByRef(txnRef) {
  return MomoPayment.findOne({
    $or: [{ txnRef }, { orderId: txnRef }],
  }).sort({ createdAt: -1 }).lean();
}

async function listAll({ page = 1, limit = 20, status } = {}) {
  const finalStatuses = ['success', 'failed'];
  const filter = finalStatuses.includes(status)
    ? { status }
    : { status: { $in: finalStatuses } };
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    MomoPayment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    MomoPayment.countDocuments(filter),
  ]);

  return { data, total, page, limit };
}

async function updateFromIpn(payload, options) {
  const update = buildUpdatePayload(payload, { ...options, source: 'ipn' });

  return MomoPayment.findOneAndUpdate(
    { orderId: update.orderId },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

async function updateFromReturn(payload, options) {
  const update = buildUpdatePayload(payload, { ...options, source: 'return' });

  return MomoPayment.findOneAndUpdate(
    { orderId: update.orderId },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

module.exports = {
  findByRef,
  listAll,
  updateFromIpn,
  updateFromReturn,
};
