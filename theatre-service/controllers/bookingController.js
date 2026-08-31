const { TheatrePatient, OperatingRoom } = require('../models');
const { Op } = require('sequelize');

// ── Create Theatre Booking ──────────────────────────────────────
exports.createBooking = async (req, res) => {
  try {
    const {
      visit_id, patient_id, institution_id, procedure_ids, procedure_names, scheduled_date, scheduled_time,
      estimated_duration, room_id, surgeon_id, anaesthetist_id, scrub_nurse_id,
      circulating_nurse_id, diagnosis_id, diagnosis_names, notes, pre_op_notes,
      is_emergency
    } = req.body;

    const inst_id = institution_id || req.headers['x-service-institution-id'] || req.user?.institution_id;
    if (!visit_id) return res.status(400).json({ error: 'visit_id is required' });
    if (!procedure_ids || !Array.isArray(procedure_ids)) return res.status(400).json({ error: 'procedure_ids must be an array' });

    // Check room availability
    if (room_id && scheduled_date && scheduled_time) {
      const conflicting = await TheatrePatient.findOne({
        where: {
          room_id, scheduled_date, scheduled_time,
          status: { [Op.notIn]: ['completed', 'cancelled', 'postponed'] }
        }
      });
      if (conflicting) return res.status(400).json({ error: 'Room is already booked at this time' });
    }

    // Check staff availability
    const staffIds = [surgeon_id, anaesthetist_id, scrub_nurse_id, circulating_nurse_id].filter(Boolean);
    if (staffIds.length > 0 && scheduled_date && scheduled_time) {
      const conflictStaff = await TheatrePatient.findOne({
        where: {
          [Op.or]: [
            { surgeon_id: { [Op.in]: staffIds } },
            { anaesthetist_id: { [Op.in]: staffIds } },
            { scrub_nurse_id: { [Op.in]: staffIds } },
            { circulating_nurse_id: { [Op.in]: staffIds } }
          ],
          scheduled_date, scheduled_time,
          status: { [Op.notIn]: ['completed', 'cancelled', 'postponed'] }
        }
      });
      if (conflictStaff) return res.status(400).json({ error: 'One or more staff members already assigned at this time' });
    }

    const booking = await TheatrePatient.create({
      visit_id, patient_id: patient_id || null, institution_id: inst_id || null,
      procedure_ids: procedure_ids || [], procedure_names: procedure_names || [],
      scheduled_date, scheduled_time, estimated_duration, room_id, surgeon_id,
      anaesthetist_id, scrub_nurse_id, circulating_nurse_id,
      diagnosis_id: diagnosis_id || [], diagnosis_names: diagnosis_names || [],
      notes, pre_op_notes, is_emergency: is_emergency || false, status: 'scheduled'
    });

    // Update room status
    if (room_id) {
      await OperatingRoom.update(
        { status: 'occupied', current_patient_id: visit_id, current_booking_id: booking.id },
        { where: { id: room_id } }
      );
    }

    res.status(201).json({ message: 'Booking created', data: booking });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking', details: err.message });
  }
};

