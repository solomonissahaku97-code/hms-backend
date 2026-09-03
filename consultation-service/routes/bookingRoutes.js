const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const booking = require('../controllers/bookingController');

// ── Patient-Facing Booking Flow ────────────────────────────────

// Step 1: Get institutions with consultation services
router.get('/institutions', authenticate, booking.getInstitutions);

// Step 2: Get consultation departments at an institution
router.get('/institution/:institutionId/departments', authenticate, booking.getDepartments);

// Step 3: Get doctors at institution/department
router.get('/institution/:institutionId/department/:departmentId/doctors', authenticate, booking.getDoctors);

// Step 4: Get available dates for a doctor
router.get('/available-dates', authenticate, booking.getAvailableDates);

// Step 5: Get doctor availability schedule
router.get('/institution/:institutionId/department/:departmentId/availability', authenticate, booking.getDoctorAvailability);

// Step 6: Get available time slots for a specific date
router.get('/doctor/:doctorId/slots', authenticate, booking.getAvailableSlots);

// ── Appointment Management ──────────────────────────────────────

// Create appointment (the main booking endpoint)
router.post('/appointments', authenticate, booking.createAppointment);

// Get patient's own appointments
router.get('/appointments', authenticate, booking.getPatientAppointments);

// Get single appointment detail
router.get('/appointments/:id', authenticate, booking.getAppointmentDetail);

// Cancel appointment
router.patch('/appointments/:id/cancel', authenticate, booking.cancelAppointment);

// Reschedule appointment
router.patch('/appointments/:id/reschedule', authenticate, booking.rescheduleAppointment);

// ── Doctor Availability Management ──────────────────────────────

// Create availability slot
router.post('/doctor/availability', authenticate, booking.createAvailability);

// Get availability for a doctor
router.get('/doctor/availability', authenticate, booking.getMyAvailability);

// Update availability
router.patch('/doctor/availability/:id', authenticate, booking.updateAvailability);

// Delete/deactivate availability
router.delete('/doctor/availability/:id', authenticate, booking.deleteAvailability);

module.exports = router;
