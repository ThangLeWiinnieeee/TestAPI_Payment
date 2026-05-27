'use strict';

const express = require('express');
const path = require('path');

const { PORT } = require('./src/config');
const { connectDB } = require('./src/config/db');
const { registerRoutes } = require('./src/routes');
const { handleStripeWebhook } = require('./src/controllers/stripeController');

const app = express();
const isVercel = Boolean(process.env.VERCEL);

let dbReady;

async function ensureDb() {
  if (!dbReady) {
    dbReady = connectDB();
  }

  return dbReady;
}

app.use(async (req, res, next) => {
  const needsDb =
    req.path.startsWith('/api') ||
    req.path.startsWith('/payment') ||
    req.path.startsWith('/stripe') ||
    req.path.startsWith('/momo');

  if (!needsDb) {
    return next();
  }

  try {
    await ensureDb();
    return next();
  } catch (err) {
    return next(err);
  }
});

app.post('/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

registerRoutes(app);

async function bootstrap() {
  await ensureDb();

  app.listen(PORT, () => {
    const { VNP_TMNCODE, isConfigured } = require('./src/config');
    console.log(`VNPAY demo -> http://localhost:${PORT}`);
    console.log(` TmnCode : ${VNP_TMNCODE}`);
    console.log(` Configured : ${isConfigured()}`);
  });
}

if (isVercel) {
  module.exports = app;
} else {
  bootstrap().catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
}
