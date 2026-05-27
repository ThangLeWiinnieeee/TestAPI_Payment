'use strict';

const apiService = require('../services/apiService');

function normalizeIpFromReq(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '').split(',')[0].trim();
}

/**
 * GET /api/health
 */
function getHealth(_req, res) {
  return res.json(apiService.getHealthStatus());
}

/**
 * POST /api/orders
 */
async function createOrder(req, res) {
  try {
    const order = apiService.createDraftOrder({
      amount: req.body.amount,
      currency: req.body.currency,
      orderInfo: req.body.orderInfo,
      orderType: req.body.orderType,
      ipAddr: normalizeIpFromReq(req),
    });

    return res.status(201).json({
      txnRef: order.txnRef,
      amount: order.amount,
      currency: order.currency,
      orderInfo: order.orderInfo,
      orderType: order.orderType,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * GET /api/transactions
 */
async function listTransactions(req, res) {
  try {
    const result = await apiService.listTransactions({
      page: parseInt(req.query.page || '1', 10),
      limit: parseInt(req.query.limit || '20', 10),
      status: req.query.status || undefined,
    });

    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * GET /api/transactions/:txnRef
 */
async function getTransaction(req, res) {
  try {
    const txn = await apiService.findTransaction(
      req.params.txnRef,
      (req.query.provider || '').toString()
    );

    return res.json(txn);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = {
  getHealth,
  createOrder,
  listTransactions,
  getTransaction,
};
