const express = require('express');
const router = express.Router();

const aiController = require('../controllers/AI/aiController.controller');

// Generate AI Patient Summary
// GET /api/v1/ai/patient-summary/:visitId
router.get('/patient-summary/:visitId', aiController.generatePatientSummary);

module.exports = router;

