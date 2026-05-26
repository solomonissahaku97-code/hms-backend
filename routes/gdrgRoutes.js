const express = require('express');
const router = express.Router();
const {
  addManualMapping,
  deleteManualMapping,
  getAllMappings,
  updateManualMapping
} = require('../controllers/claims/icd10ToGdrgController');
const gdrgCodeController = require('../controllers/claims/dgrg_codes_controller');

// ICD-10 to GDRG Mappings Routes
router.post('/icd10-gdrg-mappings', addManualMapping);
router.get('/icd10-gdrg-mappings', getAllMappings);
router.put('/icd10-gdrg-mappings/:gdrg_code', updateManualMapping);
router.delete('/icd10-gdrg-mappings/:gdrg_code', deleteManualMapping);


// GDRG Codes Routes
router.get('/gdrg-codes', gdrgCodeController.getAllGDRGCodes);
router.get('/gdrg-codes/:id', gdrgCodeController.getGDRGCodeByCode);
router.post('/gdrg-codes', gdrgCodeController.createGDRGCode);
router.put('/gdrg-codes/:id', gdrgCodeController.updateGDRGCode);
router.delete('/gdrg-codes/:id', gdrgCodeController.deleteGDRGCode);

module.exports = router;