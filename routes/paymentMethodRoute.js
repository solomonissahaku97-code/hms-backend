const express = require('express');
const router = express.Router();
const paymentMethodController = require('../controllers/paymentMethodController');
const paymentController = require('../controllers/paymentController');


router.get('/stats/summary', paymentController.getPaymentStats);


router.post('/payment-gateways', paymentMethodController.createPaymentGateWay);
router.get('/payment-gateways', paymentMethodController.getPaymentGateWays);
router.delete('/payment-gateways/:id', paymentMethodController.deletePaymentGateWay);



router.post('/payment-methods', paymentMethodController.createPaymentMethod);
router.get('/payment-methods', paymentMethodController.getPaymentMethods);
router.get('/payment-methods/:id', paymentMethodController.getPaymentMethodById);
router.delete('/payment-methods', paymentMethodController.deletePaymentMethod);

module.exports = router; 
