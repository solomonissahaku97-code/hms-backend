const express = require('express');
const router = express.Router();
const { createReportProblem } = require('../controllers/reportProblemController');
const { upload } = require('../middlewares/storage');

router.post('/report-problem', upload.single('screenshot'), createReportProblem);

module.exports = router;
