'use strict';

const Stripe = require('stripe');

require('dotenv').config();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_SUCCESS_URL =
  process.env.STRIPE_SUCCESS_URL ||
  'http://localhost:3000/stripe-success.html?session_id={CHECKOUT_SESSION_ID}';
const STRIPE_CANCEL_URL =
  process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/stripe-cancel.html';
const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'vnd').toLowerCase();

let stripeClient;

function isStripeConfigured() {
  return Boolean(
    STRIPE_SECRET_KEY &&
      !STRIPE_SECRET_KEY.includes('YOUR') &&
      (STRIPE_SECRET_KEY.startsWith('sk_test_') || STRIPE_SECRET_KEY.startsWith('sk_live_'))
  );
}

function getStripeClient() {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in .env.');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

module.exports = {
  getStripeClient,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL,
  STRIPE_CURRENCY,
  isStripeConfigured,
};
