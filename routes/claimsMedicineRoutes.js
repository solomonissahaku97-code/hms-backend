const express = require('express');
const router = express.Router();
const controller = require('../controllers/claims/medicineController');

router.post('/', controller.createNHIAMedication);
router.get('/', controller.getAllNHIAMedications);
router.get('/:name', controller.getNHIAMedicationByName);
router.put('/:code', controller.updateNHIAMedication);
router.delete('/:code', controller.deleteNHIAMedication);

module.exports = router;