// ── Get All Bookings ────────────────────────────────────────────
exports.getAllBookings = async (req, res) => {
  try {
    const { status, date, surgeon_id, room_id, start_date, end_date } = req.query;
    const inst_id = req.headers['x-service-institution-id'] || req.user?.institution_id;
    const where = {};

    if (inst_id) where.institution_id = inst_id;
    if (status) where.status = status;
    if (surgeon_id) where.surgeon_id = surgeon_id;
    if (room_id) where.room_id = room_id;
    if (start_date && end_date) {
      where.scheduled_date = { [Op.between]: [new Date(start_date), new Date(end_date)] };
    } else if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      where.scheduled_date = { [Op.between]: [start, end] };
    }

    const bookings = await TheatrePatient.findAll({
      where, include: [{ model: OperatingRoom, as: 'operatingRoom', attributes: ['id', 'room_number', 'room_name', 'room_type'] }],
      order: [['scheduled_date', 'ASC'], ['scheduled_time', 'ASC']]
    });

    res.json({ message: 'Bookings fetched', data: bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings', details: err.message });
  }
};

// ── Get Booking By ID ───────────────────────────────────────────
exports.getBookingById = async (req, res) => {
  try {
    const booking = await TheatrePatient.findByPk(req.params.id, {
      include: [{ model: OperatingRoom, as: 'operatingRoom' }]
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ data: booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch booking', details: err.message });
  }
};

// ── Update Booking ──────────────────────────────────────────────
exports.updateBooking = async (req, res) => {
  try {
    const booking = await TheatrePatient.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (['intra-operation', 'post-operation', 'completed'].includes(booking.status)) {
      return res.status(400).json({ error: 'Cannot update booking while surgery is in progress or completed' });
    }

    // If changing room, check availability
    if (req.body.room_id && req.body.room_id !== booking.room_id) {
      const conflict = await TheatrePatient.findOne({
        where: {
          room_id: req.body.room_id, scheduled_date: booking.scheduled_date,
          scheduled_time: booking.scheduled_time,
          status: { [Op.notIn]: ['completed', 'cancelled', 'postponed'] },
          id: { [Op.ne]: req.params.id }
        }
      });
      if (conflict) return res.status(400).json({ error: 'New room already booked at this time' });

      // Free old room, occupy new
      if (booking.room_id) {
        await OperatingRoom.update({ status: 'available', current_patient_id: null, current_booking_id: null }, { where: { id: booking.room_id } });
        await OperatingRoom.update({ status: 'occupied', current_patient_id: booking.visit_id, current_booking_id: req.params.id }, { where: { id: req.body.room_id } });
      }
    }

    await booking.update(req.body);
    res.json({ message: 'Booking updated', data: booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking', details: err.message });
  }
};

// ── Cancel Booking ──────────────────────────────────────────────
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await TheatrePatient.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'intra-operation') return res.status(400).json({ error: 'Cannot cancel surgery in progress' });

    await booking.update({ status: 'cancelled', cancellation_reason: req.body.cancellation_reason, cancellation_by: req.body.cancellation_by });

    // Free room
    if (booking.room_id) {
      await OperatingRoom.update({ status: 'available', current_patient_id: null, current_booking_id: null }, { where: { id: booking.room_id } });
    }

    res.json({ message: 'Booking cancelled', data: booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel booking', details: err.message });
  }
};

// ── Surgery Lifecycle ───────────────────────────────────────────

exports.startSurgery = async (req, res) => {
  try {
    const booking = await TheatrePatient.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!['scheduled', 'pre-operation'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot start from status: ${booking.status}` });
    }

    await booking.update({ status: 'intra-operation', actual_start_time: booking.actual_start_time || new Date() });

    if (booking.room_id) {
      await OperatingRoom.update({ status: 'occupied' }, { where: { id: booking.room_id } });
    }

    res.json({ message: 'Surgery started', data: booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start surgery', details: err.message });
  }
};

exports.completeSurgery = async (req, res) => {
  try {
    const booking = await TheatrePatient.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'intra-operation') return res.status(400).json({ error: 'Surgery not in progress' });

    const { outcome, notes, blood_loss_ml, complications, specimens_collected, implants_used } = req.body;

    await booking.update({
      status: 'post-operation', actual_end_time: new Date(), outcome,
      post_op_notes: notes, blood_loss_ml, complications, specimens_collected,
      implants_used: implants_used || []
    });

    res.json({ message: 'Surgery completed', data: booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete surgery', details: err.message });
  }
};

exports.dischargeFromRecovery = async (req, res) => {
  try {
    const booking = await TheatrePatient.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'post-operation') return res.status(400).json({ error: 'Patient not in recovery' });

    await booking.update({ status: 'completed', discharge_date: new Date(), discharge_condition: req.body.discharge_condition });

    // Free room → cleaning
    if (booking.room_id) {
      await OperatingRoom.update({ status: 'cleaning', current_patient_id: null, current_booking_id: null }, { where: { id: booking.room_id } });
    }

    res.json({ message: 'Patient discharged from recovery', data: booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to discharge', details: err.message });
  }
};

exports.getSurgeryStatus = async (req, res) => {
  try {
    const booking = await TheatrePatient.findByPk(req.params.id, {
      include: [{ model: OperatingRoom, as: 'operatingRoom', attributes: ['id', 'room_number', 'room_name', 'room_type'] }]
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    let surgeryDuration = null;
    if (booking.actual_start_time && booking.status === 'intra-operation') {
      surgeryDuration = Math.floor((Date.now() - new Date(booking.actual_start_time)) / 1000);
    } else if (booking.actual_start_time && booking.actual_end_time) {
      surgeryDuration = Math.floor((new Date(booking.actual_end_time) - new Date(booking.actual_start_time)) / 1000);
    }

    res.json({
      data: {
        ...booking.toJSON(), surgeryDuration,
        canStart: ['scheduled', 'pre-operation'].includes(booking.status),
        canComplete: booking.status === 'intra-operation'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status', details: err.message });
  }
};

// ── Dashboard / Stats ───────────────────────────────────────────

exports.getUpcomingSurgeries = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const inst_id = req.headers['x-service-institution-id'] || req.user?.institution_id;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(); end.setDate(end.getDate() + parseInt(days));

    const where = {
      scheduled_date: { [Op.between]: [today, end] },
      status: { [Op.in]: ['scheduled', 'pre-operation'] }
    };
    if (inst_id) where.institution_id = inst_id;

    const bookings = await TheatrePatient.findAll({
      where,
      include: [{ model: OperatingRoom, as: 'operatingRoom', attributes: ['id', 'room_number', 'room_name'] }],
      order: [['scheduled_date', 'ASC'], ['scheduled_time', 'ASC']]
    });

    res.json({ data: bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch upcoming', details: err.message });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const inst_id = req.headers['x-service-institution-id'] || req.user?.institution_id;
    const dateFilter = {};
    if (inst_id) dateFilter.institution_id = inst_id;

    if (start_date && end_date) {
      dateFilter.scheduled_date = { [Op.between]: [new Date(start_date), new Date(end_date)] };
    } else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      dateFilter.scheduled_date = { [Op.between]: [today, endOfMonth] };
    }

    const total = await TheatrePatient.count({ where: dateFilter });
    const statusCounts = await TheatrePatient.findAll({
      where: dateFilter,
      attributes: ['status', [TheatrePatient.sequelize.fn('COUNT', TheatrePatient.sequelize.col('status')), 'count']],
      group: ['status'], raw: true
    });

    const completedSurgeries = await TheatrePatient.findAll({
      where: { ...dateFilter, status: 'completed', actual_start_time: { [Op.ne]: null }, actual_end_time: { [Op.ne]: null } },
      attributes: ['actual_start_time', 'actual_end_time']
    });

    let avgDuration = 0;
    if (completedSurgeries.length > 0) {
      const totalDuration = completedSurgeries.reduce((sum, s) => sum + (new Date(s.actual_end_time) - new Date(s.actual_start_time)), 0);
      avgDuration = Math.round(totalDuration / completedSurgeries.length / 60000);
    }

    const stats = { total, completed: 0, cancelled: 0, postponed: 0, 'intra-operation': 0, scheduled: 0, average_duration_minutes: avgDuration };
    statusCounts.forEach(item => { stats[item.status] = parseInt(item.count); });

    res.json({ data: stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
};
