const express = require('express');
const router = express.Router();

const authenticateToken = require('../middlewares/authMiddlewares');
const { getPatientLabs } = require('../controllers/lab/patientLabController');

// Patient should be identified by query parameter
router.get('/patient-labs', authenticateToken, getPatientLabs);

module.exports = router;

