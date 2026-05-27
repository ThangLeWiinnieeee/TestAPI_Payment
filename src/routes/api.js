'use strict';

const { Router } = require('express');
const { isConfigured } = require('../config');
const { isStripeConfigured } = require('../config/stripe');
const { isMomoConfigured } = require('../config/momo');
const {
  generateTxnRef,
  normalizeIp,
  normalizeOrderInfo,
  normalizeCurrency,
  isSupportedCurrency,
  normalizeAmountForCurrency,
} = require('../helpers');
const vnpayStore = require('../stores/vnpayStore');
const stripeStore = require('../stores/stripeStore');
const momoStore = require('../stores/momoStore');

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    configured: isConfigured(),
    stripeConfigured: isStripeConfigured(),
    momoConfigured: isMomoConfigured(),
    sandbox: true,
  });
});

router.post('/orders', async (req, res) => {
  const currency = normalizeCurrency(req.body.currency);
  if (!isSupportedCurrency(currency)) {
    return res.status(400).json({ error: 'Đơn vị tiền tệ chỉ hỗ trợ VND hoặc USD.' });
  }

  const amount = normalizeAmountForCurrency(req.body.amount, currency);
  if (amount === null) {
    return res.status(400).json({
      error: currency === 'vnd'
        ? 'Số tiền VND phải là số nguyên từ 1.000 trở lên.'
        : 'Số tiền USD phải lớn hơn 0 và tối đa 2 chữ số thập phân.',
    });
  }

  const txnRef = generateTxnRef();
  const orderInfo = normalizeOrderInfo(req.body.orderInfo);
  const orderType = (req.body.orderType || 'other').toString();
  const ipAddr = normalizeIp(
    req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip
  );

  try {
    const order = {
      txnRef,
      amount,
      currency,
      orderInfo,
      orderType,
      ipAddr,
    };

    return res.status(201).json({
      txnRef: order.txnRef,
      amount: order.amount,
      currency: order.currency,
      orderInfo: order.orderInfo,
      orderType: order.orderType,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Không thể tạo đơn hàng: ' + err.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const status = req.query.status || undefined;

    const [vnpayResult, stripeResult, momoResult] = await Promise.all([
      vnpayStore.listAll({ page: 1, limit: 1000, status }),
      stripeStore.listAll({ page: 1, limit: 1000, status }),
      momoStore.listAll({ page: 1, limit: 1000, status }),
    ]);

    const data = [
      ...vnpayResult.data.map((item) => ({
        ...item,
        provider: 'vnpay',
        currency: item.currency || 'vnd',
      })),
      ...stripeResult.data.map((item) => ({
        ...item,
        provider: 'stripe',
      })),
      ...momoResult.data.map((item) => ({
        ...item,
        provider: 'momo',
        currency: item.currency || 'vnd',
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const start = (page - 1) * limit;
    res.json({
      data: data.slice(start, start + limit),
      total: data.length,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions/:txnRef', async (req, res) => {
  try {
    const provider = (req.query.provider || '').toString().toLowerCase();

    if (provider === 'vnpay') {
      const txn = await vnpayStore.findByRef(req.params.txnRef);
      if (!txn) return res.status(404).json({ error: 'Không tìm thấy giao dịch VNPAY.' });
      return res.json({ ...txn, provider: 'vnpay', currency: txn.currency || 'vnd' });
    }

    if (provider === 'stripe') {
      const stripeTxn = await stripeStore.findByRef(req.params.txnRef);
      if (!stripeTxn) return res.status(404).json({ error: 'Không tìm thấy giao dịch Stripe.' });
      return res.json({ ...stripeTxn, provider: 'stripe' });
    }

    if (provider === 'momo') {
      const momoTxn = await momoStore.findByRef(req.params.txnRef);
      if (!momoTxn) return res.status(404).json({ error: 'Không tìm thấy giao dịch MoMo.' });
      return res.json({ ...momoTxn, provider: 'momo', currency: momoTxn.currency || 'vnd' });
    }
    const txn = await vnpayStore.findByRef(req.params.txnRef);
    if (txn) {
      return res.json({ ...txn, provider: 'vnpay', currency: txn.currency || 'vnd' });
    }

    const stripeTxn = await stripeStore.findByRef(req.params.txnRef);
    if (stripeTxn) {
      return res.json({ ...stripeTxn, provider: 'stripe' });
    }

    const momoTxn = await momoStore.findByRef(req.params.txnRef);
    if (!momoTxn) return res.status(404).json({ error: 'Không tìm thấy giao dịch.' });

    return res.json({ ...momoTxn, provider: 'momo', currency: momoTxn.currency || 'vnd' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
