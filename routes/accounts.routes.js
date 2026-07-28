const express = require("express");
const AccountsController = require("../controllers/accounts/accounts.controller");
const billingController = require("../controllers/accounts/billing.controller");
const receiptController = require("../controllers/accounts/receipt.controller");

const router = express.Router();

// Accounts endpoints
router.get("/outstanding", AccountsController.getOutstandingPayments);
router.get("/nhia-claims", AccountsController.getNHIAClaims);
router.get("/department-revenue", AccountsController.getDepartmentRevenue);
router.get("/service-type-revenue", AccountsController.getServiceTypeRevenue);
router.get("/staff-billing", AccountsController.getStaffBilling);
router.get("/aging-report", AccountsController.getAgingReport);
router.get("/dashboard", AccountsController.getDashboard);

router.get("/daily-cash-flow", AccountsController.getDailyCashFlow);
router.get("/report", AccountsController.getAccountsReport);

router.get("/patient-collections/:visit_id", AccountsController.getPatientCollections);
router.patch("/bills/mark-payment/:bill_id", AccountsController.markBillAsPaid);
router.patch("/invoices/pay/:invoice_id", AccountsController.payInvoice);

// Receipt endpoints
router.post("/receipts/generate/:invoice_id", receiptController.generateReceipt);
router.post("/receipts/:receipt_id/send-sms", receiptController.sendReceiptSMS);
router.get("/receipts", receiptController.getInstitutionReceipts);
router.get("/receipts/:token/view", receiptController.viewReceipt);
router.get("/receipts/:token", receiptController.getReceiptByToken);

// Patient Billing - NEW ENDPOINTS
router.get("/patients-billing", billingController.getAllPatientsWithBillingSummary);
router.get("/patients-billing/:patient_id", billingController.getPatientBillingHistory);
router.post("/patients-billing/:patient_id/payment", billingController.makePatientPayment);

module.exports = router;
