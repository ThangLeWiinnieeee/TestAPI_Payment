'use strict';

const momoService = require('../services/momoService');

function sendJsonError(res, error) {
  return res.status(error.status || 500).json({ error: error.message });
}

async function createPayment(req, res) {
  try {
    const result = await momoService.createPayment({
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

async function handleIpn(req, res) {
  try {
    const result = await momoService.confirmIpn(req.body, {
      headers: req.headers,
      socket: req.socket,
      ip: req.ip,
    });

    return res.json(result);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

async function handleReturn(req, res) {
  try {
    const redirectUrl = await momoService.buildReturnRedirect(req.query, {
      headers: req.headers,
      socket: req.socket,
      ip: req.ip,
    });

    return res.redirect(redirectUrl);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

async function getPayment(req, res) {
  try {
    const payment = await momoService.findPaymentByRef(req.params.txnRef);

    if (!payment) {
      return res.status(404).json({ error: 'Không tìm thấy giao dịch MoMo.' });
    }

    return res.json(payment);
  } catch (error) {
    return sendJsonError(res, error);
  }
}

module.exports = {
  createPayment,
  handleIpn,
  handleReturn,
  getPayment,
};
