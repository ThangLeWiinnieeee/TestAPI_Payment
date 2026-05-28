'use strict';

const paypalService = require('../services/paypalService');

function sendJsonError(res, error) {
  return res.status(error.status || 500).json({ error: error.message });
}

function getConfig(_req, res) {
  return res.json(paypalService.getClientConfig());
}

async function createOrder(req, res) {
  try {
    const result = await paypalService.createOrder({
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

async function captureOrder(req, res) {
  try {
    const result = await paypalService.captureOrder({
      paypalOrderId: req.params.orderId,
      body: req.body,
      headers: req.headers,
      socket: req.socket,
      ip: req.ip,
    });

    return res.json(result);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

async function cancelOrder(req, res) {
  try {
    const result = await paypalService.cancelOrder({
      body: req.body,
      headers: req.headers,
      socket: req.socket,
      ip: req.ip,
    });

    return res.json(result);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

async function getPayment(req, res) {
  try {
    const payment = await paypalService.findPaymentByRef(req.params.txnRef);

    if (!payment) {
      return res.status(404).json({ error: 'Khong tim thay giao dich PayPal.' });
    }

    return res.json(payment);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

module.exports = {
  getConfig,
  createOrder,
  captureOrder,
  cancelOrder,
  getPayment,
};
