'use strict';

const paymentService = require('../services/paymentService');

function sendError(res, error) {
  return res.status(error.status || 500).json({ error: error.message });
}

async function createPayment(req, res) {
  try {
    const result = await paymentService.createPaymentUrl({
      body: req.body,
      headers: req.headers,
      socket: req.socket,
      ip: req.ip,
    });

    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function handleIpn(req, res) {
  try {
    const result = await paymentService.confirmIpn(req.query);
    return res.json(result);
  } catch (error) {
    console.error('IPN handler error:', error.message);
    return res.json({ RspCode: '99', Message: 'Internal error' });
  }
}

async function handleReturn(req, res) {
  try {
    const redirectUrl = await paymentService.buildReturnRedirect(req.query);
    return res.redirect(redirectUrl);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  createPayment,
  handleIpn,
  handleReturn,
};
