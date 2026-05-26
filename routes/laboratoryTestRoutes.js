const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddlewares');
const { upload, uploadToLocal } = require('../middlewares/profile_multer');
const {
   
    uploadLabResult,
    requestLab,
    getLabTest,
    getPatientLabResults,
    acceptLabRequest,
    cancelLabRequest,
    getLabResultsByStatus,
    getLabStatistics
    
    
} = require('../controllers/laboratoryTest');

// Route to get all tests
router.get('/test', authenticateToken, getLabTest);

// Route to make lab request
router.post('/request',authenticateToken, requestLab);

// Route to get lab requests by institution and patient
router.get('/labrequests/institution/lab-request', authenticateToken, getPatientLabResults);
router.get('/lab-results/by-status',authenticateToken,getLabResultsByStatus)
// Route to upload lab results (with image upload to Firebase)
router.put(
    '/institution/uploadResults',
    upload.single('testImage'), // Parse the file
    uploadToLocal('testImage'), // Upload to Firebase
    authenticateToken, // Authenticate the request
    uploadLabResult // Process the request in the controller
);

router.put('/cancel', authenticateToken, cancelLabRequest);
router.put('/accept',authenticateToken, acceptLabRequest)
router.get('/statistics',authenticateToken,getLabStatistics)


module.exports = router;
