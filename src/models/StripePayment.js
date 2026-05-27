'use strict';

const { Schema, model } = require('mongoose');

const stripePaymentSchema = new Schema(
  {
    txnRef: {
      type: String,
      required: true,
      index: true,
    },
    checkoutSessionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    paymentIntentId: {
      type: String,
      index: true,
      sparse: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    orderInfo: {
      type: String,
      default: 'Thanh toán Stripe',
    },
    ipAddr: {
      type: String,
      default: '127.0.0.1',
    },
    items: {
      type: Schema.Types.Mixed,
      default: [],
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
    },
    customerEmail: {
      type: String,
      trim: true,
    },
    rawSession: {
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

stripePaymentSchema.index({ createdAt: -1 });
stripePaymentSchema.index({ txnRef: 1, checkoutSessionId: 1 });

module.exports = model('StripePayment', stripePaymentSchema);
