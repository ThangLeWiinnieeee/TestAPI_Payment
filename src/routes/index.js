'use strict';

const apiRouter = require('./api');
const paymentRouter = require('./payment');
const stripeRouter = require('./stripe');
const momoRouter = require('./momo');

function registerRoutes(app) {
  app.use('/api', apiRouter);
  app.use('/payment', paymentRouter);
  app.use('/stripe', stripeRouter);
  app.use('/momo', momoRouter);
}

module.exports = { registerRoutes };
