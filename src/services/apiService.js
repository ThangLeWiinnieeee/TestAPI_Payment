'use strict';

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

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Trả về trạng thái cấu hình của các cổng thanh toán.
 */
function getHealthStatus() {
  return {
    ok: true,
    configured: isConfigured(),
    stripeConfigured: isStripeConfigured(),
    momoConfigured: isMomoConfigured(),
    sandbox: true,
  };
}

/**
 * Tạo draft order (không ghi DB).
 * @param {{ amount, currency, orderInfo, orderType, ipAddr }} params
 */
function createDraftOrder({ amount, currency, orderInfo, orderType, ipAddr }) {
  const normalizedCurrency = normalizeCurrency(currency);

  if (!isSupportedCurrency(normalizedCurrency)) {
    throw createHttpError(400, 'Đơn vị tiền tệ chỉ hỗ trợ VND hoặc USD.');
  }

  const normalizedAmount = normalizeAmountForCurrency(amount, normalizedCurrency);
  if (normalizedAmount === null) {
    throw createHttpError(
      400,
      normalizedCurrency === 'vnd'
        ? 'Số tiền VND phải là số nguyên từ 1.000 trở lên.'
        : 'Số tiền USD phải lớn hơn 0 và tối đa 2 chữ số thập phân.'
    );
  }

  return {
    txnRef: generateTxnRef(),
    amount: normalizedAmount,
    currency: normalizedCurrency,
    orderInfo: normalizeOrderInfo(orderInfo),
    orderType: (orderType || 'other').toString(),
    ipAddr,
  };
}

/**
 * Lấy lịch sử giao dịch gộp từ cả 3 providers, sắp xếp theo ngày giảm dần.
 * @param {{ page, limit, status }} params
 */
async function listTransactions({ page = 1, limit = 20, status }) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));

  const [vnpayResult, stripeResult, momoResult] = await Promise.all([
    vnpayStore.listAll({ page: 1, limit: 1000, status }),
    stripeStore.listAll({ page: 1, limit: 1000, status }),
    momoStore.listAll({ page: 1, limit: 1000, status }),
  ]);

  const data = [
    ...vnpayResult.data.map((item) => ({ ...item, provider: 'vnpay', currency: item.currency || 'vnd' })),
    ...stripeResult.data.map((item) => ({ ...item, provider: 'stripe' })),
    ...momoResult.data.map((item) => ({ ...item, provider: 'momo', currency: item.currency || 'vnd' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const start = (safePage - 1) * safeLimit;

  return {
    data: data.slice(start, start + safeLimit),
    total: data.length,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Tìm giao dịch theo txnRef, ưu tiên theo provider nếu chỉ định.
 * @param {string} txnRef
 * @param {string} provider - 'vnpay' | 'stripe' | 'momo' | ''
 */
async function findTransaction(txnRef, provider = '') {
  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider === 'vnpay') {
    const txn = await vnpayStore.findByRef(txnRef);
    if (!txn) throw createHttpError(404, 'Không tìm thấy giao dịch VNPAY.');
    return { ...txn, provider: 'vnpay', currency: txn.currency || 'vnd' };
  }

  if (normalizedProvider === 'stripe') {
    const txn = await stripeStore.findByRef(txnRef);
    if (!txn) throw createHttpError(404, 'Không tìm thấy giao dịch Stripe.');
    return { ...txn, provider: 'stripe' };
  }

  if (normalizedProvider === 'momo') {
    const txn = await momoStore.findByRef(txnRef);
    if (!txn) throw createHttpError(404, 'Không tìm thấy giao dịch MoMo.');
    return { ...txn, provider: 'momo', currency: txn.currency || 'vnd' };
  }

  // Không chỉ định provider → tìm lần lượt
  const vnpayTxn = await vnpayStore.findByRef(txnRef);
  if (vnpayTxn) return { ...vnpayTxn, provider: 'vnpay', currency: vnpayTxn.currency || 'vnd' };

  const stripeTxn = await stripeStore.findByRef(txnRef);
  if (stripeTxn) return { ...stripeTxn, provider: 'stripe' };

  const momoTxn = await momoStore.findByRef(txnRef);
  if (!momoTxn) throw createHttpError(404, 'Không tìm thấy giao dịch.');
  return { ...momoTxn, provider: 'momo', currency: momoTxn.currency || 'vnd' };
}

module.exports = {
  getHealthStatus,
  createDraftOrder,
  listTransactions,
  findTransaction,
};
