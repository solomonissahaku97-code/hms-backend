const express = require('express');
const router = express.Router();
const adminMiddleWare = require('../middlewares/adminMiddleware')
const staffMiddleWare = require('../middlewares/authMiddlewares')
const eitherAdminOrStaff = require('../middlewares/eitherAuthOrAdminMiddleware')
const { createService, getAllServices, updateService, deleteService, createPatientInvoice, getPatientInvoices, updatePatientInvoice, deletePatientInvoice, makePatientPayment, sendInvoiceToPatient } = require('../controllers/serviceBillController')
const { getBillingStatistics } = require('../controllers/billingsStatistics')

router.post('/create-service', adminMiddleWare, createService)
router.put('/service/:id', adminMiddleWare, updateService)
router.delete('/service/:id', adminMiddleWare, deleteService)
router.get('/service/institution', eitherAdminOrStaff, getAllServices)

router.post('/invoices', staffMiddleWare, createPatientInvoice);
router.get('/invoices/patient', staffMiddleWare, getPatientInvoices);
router.put('/invoices/:invoice_id', staffMiddleWare, updatePatientInvoice);
router.put('/invoices/patient/make-payments', staffMiddleWare, makePatientPayment)
router.delete('/invoices/delete-invoice', staffMiddleWare, deletePatientInvoice);
router.get('/bills/statistics', getBillingStatistics)

// send email to patient
router.post('/invoice/send-mail', staffMiddleWare, sendInvoiceToPatient)

module.exports = router;
