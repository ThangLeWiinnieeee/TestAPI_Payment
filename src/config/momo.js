'use strict';

require('dotenv').config();

const { PORT } = require('./index');

const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || '';
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || '';
const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || '';
const MOMO_CREATE_URL =
  process.env.MOMO_CREATE_URL || 'https://test-payment.momo.vn/v2/gateway/api/create';
const MOMO_QUERY_URL =
  process.env.MOMO_QUERY_URL || 'https://test-payment.momo.vn/v2/gateway/api/query';
const MOMO_REDIRECT_URL =
  process.env.MOMO_REDIRECT_URL || `http://localhost:${PORT}/momo/return`;
const MOMO_IPN_URL =
  process.env.MOMO_IPN_URL || `http://localhost:${PORT}/momo/ipn`;
const MOMO_REQUEST_TYPE = process.env.MOMO_REQUEST_TYPE || 'payWithMethod';
const MOMO_AUTO_CAPTURE = process.env.MOMO_AUTO_CAPTURE !== 'false';
const MOMO_LANG = process.env.MOMO_LANG || 'vi';

function isMomoConfigured() {
  return Boolean(
    MOMO_PARTNER_CODE &&
      MOMO_ACCESS_KEY &&
      MOMO_SECRET_KEY &&
      !MOMO_PARTNER_CODE.includes('YOUR') &&
      !MOMO_ACCESS_KEY.includes('YOUR') &&
      !MOMO_SECRET_KEY.includes('YOUR')
  );
}

module.exports = {
  MOMO_PARTNER_CODE,
  MOMO_ACCESS_KEY,
  MOMO_SECRET_KEY,
  MOMO_CREATE_URL,
  MOMO_QUERY_URL,
  MOMO_REDIRECT_URL,
  MOMO_IPN_URL,
  MOMO_REQUEST_TYPE,
  MOMO_AUTO_CAPTURE,
  MOMO_LANG,
  isMomoConfigured,
};
