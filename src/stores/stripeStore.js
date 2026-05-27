'use strict';

const StripePayment = require('../models/StripePayment');

async function findByRef(txnRef) {
  return StripePayment.findOne({ txnRef }).sort({ createdAt: -1 }).lean();
}

async function listAll({ page = 1, limit = 20, status } = {}) {
  const finalStatuses = ['success', 'failed'];
  const filter = finalStatuses.includes(status)
    ? { status }
    : { status: { $in: finalStatuses } };
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    StripePayment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    StripePayment.countDocuments(filter),
  ]);

  return { data, total, page, limit };
}

async function updateAfterCheckout(session, event) {
  const txnRef = session.client_reference_id || session.metadata?.txnRef;
  const success = session.payment_status === 'paid';

  return StripePayment.findOneAndUpdate(
    { checkoutSessionId: session.id },
    {
      $set: {
        txnRef: txnRef || session.id,
        checkoutSessionId: session.id,
        paymentIntentId: session.payment_intent || undefined,
        amount: session.amount_total || 0,
        currency: session.currency,
        orderInfo: session.metadata?.orderInfo || 'Thanh toán Stripe',
        ipAddr: session.metadata?.ipAddr || '127.0.0.1',
        status: success ? 'success' : 'failed',
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email || session.customer_email || undefined,
        rawSession: session,
        rawEvent: {
          id: event.id,
          type: event.type,
          created: event.created,
        },
        ...(success && { paidAt: new Date() }),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

async function updateCheckoutExpired(session, event) {
  const txnRef = session.client_reference_id || session.metadata?.txnRef;

  return StripePayment.findOneAndUpdate(
    { checkoutSessionId: session.id },
    {
      $set: {
        txnRef: txnRef || session.id,
        checkoutSessionId: session.id,
        paymentIntentId: session.payment_intent || undefined,
        amount: session.amount_total || 0,
        currency: session.currency,
        orderInfo: session.metadata?.orderInfo || 'Thanh toán Stripe',
        ipAddr: session.metadata?.ipAddr || '127.0.0.1',
        status: 'failed',
        paymentStatus: session.payment_status,
        rawSession: session,
        rawEvent: {
          id: event.id,
          type: event.type,
          created: event.created,
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

async function updateCheckoutCancelled({ txnRef, amount, currency, orderInfo, ipAddr, sessionId, event }) {
  return StripePayment.findOneAndUpdate(
    { txnRef },
    {
      $set: {
        txnRef,
        checkoutSessionId: sessionId || undefined,
        amount,
        currency,
        orderInfo: orderInfo || 'Thanh toán Stripe đã bị hủy',
        ipAddr: ipAddr || '127.0.0.1',
        status: 'failed',
        paymentStatus: 'cancelled',
        rawEvent: {
          id: event.id,
          type: event.type,
          created: event.created,
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

module.exports = {
  findByRef,
  listAll,
  updateAfterCheckout,
  updateCheckoutExpired,
  updateCheckoutCancelled,
};
