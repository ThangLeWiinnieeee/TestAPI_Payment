'use strict';

const { Router } = require('express');
const paymentController = require('../controllers/paymentController');

const router = Router();

router.post('/create', paymentController.createPayment);
router.get('/ipn', paymentController.handleIpn);
router.get('/return', paymentController.handleReturn);

module.exports = router;
