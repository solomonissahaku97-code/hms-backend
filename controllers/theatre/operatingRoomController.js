// controllers/theatre/operatingRoomController.js
const OperatingRoom = require('../../models/theatre/OperatingRoom');
const TheatrePatients = require('../../models/theatre/TheatrePatients');
const { Op } = require('sequelize');

// Create a new operating room
exports.createOperatingRoom = async (req, res) => {
  try {
    const {
      room_number,
      room_name,
      room_type,
      capacity,
      equipment,
      department_id,
      floor,
      building,
      is_emergency_available,
      notes
    } = req.body;

    // Check if room number already exists
    const existingRoom = await OperatingRoom.findOne({ where: { room_number } });
    if (existingRoom) {
      return res.status(400).json({ error: 'Operating room with this number already exists' });
    }

    const operatingRoom = await OperatingRoom.create({
      room_number,
      room_name,
      room_type: room_type || 'general',
      capacity: capacity || 1,
      equipment: equipment || [],
      department_id,
      floor,
      building,
      is_emergency_available: is_emergency_available !== false,
      notes,
      status: 'available'
    });

    res.status(201).json({
      message: 'Operating room created successfully',
      data: operatingRoom
    });
  } catch (error) {
    console.error('Error creating operating room:', error);
    res.status(500).json({
      error: 'Failed to create operating room',
      details: error.message
    });
  }
};

// Get all operating rooms
exports.getAllOperatingRooms = async (req, res) => {
  try {
    const { status, room_type, floor, available } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (room_type) where.room_type = room_type;
    if (floor) where.floor = floor;
    if (available === 'true') where.status = 'available';

    const operatingRooms = await OperatingRoom.findAll({
      where,
      include: [
        {
          model: TheatrePatients,
          as: 'currentBooking',
          required: false,
          where: {
            status: {
              [Op.in]: ['pre-operation', 'intra-operation', 'post-operation']
            }
          },
          include: [
            { model: require('../../models/patient'), as: 'patient', attributes: ['id', 'first_name', 'last_name', 'patient_id', 'date_of_birth', 'gender'] }
          ]
        }
      ],
      order: [['room_number', 'ASC']]
    });

    res.status(200).json({
      message: 'Operating rooms fetched successfully',
      data: operatingRooms
    });
  } catch (error) {
    console.error('Error fetching operating rooms:', error);
    res.status(500).json({
      error: 'Failed to fetch operating rooms',
      details: error.message
    });
  }
};

// Get a single operating room by ID
exports.getOperatingRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const operatingRoom = await OperatingRoom.findByPk(id, {
      include: [
        {
          model: TheatrePatients,
          as: 'currentBooking',
          include: ['visit']
        }
      ]
    });

    if (!operatingRoom) {
      return res.status(404).json({ error: 'Operating room not found' });
    }

    res.status(200).json({
      message: 'Operating room fetched successfully',
      data: operatingRoom
    });
  } catch (error) {
    console.error('Error fetching operating room:', error);
    res.status(500).json({
      error: 'Failed to fetch operating room',
      details: error.message
    });
  }
};

// Update an operating room
exports.updateOperatingRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const operatingRoom = await OperatingRoom.findByPk(id);
    if (!operatingRoom) {
      return res.status(404).json({ error: 'Operating room not found' });
    }

    // If changing room_number, check if new number already exists
    if (updates.room_number && updates.room_number !== operatingRoom.room_number) {
      const existingRoom = await OperatingRoom.findOne({ 
        where: { room_number: updates.room_number } 
      });
      if (existingRoom) {
        return res.status(400).json({ error: 'Operating room number already exists' });
      }
    }

    await operatingRoom.update(updates);

    res.status(200).json({
      message: 'Operating room updated successfully',
      data: operatingRoom
    });
  } catch (error) {
    console.error('Error updating operating room:', error);
    res.status(500).json({
      error: 'Failed to update operating room',
      details: error.message
    });
  }
};

