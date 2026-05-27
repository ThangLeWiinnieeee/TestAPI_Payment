'use strict';

const { Router } = require('express');
const momoController = require('../controllers/momoController');

const router = Router();

router.get('/payments/:txnRef', momoController.getPayment);
router.post('/create', momoController.createPayment);
router.post('/ipn', momoController.handleIpn);
router.get('/return', momoController.handleReturn);

module.exports = router;
