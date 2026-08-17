const express = require('express');
const router = express.Router();
const adminMiddleWare = require('../middlewares/adminMiddleware')
const staffMiddleWare = require('../middlewares/authMiddlewares')
const eitherAdminOrStaff = require('../middlewares/eitherAuthOrAdminMiddleware')
const { createService, getAllServices, updateService, deleteService, getPatientInvoices, updatePatientInvoice, deletePatientInvoice, makePatientPayment, sendInvoiceToPatient } = require('../controllers/serviceBillController')
const { getBillingStatistics } = require('../controllers/billingsStatistics')

router.post('/create-service', adminMiddleWare, createService)
router.put('/service/:id', adminMiddleWare, updateService)
router.delete('/service/:id', adminMiddleWare, deleteService)
router.get('/service/institution', eitherAdminOrStaff, getAllServices)

// NOTE: POST /invoices is handled exclusively by routes/invoice.routes.js ->
// invoiceController.createInvoice (the canonical generic Service billing path
// via handleBilling). The old createPatientInvoice handler was shadowed by
// that route and performed a raw ServiceBill.create without a visit_id, so it
// was removed to avoid two competing implementations.
router.get('/invoices/patient', staffMiddleWare, getPatientInvoices);
router.put('/invoices/:invoice_id', staffMiddleWare, updatePatientInvoice);
router.put('/invoices/patient/make-payments', staffMiddleWare, makePatientPayment)
router.delete('/invoices/delete-invoice', staffMiddleWare, deletePatientInvoice);
router.get('/bills/statistics', getBillingStatistics)

// send email to patient
router.post('/invoice/send-mail', staffMiddleWare, sendInvoiceToPatient)

module.exports = router;
