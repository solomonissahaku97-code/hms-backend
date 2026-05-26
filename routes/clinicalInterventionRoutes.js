const express = require('express');
const router = express.Router();
const clinicalInterventionController = require('../controllers/pharmacy/clinicalInterventionController');
const authenticateToken = require('../middlewares/eitherAuthOrAdminMiddleware');

// CRUD routes
router.post('/', authenticateToken, clinicalInterventionController.createIntervention);
router.get('/', authenticateToken, clinicalInterventionController.getAllInterventions);
router.get('/:id', authenticateToken, clinicalInterventionController.getInterventionById);
router.put('/:id', authenticateToken, clinicalInterventionController.updateIntervention);
router.delete('/:id', authenticateToken, clinicalInterventionController.deleteIntervention);

// Specialized routes
router.get('/prescription/:prescription_id', authenticateToken, clinicalInterventionController.getInterventionsByPrescription);
router.patch('/:id/response', authenticateToken, clinicalInterventionController.updatePrescriberResponse);

module.exports = router;