// Delete an operating room
exports.deleteOperatingRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const operatingRoom = await OperatingRoom.findByPk(id);

    if (!operatingRoom) {
      return res.status(404).json({ error: 'Operating room not found' });
    }

    // Check if room is currently in use
    if (operatingRoom.status === 'occupied') {
      return res.status(400).json({ 
        error: 'Cannot delete an occupied operating room' 
      });
    }

    await operatingRoom.destroy();

    res.status(200).json({
      message: 'Operating room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting operating room:', error);
    res.status(500).json({
      error: 'Failed to delete operating room',
      details: error.message
    });
  }
};

// Update room status (e.g., from available to occupied)
exports.updateRoomStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, current_patient_id, current_booking_id } = req.body;

    const operatingRoom = await OperatingRoom.findByPk(id);
    if (!operatingRoom) {
      return res.status(404).json({ error: 'Operating room not found' });
    }

    // Validate status transitions
    const validTransitions = {
      'available': ['occupied', 'cleaning', 'maintenance', 'out_of_service'],
      'occupied': ['cleaning'],
      'cleaning': ['available', 'maintenance'],
      'maintenance': ['available', 'out_of_service'],
      'out_of_service': ['maintenance']
    };

    if (!validTransitions[operatingRoom.status]?.includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${operatingRoom.status} to ${status}`
      });
    }

    await operatingRoom.update({
      status,
      current_patient_id: status === 'available' ? null : current_patient_id,
      current_booking_id: status === 'available' ? null : current_booking_id
    });

    res.status(200).json({
      message: 'Room status updated successfully',
      data: operatingRoom
    });
  } catch (error) {
    console.error('Error updating room status:', error);
    res.status(500).json({
      error: 'Failed to update room status',
      details: error.message
    });
  }
};

// Get room availability for a specific date
exports.getRoomAvailability = async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const rooms = await OperatingRoom.findAll({
      where: {
        status: 'available'
      },
      attributes: ['id', 'room_number', 'room_name', 'room_type', 'capacity']
    });

    // Get all bookings for the specified date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await TheatrePatients.findAll({
      where: {
        scheduled_date: {
          [Op.between]: [startOfDay, endOfDay]
        },
        status: {
          [Op.notIn]: ['completed', 'cancelled']
        }
      },
      attributes: ['id', 'scheduled_date', 'scheduled_time']
    });

    // Map bookings to rooms
    const availability = rooms.map(room => {
      const roomBookings = bookings.filter(b => b.room_id === room.id);
      return {
        ...room.toJSON(),
        bookings: roomBookings,
        is_available: roomBookings.length === 0
      };
    });

    res.status(200).json({
      message: 'Room availability fetched successfully',
      data: availability
    });
  } catch (error) {
    console.error('Error fetching room availability:', error);
    res.status(500).json({
      error: 'Failed to fetch room availability',
      details: error.message
    });
  }
};

// Get OR statistics
exports.getORStatistics = async (req, res) => {
  try {
    const totalRooms = await OperatingRoom.count();
    
    const statusCounts = await OperatingRoom.findAll({
      attributes: [
        'status',
        [OperatingRoom.sequelize.fn('COUNT', OperatingRoom.sequelize.col('status')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const stats = {
      total: totalRooms,
      available: 0,
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
      out_of_service: 0
    };

    statusCounts.forEach(item => {
      stats[item.status] = parseInt(item.count);
    });

    // Get today's surgeries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySurgeries = await TheatrePatients.count({
      where: {
        scheduled_date: {
          [Op.between]: [today, tomorrow]
        }
      }
    });

    res.status(200).json({
      message: 'OR statistics fetched successfully',
      data: {
        ...stats,
        today_surgeries: todaySurgeries
      }
    });
  } catch (error) {
    console.error('Error fetching OR statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch OR statistics',
      details: error.message
    });
  }
};

