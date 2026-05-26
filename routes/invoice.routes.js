// routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/accounts/invoice.controller');
const serviceBillController = require('../controllers/accounts/service.controller');
const billingController = require('../controllers/accounts/billing.controller');

// Invoice routes
router.post('/invoices', invoiceController.createInvoice);
router.get('/invoices', invoiceController.getInvoices);
router.get('/invoices/visit', invoiceController.getInvoiceByVisitId);
router.put('/invoices/:id', invoiceController.updateInvoice);
router.delete('/invoices/:id', invoiceController.deleteInvoice);

// Service bill routes
router.post('/service-bills', serviceBillController.createServiceBill);
router.get('/visits/:visit_id/service-bills', serviceBillController.getServiceBillsByVisit);
router.put('/service-bills/:id', serviceBillController.updateServiceBill);

// Billing dashboard routes
router.get('/invoice/billing/stats', billingController.getBillingStats);
router.get('/invoice/billing/recent-transactions', billingController.getRecentTransactions);

module.exports = router;