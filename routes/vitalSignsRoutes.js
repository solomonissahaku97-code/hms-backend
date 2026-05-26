const express = require('express');
const router = express.Router();
const vitalSignsController = require('../controllers/vitalSignsController');
const authenticateToken = require('../middlewares/eitherAuthOrAdminMiddleware');

// Create a new vital signs record
router.post('/patient/create-vitals',authenticateToken, vitalSignsController.createVitalSignsRecord);

// Get all vital signs records for an institution
// router.get('/:institutionId',authenticateToken, vitalSignsController.getAllVitalSigns);

// Get a single vital signs record by ID and institution IDdepartment_id
// router.get('/institution/:institution_id/:patient_id/patients/department/:department_id',authenticateToken, vitalSignsController.getVitalSignByPatientId);

// GET ALL VITALS BY INSTITUTION AND PATIENT
router.get('/institution/patient/vitals', authenticateToken, vitalSignsController.getAllVitalSignsRecords)

// get vitals by patient id
router.get('/vital-signs/:id', authenticateToken, vitalSignsController.getVitalSignsRecordById);


// Update a vital signs record by ID and institution ID
router.put('/institutionId/patient/update-vitals/:id',authenticateToken, vitalSignsController.updateVitalSignsRecord);


router.get('/institutions/patient/delete-vitals/:id', authenticateToken, vitalSignsController.deleteVitalSignsRecord);


 

// Delete a vital signs record by ID and institution ID
// router.delete('/:institutionId/:id',authenticateToken, vitalSignsController.deleteVitalSign);

module.exports = router;