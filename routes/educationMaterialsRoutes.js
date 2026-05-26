const express = require('express');
const router = express.Router();
const educationController = require('../controllers/theatre/educationMaterialsController/educationMaterialsController');
const patientAllergiesController = require('../controllers/theatre/educationMaterialsController/patientAllergiesController');

// Create or get
router.post('/fetch-or-create', educationController.createOrGetEducationMaterials);
// CRUD routes
router.post('/', patientAllergiesController.createAllergy);
router.get('/', patientAllergiesController.getAllAllergies);
router.get('/:id', patientAllergiesController.getAllergyById);
router.put('/:id', patientAllergiesController.updateAllergy);
router.delete('/:id', patientAllergiesController.deleteAllergy);

// Update
router.put('/:id', educationController.updateEducationMaterials);

module.exports = router;
