// routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/accounts/invoice.controller');
const serviceBillController = require('../controllers/accounts/service.controller');
const billingController = require('../controllers/accounts/billing.controller');
const authenticateToken = require('../middlewares/authMiddlewares');

// Invoice routes
// POST /invoices is the canonical generic Service billing path (handleBilling).
// Auth is required so the institution is resolved from the authenticated user.
router.post('/invoices', authenticateToken, invoiceController.createInvoice);
router.get('/invoices', invoiceController.getInvoices);
router.get('/invoices/visit', invoiceController.getInvoiceByVisitId);
router.put('/invoices/:id', invoiceController.updateInvoice);
router.delete('/invoices/:id', invoiceController.deleteInvoice);

// Invoice sharing and SMS routes
router.post('/invoices/:id/generate-token', invoiceController.generateInvoiceToken);
router.post('/invoices/:id/send-sms', invoiceController.sendInvoiceSMS);
router.get('/invoices/token/:token', invoiceController.getInvoiceByToken);
router.get('/invoices/:token/view', invoiceController.viewInvoiceByToken);

// Service bill routes
router.post('/service-bills', serviceBillController.createServiceBill);
router.get('/visits/:visit_id/service-bills', serviceBillController.getServiceBillsByVisit);
router.put('/service-bills/:id', serviceBillController.updateServiceBill);

// Billing dashboard routes
router.get('/invoice/billing/stats', billingController.getBillingStats);
router.get('/invoice/billing/recent-transactions', billingController.getRecentTransactions);

module.exports = router;