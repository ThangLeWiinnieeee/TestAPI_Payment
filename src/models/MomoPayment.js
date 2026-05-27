'use strict';

const { Schema, model } = require('mongoose');

const momoPaymentSchema = new Schema(
  {
    txnRef: {
      type: String,
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    requestId: {
      type: String,
      required: true,
      index: true,
    },
    partnerCode: {
      type: String,
      required: true,
    },
    transId: {
      type: String,
      index: true,
      sparse: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1000,
    },
    currency: {
      type: String,
      default: 'vnd',
      lowercase: true,
      trim: true,
    },
    orderInfo: {
      type: String,
      default: 'Thanh toán MoMo',
    },
    ipAddr: {
      type: String,
      default: '127.0.0.1',
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
      index: true,
    },
    resultCode: {
      type: Number,
      index: true,
    },
    message: {
      type: String,
    },
    orderType: {
      type: String,
    },
    payType: {
      type: String,
    },
    responseTime: {
      type: Number,
    },
    extraData: {
      type: String,
      default: '',
    },
    ipnVerified: {
      type: Boolean,
      default: false,
    },
    ipnReceivedAt: {
      type: Date,
    },
    returnVerified: {
      type: Boolean,
      default: false,
    },
    returnReceivedAt: {
      type: Date,
    },
    momoRawIpn: {
      type: Schema.Types.Mixed,
    },
    momoRawReturn: {
      type: Schema.Types.Mixed,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

momoPaymentSchema.index({ createdAt: -1 });
momoPaymentSchema.index({ txnRef: 1, orderId: 1 });

module.exports = model('MomoPayment', momoPaymentSchema);
