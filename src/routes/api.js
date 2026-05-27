'use strict';

const { Router } = require('express');
const apiController = require('../controllers/apiController');

const router = Router();

router.get('/health',               apiController.getHealth);
router.post('/orders',              apiController.createOrder);
router.get('/transactions',         apiController.listTransactions);
router.get('/transactions/:txnRef', apiController.getTransaction);

module.exports = router;
