'use strict';

require('dotenv').config();

const PORT = process.env.PORT || 3000;
const VNP_TMNCODE = process.env.VNP_TMNCODE || 'YOUR_TMN_CODE';
const VNP_HASHSECRET = process.env.VNP_HASH_SECRET || 'YOUR_HASH_SECRET';
const VNP_URL = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const VNP_RETURNURL = process.env.VNP_RETURN_URL || `http://localhost:${PORT}/payment/return`;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vnpay_demo';

/**
 * Trả về true nếu TmnCode và HashSecret đã được cấu hình đúng trong .env
 */
function isConfigured() {
  return (
    !VNP_TMNCODE.startsWith('YOUR_') &&
    !VNP_HASHSECRET.startsWith('YOUR_')
  );
}

module.exports = {
  PORT,
  VNP_TMNCODE,
  VNP_HASHSECRET,
  VNP_URL,
  VNP_RETURNURL,
  MONGODB_URI,
  isConfigured,
};
