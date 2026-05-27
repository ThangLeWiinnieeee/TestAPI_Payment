'use strict';

const stripeService = require('../services/stripeService');

function sendJsonError(res, error) {
  return res.status(error.status || 500).json({ error: error.message });
}

function getProducts(_req, res) {
  return res.json(stripeService.getProducts());
}

async function getPayment(req, res) {
  try {
    const payment = await stripeService.findPaymentByRef(req.params.txnRef);

    if (!payment) {
      return res.status(404).json({ error: 'Không tìm thấy giao dịch Stripe.' });
    }

    return res.json(payment);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

async function syncCheckout(req, res) {
  try {
    const result = await stripeService.syncCheckoutSession(req.params.sessionId);
    return res.json(result);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

async function cancelCheckout(req, res) {
  try {
    const result = await stripeService.cancelCheckout({
      sessionId: req.body.sessionId,
      txnRef: req.body.txnRef,
      draft: req.body.draft,
    });

    return res.json(result);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

async function createCheckout(req, res) {
  try {
    const result = await stripeService.createCheckoutSession({
      body: req.body,
      headers: req.headers,
      socket: req.socket,
      ip: req.ip,
    });

    return res.status(201).json(result);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

async function handleStripeWebhook(req, res) {
  try {
    const result = await stripeService.handleWebhook(
      req.body,
      req.headers['stripe-signature']
    );

    return res.json(result);
  } catch (error) {
    return res.status(error.status || 500).send(error.message);
  }
}

module.exports = {
  getProducts,
  getPayment,
  syncCheckout,
  cancelCheckout,
  createCheckout,
  handleStripeWebhook,
};
