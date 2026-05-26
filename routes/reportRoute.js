const express = require('express');
const router = express.Router();
const { createReportProblem } = require('../controllers/reportProblemController');
const multer = require('multer');

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

router.post('/report-problem', upload.single('screenshot'), createReportProblem);

module.exports = router;
