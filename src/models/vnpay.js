'use strict';

const { Schema, model } = require('mongoose');

/**
 * Schema lưu toàn bộ vòng đời một giao dịch VNPAY.
 *
 * Luồng trạng thái:
 * - Final statuses only: success | failed
 *
 * Ghi chú:
 * - ipnVerified / returnVerified lưu kết quả xác thực chữ ký riêng biệt.
 * - vnpRawIpn / vnpRawReturn lưu nguyên raw query params để debug.
 */
const vnpaySchema = new Schema(
  {
    txnRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1000,
    },
    orderInfo: { type: String, default: 'Thanh toán đơn hàng' },
    orderType: { type: String, default: 'other' },
    currency: {
      type: String,
      default: 'vnd',
      lowercase: true,
      trim: true,
    },
    locale: { type: String, default: 'vn' },
    ipAddr: { type: String, default: '127.0.0.1' },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
      index: true,
    },
    ipnVerified: { type: Boolean, default: false },
    ipnReceivedAt: { type: Date },
    vnpRawIpn: { type: Schema.Types.Mixed },
    returnVerified: { type: Boolean, default: false },
    returnReceivedAt: { type: Date },
    vnpResponseCode: { type: String },
    vnpTransactionStatus: { type: String },
    vnpRawReturn: { type: Schema.Types.Mixed },
    paidAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

vnpaySchema.index({ createdAt: -1 });

module.exports = model('VNPAY', vnpaySchema);
