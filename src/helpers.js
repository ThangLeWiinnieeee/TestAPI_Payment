'use strict';

const crypto = require('crypto');
const moment = require('moment');
const qs = require('qs');

const { VNP_HASHSECRET } = require('./config');

const SUPPORTED_CURRENCIES = new Set(['vnd', 'usd']);
const ZERO_DECIMAL_CURRENCIES = new Set(['vnd']);

/**
 * Chuyển IPv6 loopback/mapped về IPv4 thuần để VNPAY chấp nhận.
 * @param {string|undefined} rawIp
 * @returns {string}
 */
function normalizeIp(rawIp) {
  if (!rawIp) return '127.0.0.1';
  const ip = rawIp.split(',')[0].trim();
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

/**
 * Sắp xếp keys của object theo thứ tự alphabet để ký VNPAY đúng.
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((sorted, key) => {
      const value = obj[key];
      if (value === undefined || value === null || value === '') {
        return sorted;
      }

      sorted[encodeURIComponent(key)] = encodeURIComponent(String(value)).replace(/%20/g, '+');
      return sorted;
    }, {});
}

/**
 * Tạo chữ ký HMAC-SHA512 từ params đã sort.
 * @param {Record<string, unknown>} sortedParams
 * @returns {string} hex digest
 */
function signParams(sortedParams) {
  const signData = qs.stringify(sortedParams, { encode: false });
  return crypto
    .createHmac('sha512', VNP_HASHSECRET)
    .update(Buffer.from(signData, 'utf8'))
    .digest('hex');
}

/**
 * Chuẩn hóa mô tả đơn hàng dùng để hiển thị trong UI.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeOrderInfo(value) {
  const text = String(value || 'Thanh toán đơn hàng')
    .replace(/[<>]/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);

  return text || 'Thanh toán đơn hàng';
}

/**
 * VNPAY cần order info không dấu và không chứa ký tự ngoài whitelist.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeVnpayOrderInfo(value) {
  const text = normalizeOrderInfo(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 .,:_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);

  return text || 'Thanh toan don hang';
}

function normalizeCurrency(value) {
  return String(value || 'vnd').trim().toLowerCase();
}

function isSupportedCurrency(value) {
  return SUPPORTED_CURRENCIES.has(normalizeCurrency(value));
}

function normalizeAmountForCurrency(value, currency) {
  const normalizedCurrency = normalizeCurrency(currency);
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (normalizedCurrency === 'vnd') {
    return Number.isInteger(amount) && amount >= 1000 ? amount : null;
  }

  if (normalizedCurrency === 'usd') {
    const rounded = Math.round(amount * 100) / 100;
    return Math.abs(amount - rounded) < 1e-9 ? rounded : null;
  }

  return null;
}

function toStripeUnitAmount(value, currency) {
  const normalizedCurrency = normalizeCurrency(currency);
  const amount = normalizeAmountForCurrency(value, normalizedCurrency);

  if (amount === null) {
    return null;
  }

  return ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)
    ? amount
    : Math.round(amount * 100);
}

/**
 * Sinh vnp_TxnRef duy nhất mỗi lần gọi: YYYYMMDD + 8 ký tự hex ngẫu nhiên.
 * @returns {string}
 */
function generateTxnRef() {
  const date = moment().utcOffset('+07:00').format('YYYYMMDD');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${date}${rand}`;
}

/**
 * Escape ký tự đặc biệt HTML để tránh XSS khi render kết quả.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  normalizeIp,
  sortObject,
  signParams,
  generateTxnRef,
  normalizeOrderInfo,
  normalizeVnpayOrderInfo,
  normalizeCurrency,
  isSupportedCurrency,
  normalizeAmountForCurrency,
  toStripeUnitAmount,
  escapeHtml,
};
