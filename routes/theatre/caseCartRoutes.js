const express = require('express');
const router = express.Router();
const caseCartController = require('../../controllers/theatre/caseCartController');

// ==================== Case Cart CRUD ====================
// Create a new Case Cart
router.post('/case-carts', caseCartController.createCaseCart);
// Get all Case Carts (with optional filters)
router.get('/case-carts', caseCartController.getAllCaseCarts);
// Get Case Cart by ID
router.get('/case-carts/statistics', caseCartController.getCaseCartStatistics);
router.get('/case-carts/:id', caseCartController.getCaseCartById);
// Update Case Cart
router.put('/case-carts/:id', caseCartController.updateCaseCart);
// Delete Case Cart
router.delete('/case-carts/:id', caseCartController.deleteCaseCart);

// ==================== Case Cart Items ====================
// Add item to Case Cart
router.post('/case-carts/:case_cart_id/items', caseCartController.addItem);
// Update item status
router.patch('/case-carts/items/:item_id/status', caseCartController.updateItemStatus);
// Delete item from Case Cart
router.delete('/case-carts/items/:item_id', caseCartController.deleteItem);

// ==================== Case Cart Actions ====================
// Confirm Case Cart
router.patch('/case-carts/:id/confirm', caseCartController.confirmCaseCart);
// Mark Case Cart as Used
router.patch('/case-carts/:id/use', caseCartController.markAsUsed);

module.exports = router;

