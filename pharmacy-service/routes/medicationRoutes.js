const express = require('express');
const router = express.Router();
const controller = require('../controllers/medicationController');
const { authenticateToken } = require('../middlewares/auth');

// GET /medications/categories - must come before /:id
router.get('/categories', authenticateToken, controller.getCategories);

// CRUD
router.get('/', authenticateToken, controller.getAll);
router.get('/:id', authenticateToken, controller.getById);
router.post('/', authenticateToken, controller.create);
router.put('/:id', authenticateToken, controller.update);
router.delete('/:id', authenticateToken, controller.deactivate);

module.exports = router;
