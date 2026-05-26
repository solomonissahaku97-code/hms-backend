const express = require('express');
const router = express.Router();
const equipmentController = require('../../controllers/theatre/equipmentController');

// CRUD Routes
router.post('/equipment', equipmentController.createEquipment);
router.get('/equipment', equipmentController.getAllEquipment);
router.get('/equipment/statistics', equipmentController.getEquipmentStatistics);
router.get('/equipment/maintenance', equipmentController.getEquipmentNeedingMaintenance);
router.get('/equipment/:id', equipmentController.getEquipmentById);
router.put('/equipment/:id', equipmentController.updateEquipment);
router.delete('/equipment/:id', equipmentController.deleteEquipment);

// Equipment Operations
router.patch('/equipment/:id/transfer', equipmentController.transferEquipment);
router.patch('/equipment/:id/maintenance', equipmentController.scheduleMaintenance);

module.exports = router;

