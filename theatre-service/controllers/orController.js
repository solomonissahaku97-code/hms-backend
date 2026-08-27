const { OperatingRoom, TheatrePatient } = require('../models');
const { Op } = require('sequelize');

// ── CRUD ────────────────────────────────────────────────────────

exports.createRoom = async (req, res) => {
  try {
    const { room_number, room_name, room_type, capacity, department_id, floor, building, is_emergency_available, notes } = req.body;
    if (!room_number) return res.status(400).json({ error: 'room_number is required' });

    const existing = await OperatingRoom.findOne({ where: { room_number } });
    if (existing) return res.status(400).json({ error: 'Room number already exists' });

    const room = await OperatingRoom.create({ room_number, room_name, room_type: room_type || 'general', capacity: capacity || 1, department_id, floor, building, is_emergency_available: is_emergency_available !== false, notes, status: 'available' });
    res.status(201).json({ message: 'Room created', data: room });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room', details: err.message });
  }
};

exports.getAllRooms = async (req, res) => {
  try {
    const { status, room_type, floor, available } = req.query;
    const where = {};
    if (status) where.status = status;
    if (room_type) where.room_type = room_type;
    if (floor) where.floor = floor;
    if (available === 'true') where.status = 'available';

    const rooms = await OperatingRoom.findAll({ where, order: [['room_number', 'ASC']] });
    res.json({ data: rooms });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rooms', details: err.message });
  }
};

exports.getRoomById = async (req, res) => {
  try {
    const room = await OperatingRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ data: room });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch room', details: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const room = await OperatingRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (req.body.room_number && req.body.room_number !== room.room_number) {
      const dup = await OperatingRoom.findOne({ where: { room_number: req.body.room_number } });
      if (dup) return res.status(400).json({ error: 'Room number already exists' });
    }

    await room.update(req.body);
    res.json({ message: 'Room updated', data: room });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update room', details: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const room = await OperatingRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'occupied') return res.status(400).json({ error: 'Cannot delete occupied room' });

    await room.destroy();
    res.json({ message: 'Room deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete room', details: err.message });
  }
};

// ── Status & Availability ───────────────────────────────────────

exports.updateRoomStatus = async (req, res) => {
  try {
    const room = await OperatingRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { status, current_patient_id, current_booking_id } = req.body;

    const validTransitions = {
      'available': ['occupied', 'cleaning', 'maintenance', 'out_of_service'],
      'occupied': ['cleaning'], 'cleaning': ['available', 'maintenance'],
      'maintenance': ['available', 'out_of_service'], 'out_of_service': ['maintenance']
    };

    if (!validTransitions[room.status]?.includes(status)) {
      return res.status(400).json({ error: `Invalid transition from ${room.status} to ${status}` });
    }

    await room.update({
      status,
      current_patient_id: status === 'available' ? null : current_patient_id,
      current_booking_id: status === 'available' ? null : current_booking_id
    });

    res.json({ message: 'Room status updated', data: room });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status', details: err.message });
  }
};

exports.getRoomAvailability = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const rooms = await OperatingRoom.findAll({ where: { status: 'available' }, attributes: ['id', 'room_number', 'room_name', 'room_type', 'capacity'] });
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);

    const bookings = await TheatrePatient.findAll({
      where: { scheduled_date: { [Op.between]: [start, end] }, status: { [Op.notIn]: ['completed', 'cancelled'] } },
      attributes: ['id', 'room_id', 'scheduled_time']
    });

    const availability = rooms.map(room => {
      const roomBookings = bookings.filter(b => b.room_id === room.id);
      return { ...room.toJSON(), bookings: roomBookings, is_available: roomBookings.length === 0 };
    });

    res.json({ data: availability });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch availability', details: err.message });
  }
};

exports.getORStatistics = async (req, res) => {
  try {
    const totalRooms = await OperatingRoom.count();
    const statusCounts = await OperatingRoom.findAll({
      attributes: ['status', [OperatingRoom.sequelize.fn('COUNT', OperatingRoom.sequelize.col('status')), 'count']],
      group: ['status'], raw: true
    });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const todaySurgeries = await TheatrePatient.count({ where: { scheduled_date: { [Op.between]: [today, tomorrow] } } });

    const stats = { total: totalRooms, available: 0, occupied: 0, cleaning: 0, maintenance: 0, out_of_service: 0, today_surgeries: todaySurgeries };
    statusCounts.forEach(item => { stats[item.status] = parseInt(item.count); });

    res.json({ data: stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch OR stats', details: err.message });
  }
};
