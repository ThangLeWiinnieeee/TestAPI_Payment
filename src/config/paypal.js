'use strict';

require('dotenv').config();

const { PORT } = require('./index');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET_KEY || '';
const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
const PAYPAL_API_BASE = (
  process.env.PAYPAL_API_BASE ||
  (PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com')
).replace(/\/+$/, '');
const PAYPAL_CURRENCY = (process.env.PAYPAL_CURRENCY || 'usd').toLowerCase();
const PAYPAL_BRAND_NAME = process.env.PAYPAL_BRAND_NAME || 'API_VNPAY sandbox';
const PAYPAL_RETURN_URL =
  process.env.PAYPAL_RETURN_URL || `http://localhost:${PORT}/payment-result.html`;
const PAYPAL_CANCEL_URL =
  process.env.PAYPAL_CANCEL_URL || `http://localhost:${PORT}/payment-method.html`;

function hasPlaceholder(value) {
  return String(value || '').toUpperCase().includes('YOUR');
}

function isPaypalConfigured() {
  return Boolean(
    PAYPAL_CLIENT_ID &&
      PAYPAL_CLIENT_SECRET &&
      !hasPlaceholder(PAYPAL_CLIENT_ID) &&
      !hasPlaceholder(PAYPAL_CLIENT_SECRET)
  );
}

module.exports = {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_ENV,
  PAYPAL_API_BASE,
  PAYPAL_CURRENCY,
  PAYPAL_BRAND_NAME,
  PAYPAL_RETURN_URL,
  PAYPAL_CANCEL_URL,
  isPaypalConfigured,
};
