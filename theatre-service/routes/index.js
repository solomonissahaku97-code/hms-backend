const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const booking = require('../controllers/bookingController');
const or = require('../controllers/orController');
const caseCart = require('../controllers/caseCartController');
const preOp = require('../controllers/preOpController');
const equipment = require('../controllers/equipmentController');

// ── Theatre Bookings (Surgery Lifecycle) ────────────────────────
router.post('/bookings', authenticate, booking.createBooking);
router.get('/bookings', authenticate, booking.getAllBookings);
router.get('/bookings/upcoming', authenticate, booking.getUpcomingSurgeries);
router.get('/bookings/stats', authenticate, booking.getStatistics);
router.get('/bookings/:id', authenticate, booking.getBookingById);
router.put('/bookings/:id', authenticate, booking.updateBooking);
router.delete('/bookings/:id/cancel', authenticate, booking.cancelBooking);
router.put('/bookings/:id/start', authenticate, booking.startSurgery);
router.put('/bookings/:id/complete', authenticate, booking.completeSurgery);
router.put('/bookings/:id/discharge', authenticate, booking.dischargeFromRecovery);
router.get('/bookings/:id/status', authenticate, booking.getSurgeryStatus);

// ── Operating Rooms ─────────────────────────────────────────────
router.post('/rooms', authenticate, or.createRoom);
router.get('/rooms', authenticate, or.getAllRooms);
router.get('/rooms/availability', authenticate, or.getRoomAvailability);
router.get('/rooms/stats', authenticate, or.getORStatistics);
router.get('/rooms/:id', authenticate, or.getRoomById);
router.put('/rooms/:id', authenticate, or.updateRoom);
router.delete('/rooms/:id', authenticate, or.deleteRoom);
router.put('/rooms/:id/status', authenticate, or.updateRoomStatus);

// ── Case Carts ──────────────────────────────────────────────────
router.post('/case-carts', authenticate, caseCart.createCaseCart);
router.get('/case-carts', authenticate, caseCart.getAllCaseCarts);
router.get('/case-carts/:id', authenticate, caseCart.getCaseCartById);
router.put('/case-carts/:id', authenticate, caseCart.updateCaseCart);
router.delete('/case-carts/:id', authenticate, caseCart.deleteCaseCart);
router.post('/case-carts/:case_cart_id/items', authenticate, caseCart.addItem);
router.put('/case-carts/items/:item_id/status', authenticate, caseCart.updateItemStatus);
router.delete('/case-carts/items/:item_id', authenticate, caseCart.deleteItem);
router.put('/case-carts/:id/confirm', authenticate, caseCart.confirmCaseCart);
router.put('/case-carts/:id/mark-used', authenticate, caseCart.markAsUsed);

// ── Pre-Op Checklists ───────────────────────────────────────────
router.post('/pre-op', authenticate, preOp.createOrGetChecklist);
router.put('/pre-op/:id', authenticate, preOp.updateChecklist);
router.get('/pre-op/visit/:visit_id', authenticate, preOp.getChecklistByVisit);
router.get('/pre-op/template', authenticate, preOp.getTemplate);

// ── Equipment ───────────────────────────────────────────────────
router.post('/equipment', authenticate, equipment.createEquipment);
router.get('/equipment', authenticate, equipment.getAllEquipment);
router.get('/equipment/maintenance', authenticate, equipment.getNeedingMaintenance);
router.get('/equipment/stats', authenticate, equipment.getStatistics);
router.get('/equipment/:id', authenticate, equipment.getEquipmentById);
router.put('/equipment/:id', authenticate, equipment.updateEquipment);
router.delete('/equipment/:id', authenticate, equipment.deleteEquipment);
router.put('/equipment/:id/transfer', authenticate, equipment.transferEquipment);
router.put('/equipment/:id/maintenance', authenticate, equipment.scheduleMaintenance);

module.exports = router;
