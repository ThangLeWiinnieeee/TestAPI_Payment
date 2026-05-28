'use strict';

const { Schema, model } = require('mongoose');

const paypalPaymentSchema = new Schema(
  {
    txnRef: {
      type: String,
      required: true,
      index: true,
    },
    paypalOrderId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    captureId: {
      type: String,
      index: true,
      sparse: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    orderInfo: {
      type: String,
      default: 'Thanh toan PayPal',
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
    paypalStatus: {
      type: String,
      index: true,
    },
    payerId: {
      type: String,
      trim: true,
    },
    payerEmail: {
      type: String,
      trim: true,
    },
    rawOrder: {
      type: Schema.Types.Mixed,
    },
    rawCapture: {
      type: Schema.Types.Mixed,
    },
    rawEvent: {
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

paypalPaymentSchema.index({ createdAt: -1 });
paypalPaymentSchema.index({ txnRef: 1, paypalOrderId: 1 });

module.exports = model('PaypalPayment', paypalPaymentSchema);
