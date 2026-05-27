'use strict';

const { Router } = require('express');
const stripeController = require('../controllers/stripeController');

const router = Router();

router.get('/products', stripeController.getProducts);
router.get('/payments/:txnRef', stripeController.getPayment);
router.post('/sync/:sessionId', stripeController.syncCheckout);
router.post('/cancel', stripeController.cancelCheckout);
router.post('/checkout', stripeController.createCheckout);

module.exports = router;
