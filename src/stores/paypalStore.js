'use strict';

const PaypalPayment = require('../models/PaypalPayment');

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getPurchaseUnit(order) {
  return Array.isArray(order?.purchase_units) ? order.purchase_units[0] : undefined;
}

function getCapture(order) {
  const purchaseUnit = getPurchaseUnit(order);
  const captures = purchaseUnit?.payments?.captures;
  return Array.isArray(captures) ? captures[0] : undefined;
}

function getTxnRef(order, fallbackTxnRef) {
  const purchaseUnit = getPurchaseUnit(order);
  return (
    purchaseUnit?.custom_id ||
    purchaseUnit?.reference_id ||
    order?.custom_id ||
    fallbackTxnRef ||
    order?.id
  );
}

async function findExisting({ txnRef, paypalOrderId }) {
  const clauses = [];
  if (paypalOrderId) clauses.push({ paypalOrderId });
  if (txnRef) clauses.push({ txnRef });

  if (!clauses.length) return null;

  return PaypalPayment.findOne({ $or: clauses }).sort({ createdAt: -1 });
}

async function findByRef(txnRef) {
  return PaypalPayment.findOne({
    $or: [{ txnRef }, { paypalOrderId: txnRef }, { captureId: txnRef }],
  }).sort({ createdAt: -1 }).lean();
}

async function listAll({ page = 1, limit = 20, status } = {}) {
  const finalStatuses = ['success', 'failed'];
  const filter = finalStatuses.includes(status)
    ? { status }
    : { status: { $in: finalStatuses } };
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    PaypalPayment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PaypalPayment.countDocuments(filter),
  ]);

  return { data, total, page, limit };
}

async function updateAfterCapture(order, { ipAddr, fallbackDraft } = {}) {
  const purchaseUnit = getPurchaseUnit(order);
  const capture = getCapture(order);
  const paypalStatus = capture?.status || order?.status || 'UNKNOWN';
  const success = paypalStatus === 'COMPLETED';
  const txnRef = getTxnRef(order, fallbackDraft?.txnRef);
  const existing = await findExisting({ txnRef, paypalOrderId: order?.id });
  const amountSource = capture?.amount || purchaseUnit?.amount || {};
  const payer = order?.payer || {};

  return PaypalPayment.findOneAndUpdate(
    existing ? { _id: existing._id } : { paypalOrderId: order.id },
    {
      $set: {
        txnRef,
        paypalOrderId: order.id,
        captureId: capture?.id,
        amount: toNumber(amountSource.value, toNumber(fallbackDraft?.amount)),
        currency: String(amountSource.currency_code || fallbackDraft?.currency || 'usd').toLowerCase(),
        orderInfo: purchaseUnit?.description || fallbackDraft?.orderInfo || 'Thanh toan PayPal',
        ipAddr: ipAddr || fallbackDraft?.ipAddr || '127.0.0.1',
        status: success ? 'success' : 'failed',
        paypalStatus,
        payerId: payer.payer_id,
        payerEmail: payer.email_address,
        rawOrder: order,
        rawCapture: capture,
        ...(success && { paidAt: new Date() }),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

async function updateCancelled({ txnRef, paypalOrderId, amount, currency, orderInfo, ipAddr, rawEvent }) {
  const existing = await findExisting({ txnRef, paypalOrderId });

  return PaypalPayment.findOneAndUpdate(
    existing ? { _id: existing._id } : { txnRef },
    {
      $set: {
        txnRef,
        paypalOrderId: paypalOrderId || undefined,
        amount: toNumber(amount),
        currency: String(currency || 'usd').toLowerCase(),
        orderInfo: orderInfo || 'Thanh toan PayPal da bi huy',
        ipAddr: ipAddr || '127.0.0.1',
        status: 'failed',
        paypalStatus: 'CANCELLED',
        rawEvent,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

module.exports = {
  findByRef,
  listAll,
  updateAfterCapture,
  updateCancelled,
};
