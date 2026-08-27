const express = require('express');
const router = express.Router();
const controller = require('../controllers/prescriptionController');
const { authenticateToken } = require('../middlewares/auth');

// Special routes (before parameterized routes)
router.get('/pending', authenticateToken, controller.getPending);

// CRUD
router.post('/', authenticateToken, controller.create);
router.get('/', authenticateToken, controller.getAll);
router.get('/:id', authenticateToken, controller.getById);
router.put('/:id/status', authenticateToken, controller.updateStatus);

module.exports = router;
