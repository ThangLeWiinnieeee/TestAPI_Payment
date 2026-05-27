'use strict';

const express = require('express');
const path = require('path');

const { PORT } = require('./src/config');
const { connectDB } = require('./src/config/db');
const { registerRoutes } = require('./src/routes');
const { handleStripeWebhook } = require('./src/controllers/stripeController');

const app = express();

app.post('/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

registerRoutes(app);

async function bootstrap() {
  await connectDB();

  app.listen(PORT, () => {
    const { VNP_TMNCODE, isConfigured } = require('./src/config');
    console.log(`VNPAY demo -> http://localhost:${PORT}`);
    console.log(` TmnCode : ${VNP_TMNCODE}`);
    console.log(` Configured : ${isConfigured()}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
