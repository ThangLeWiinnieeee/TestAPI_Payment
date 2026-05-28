'use strict';

const { Router } = require('express');
const paypalController = require('../controllers/paypalController');

const router = Router();

router.get('/config', paypalController.getConfig);
router.get('/payments/:txnRef', paypalController.getPayment);
router.post('/orders', paypalController.createOrder);
router.post('/orders/:orderId/capture', paypalController.captureOrder);
router.post('/cancel', paypalController.cancelOrder);

module.exports = router;
