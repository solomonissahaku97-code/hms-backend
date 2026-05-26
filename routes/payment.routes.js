const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Create a new payment
router.post('/', paymentController.createPayment);

// Get payments for an invoice
router.get('/invoice/:invoice_id', paymentController.getInvoicePayments);

// Get payments for a patient
router.get('/patient/:patient_id', paymentController.getPatientPayments);

// Get a single payment
router.get('/:payment_id', paymentController.getPayment);

// Apply NHIS claim payment
router.post('/claim/:claim_id/nhis', paymentController.applyNhisClaimPayment);

// Refund a payment
router.post('/:payment_id/refund', paymentController.refundPayment);

// Get payment statistics
router.get('/stats/summary', paymentController.getPaymentStats);

// Verify payment with external gateway
router.post('/verify', paymentController.verifyPayment);

module.exports = router;

