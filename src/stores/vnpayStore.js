'use strict';

const VNPAY = require('../models/vnpay');

/**
 * Lưu giao dịch cuối cùng vào MongoDB.
 * @param {object} data
 * @returns {Promise<object>} Mongoose document
 */
async function save(data) {
  return VNPAY.create(data);
}

/**
 * Tìm giao dịch theo txnRef.
 * @param {string} txnRef
 * @returns {Promise<object|null>}
 */
async function findByRef(txnRef) {
  return VNPAY.findOne({ txnRef }).lean();
}

/**
 * Lấy danh sách giao dịch sắp xếp mới nhất trước.
 * @param {{ page?: number, limit?: number, status?: string }} opts
 * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
 */
async function listAll({ page = 1, limit = 20, status } = {}) {
  const finalStatuses = ['success', 'failed'];
  const filter = finalStatuses.includes(status)
    ? { status }
    : { status: { $in: finalStatuses } };
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    VNPAY.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    VNPAY.countDocuments(filter),
  ]);

  return { data, total, page, limit };
}

/**
 * Cập nhật sau khi nhận IPN từ VNPAY server.
 * Được gọi trước return URL trong luồng thực tế.
 * @param {string} txnRef
 * @param {{ verified: boolean, responseCode: string, rawData: object }} info
 * @returns {Promise<object|null>}
 */
async function updateAfterIpn(txnRef, { verified, responseCode, rawData }) {
  const success = verified && responseCode === '00';
  const amount = rawData?.vnp_Amount ? Number(rawData.vnp_Amount) / 100 : 0;
  const orderInfo = rawData?.vnp_OrderInfo || 'Thanh toán đơn hàng';

  return VNPAY.findOneAndUpdate(
    { txnRef },
    {
      $set: {
        txnRef,
        amount,
        currency: 'vnd',
        orderInfo,
        orderType: rawData?.vnp_OrderType || 'other',
        locale: rawData?.vnp_Locale || 'vn',
        ipAddr: rawData?.vnp_IpAddr || '127.0.0.1',
        ipnVerified: verified,
        ipnReceivedAt: new Date(),
        vnpRawIpn: rawData,
        vnpResponseCode: responseCode,
        status: success ? 'success' : 'failed',
        ...(success && { paidAt: new Date() }),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

/**
 * Cập nhật sau khi user được redirect về Return URL.
 * Đây là bước finalise trạng thái.
 * @param {string} txnRef
 * @param {{ verified: boolean, responseCode: string, txnStatus: string, rawData: object }} info
 * @returns {Promise<object|null>}
 */
async function updateAfterReturn(txnRef, { verified, responseCode, txnStatus, rawData }) {
  const success = verified && responseCode === '00';
  const amount = rawData?.vnp_Amount ? Number(rawData.vnp_Amount) / 100 : 0;
  const orderInfo = rawData?.vnp_OrderInfo || 'Thanh toán đơn hàng';

  return VNPAY.findOneAndUpdate(
    { txnRef },
    {
      $set: {
        txnRef,
        amount,
        currency: 'vnd',
        orderInfo,
        orderType: rawData?.vnp_OrderType || 'other',
        locale: rawData?.vnp_Locale || 'vn',
        ipAddr: rawData?.vnp_IpAddr || '127.0.0.1',
        returnVerified: verified,
        returnReceivedAt: new Date(),
        vnpResponseCode: responseCode,
        vnpTransactionStatus: txnStatus,
        vnpRawReturn: rawData,
        status: success ? 'success' : 'failed',
        ...(success && { paidAt: new Date() }),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

module.exports = {
  save,
  findByRef,
  listAll,
  updateAfterIpn,
  updateAfterReturn,
};
