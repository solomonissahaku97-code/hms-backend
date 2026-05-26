const TheatrePatients = require('../../models/theatre/TheatrePatients');
const OperatingRoom = require('../../models/theatre/OperatingRoom');
const { Op } = require('sequelize');
const Department = require('../../models/department');

// Create a new theatre booking
exports.createTheatreBooking = async (req, res) => {
  try {
    const {
      visit_id,
      procedure_ids,
      procedure_names,
      scheduled_date,
      scheduled_time,
      estimated_duration,
      room_id,
      surgeon_id,
      anaesthetist_id,
      scrub_nurse_id,
      circulating_nurse_id,
      diagnosis_id,
      diagnosis_names,
      notes,
      pre_op_notes,
      is_emergency
    } = req.body;

    // Check if room is available at the requested time
    if (room_id && scheduled_date && scheduled_time) {
      const startOfDay = new Date(scheduled_date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(scheduled_date);
      endOfDay.setHours(23, 59, 59, 999);

      const conflictingBooking = await TheatrePatients.findOne({
        where: {
          room_id,
          scheduled_date: {
            [Op.between]: [startOfDay, endOfDay]
          },
          scheduled_time,
          status: {
            [Op.notIn]: ['completed', 'cancelled', 'postponed']
          }
        }
      });

      if (conflictingBooking) {
        return res.status(400).json({
          error: 'Room is already booked at this time'
        });
      }
    }

    // Check if staff members are available
    const staffIds = [surgeon_id, anaesthetist_id, scrub_nurse_id, circulating_nurse_id].filter(Boolean);
    
    if (staffIds.length > 0 && scheduled_date && scheduled_time) {
      const conflictingStaff = await TheatrePatients.findOne({
        where: {
          [Op.or]: [
            { surgeon_id: { [Op.in]: staffIds } },
            { anaesthetist_id: { [Op.in]: staffIds } },
            { scrub_nurse_id: { [Op.in]: staffIds } },
            { circulating_nurse_id: { [Op.in]: staffIds } }
          ],
          scheduled_date,
          scheduled_time,
          status: {
            [Op.notIn]: ['completed', 'cancelled', 'postponed']
          }
        }
      });

      if (conflictingStaff) {
        return res.status(400).json({
          error: 'One or more staff members are already assigned to another surgery at this time'
        });
      }
    }

    const booking = await TheatrePatients.create({
      visit_id,
      procedure_ids: procedure_ids || [],
      procedure_names: procedure_names || [],
      scheduled_date,
      scheduled_time,
      estimated_duration,
      room_id,
      surgeon_id,
      anaesthetist_id,
      scrub_nurse_id,
      circulating_nurse_id,
      diagnosis_id: diagnosis_id || [],
      diagnosis_names: diagnosis_names || [],
      notes,
      pre_op_notes,
      is_emergency: is_emergency || false,
      status: 'scheduled'
    });

    // If room assigned, update room status to occupied
    if (room_id) {
      await OperatingRoom.update(
        { status: 'occupied', current_patient_id: visit_id, current_booking_id: booking.id },
        { where: { id: room_id } }
      );
    }

    res.status(201).json({
      message: 'Theatre booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error creating theatre booking:', error);
    res.status(500).json({
      error: 'Failed to create theatre booking',
      details: error.message
    });
  }
};

// Get all theatre bookings
exports.getAllTheatreBookings = async (req, res) => {
  try {
    const { status, date, surgeon_id, room_id, start_date, end_date } = req.query;
    
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (start_date && end_date) {
      where.scheduled_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    } else if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.scheduled_date = {
        [Op.between]: [startOfDay, endOfDay]
      };
    }
    
    if (surgeon_id) {
      where.surgeon_id = surgeon_id;
    }
    
    if (room_id) {
      where.room_id = room_id;
    }

    const bookings = await TheatrePatients.findAll({
      where,
      include: [
        {
          model: OperatingRoom,
          as: 'operatingRoom',
          attributes: ['id', 'room_number', 'room_name', 'room_type']
        },
        
        // Visit info with nested patient
        {
          association: 'visit',
          include: [
            {
              association: 'patient',
            }
          ]
        },
        
        // Surgeon info
        {
          association: 'surgeon',
        },
        // Anaesthetist info
        {
          association: 'anaesthetist',
        },
        // Scrub nurse info
        {
          association: 'scrubNurse',
        },
        // Circulating nurse info
        {
          association: 'circulatingNurse',
        }
      ],
      order: [
        ['scheduled_date', 'ASC'],
        ['scheduled_time', 'ASC']
      ]
    });

    res.status(200).json({
      message: 'Theatre bookings fetched successfully',
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching theatre bookings:', error);
    res.status(500).json({
      error: 'Failed to fetch theatre bookings',
      details: error.message
    });
  }
};

// Get a single theatre booking by ID
exports.getTheatreBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await TheatrePatients.findByPk(id, {
      include: [
        {
          model: OperatingRoom,
          as: 'operatingRoom'
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Theatre booking not found' });
    }

    res.status(200).json({
      message: 'Theatre booking fetched successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error fetching theatre booking:', error);
    res.status(500).json({
      error: 'Failed to fetch theatre booking',
      details: error.message
    });
  }
};

// Update a theatre booking
exports.updateTheatreBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const booking = await TheatrePatients.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Theatre booking not found' });
    }

    // Prevent updates if surgery is in progress or completed
    if (['intra-operation', 'post-operation', 'completed'].includes(booking.status)) {
      return res.status(400).json({
        error: 'Cannot update booking while surgery is in progress or completed'
      });
    }

    // If changing room, check availability
    if (updates.room_id && updates.room_id !== booking.room_id) {
      const conflictingBooking = await TheatrePatients.findOne({
        where: {
          room_id: updates.room_id,
          scheduled_date: booking.scheduled_date,
          scheduled_time: booking.scheduled_time,
          status: {
            [Op.notIn]: ['completed', 'cancelled', 'postponed']
          },
          id: { [Op.ne]: id }
        }
      });

      if (conflictingBooking) {
        return res.status(400).json({
          error: 'New room is already booked at this time'
        });
      }

      // Free up old room
      if (booking.room_id) {
        await OperatingRoom.update(
          { status: 'available', current_patient_id: null, current_booking_id: null },
          { where: { id: booking.room_id } }
        );

        // Occupy new room
        await OperatingRoom.update(
          { status: 'occupied', current_patient_id: booking.visit_id, current_booking_id: id },
          { where: { id: updates.room_id } }
        );
      }
    }

    await booking.update(updates);

    res.status(200).json({
      message: 'Theatre booking updated successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error updating theatre booking:', error);
    res.status(500).json({
      error: 'Failed to update theatre booking',
      details: error.message
    });
  }
};

// Delete (cancel) a theatre booking
exports.cancelTheatreBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellation_reason, cancellation_by } = req.body;

    const booking = await TheatrePatients.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Theatre booking not found' });
    }

    // Prevent cancellation if surgery is already in progress
    if (booking.status === 'intra-operation') {
      return res.status(400).json({
        error: 'Cannot cancel surgery while in progress'
      });
    }

    await booking.update({
      status: 'cancelled',
      cancellation_reason,
      cancellation_by
    });

    // Free up the room
    if (booking.room_id) {
      await OperatingRoom.update(
        { status: 'available', current_patient_id: null, current_booking_id: null },
        { where: { id: booking.room_id } }
      );
    }

    res.status(200).json({
      message: 'Theatre booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error cancelling theatre booking:', error);
    res.status(500).json({
      error: 'Failed to cancel theatre booking',
      details: error.message
    });
  }
};

// Start surgery
exports.startSurgery = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await TheatrePatients.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Theatre booking not found' });
    }

    if (booking.status !== 'scheduled' && booking.status !== 'pre-operation') {
      return res.status(400).json({
        error: 'Surgery cannot be started from current status',
        currentStatus: booking.status,
        allowedStatuses: ['scheduled', 'pre-operation']
      });
    }

    // Set actual start time if not already set
    const actualStartTime = booking.actual_start_time || new Date();
    
    await booking.update({
      status: 'intra-operation',
      actual_start_time: actualStartTime
    });

    // Update room status
    if (booking.room_id) {
      await OperatingRoom.update(
        { status: 'occupied' },
        { where: { id: booking.room_id } }
      );
    }

    // Fetch updated booking with associations
    const updatedBooking = await TheatrePatients.findByPk(id, {
      include: [
        { model: OperatingRoom, as: 'operatingRoom', attributes: ['id', 'room_number', 'room_name'] }
      ]
    });

    res.status(200).json({
      message: 'Surgery started successfully',
      data: updatedBooking
    });
  } catch (error) {
    console.error('Error starting surgery:', error);
    res.status(500).json({
      error: 'Failed to start surgery',
      details: error.message
    });
  }
};

// Complete surgery
exports.completeSurgery = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      outcome,
      notes,
      blood_loss_ml,
      complications,
      specimens_collected,
      implants_used
    } = req.body;

    const booking = await TheatrePatients.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Theatre booking not found' });
    }

    if (booking.status !== 'intra-operation') {
      return res.status(400).json({
        error: 'Surgery is not in progress',
        currentStatus: booking.status
      });
    }

    await booking.update({
      status: 'post-operation',
      actual_end_time: new Date(),
      outcome,
      post_op_notes: notes,
      blood_loss_ml,
      complications,
      specimens_collected,
      implants_used: implants_used || []
    });

    // Fetch updated booking with associations
    const updatedBooking = await TheatrePatients.findByPk(id, {
      include: [
        { model: OperatingRoom, as: 'operatingRoom', attributes: ['id', 'room_number', 'room_name'] }
      ]
    });

    res.status(200).json({
      message: 'Surgery completed successfully',
      data: updatedBooking
    });
  } catch (error) {
    console.error('Error completing surgery:', error);
    res.status(500).json({
      error: 'Failed to complete surgery',
      details: error.message
    });
  }
};

// Get current surgery status and details
exports.getSurgeryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await TheatrePatients.findByPk(id, {
      include: [
        { model: OperatingRoom, as: 'operatingRoom', attributes: ['id', 'room_number', 'room_name', 'room_type'] }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Theatre booking not found' });
    }

    // Calculate surgery duration if started
    let surgeryDuration = null;
    if (booking.actual_start_time && booking.status === 'intra-operation') {
      const start = new Date(booking.actual_start_time);
      const now = new Date();
      surgeryDuration = Math.floor((now - start) / 1000); // in seconds
    } else if (booking.actual_start_time && booking.actual_end_time) {
      const start = new Date(booking.actual_start_time);
      const end = new Date(booking.actual_end_time);
      surgeryDuration = Math.floor((end - start) / 1000); // in seconds
    }

    res.status(200).json({
      message: 'Surgery status fetched successfully',
      data: {
        ...booking.toJSON(),
        surgeryDuration,
        canStart: ['scheduled', 'pre-operation'].includes(booking.status),
        canComplete: booking.status === 'intra-operation'
      }
    });
  } catch (error) {
    console.error('Error fetching surgery status:', error);
    res.status(500).json({
      error: 'Failed to fetch surgery status',
      details: error.message
    });
  }
};

// Update intra-operative notes in real-time
exports.updateIntraOpNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { intra_op_notes } = req.body;

    const booking = await TheatrePatients.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Theatre booking not found' });
    }

    await booking.update({ intra_op_notes });

    res.status(200).json({
      message: 'Intra-operative notes updated successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error updating intra-op notes:', error);
    res.status(500).json({
      error: 'Failed to update intra-operative notes',
      details: error.message
    });
  }
};

// Discharge from recovery
exports.dischargeFromRecovery = async (req, res) => {
  try {
    const { id } = req.params;
    const { discharge_condition } = req.body;

    const booking = await TheatrePatients.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Theatre booking not found' });
    }

    if (booking.status !== 'post-operation') {
      return res.status(400).json({
        error: 'Patient is not in recovery phase'
      });
    }

    await booking.update({
      status: 'completed',
      discharge_date: new Date(),
      discharge_condition
    });

    // Free up the operating room
    if (booking.room_id) {
      await OperatingRoom.update(
        { status: 'cleaning', current_patient_id: null, current_booking_id: null },
        { where: { id: booking.room_id } }
      );
    }

    res.status(200).json({
      message: 'Patient discharged from recovery successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error discharging from recovery:', error);
    res.status(500).json({
      error: 'Failed to discharge from recovery',
      details: error.message
    });
  }
};

// Get upcoming surgeries (next 7 days by default)
exports.getUpcomingSurgeries = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));

    const bookings = await TheatrePatients.findAll({
      where: {
        scheduled_date: {
          [Op.between]: [today, endDate]
        },
        status: {
          [Op.in]: ['scheduled', 'pre-operation']
        }
      },
      include: [
        {
          model: OperatingRoom,
          as: 'operatingRoom',
          attributes: ['id', 'room_number', 'room_name']
        }
      ],
      order: [
        ['scheduled_date', 'ASC'],
        ['scheduled_time', 'ASC']
      ]
    });

    res.status(200).json({
      message: 'Upcoming surgeries fetched successfully',
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching upcoming surgeries:', error);
    res.status(500).json({
      error: 'Failed to fetch upcoming surgeries',
      details: error.message
    });
  }
};

// Get surgeries by patient
exports.getSurgeriesByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const bookings = await TheatrePatients.findAll({
      where: { visit_id: patientId },
      include: [
        {
          model: OperatingRoom,
          as: 'operatingRoom',
          attributes: ['id', 'room_number', 'room_name']
        }
      ],
      order: [['scheduled_date', 'DESC']]
    });

    res.status(200).json({
      message: 'Patient surgeries fetched successfully',
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching patient surgeries:', error);
    res.status(500).json({
      error: 'Failed to fetch patient surgeries',
      details: error.message
    });
  }
};

// Get surgery statistics
exports.getSurgeryStatistics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const dateFilter = {};
    if (start_date && end_date) {
      dateFilter.scheduled_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      dateFilter.scheduled_date = {
        [Op.between]: [today, endOfMonth]
      };
    }

    const total = await TheatrePatients.count({ where: dateFilter });

    const statusCounts = await TheatrePatients.findAll({
      where: dateFilter,
      attributes: [
        'status',
        [TheatrePatients.sequelize.fn('COUNT', TheatrePatients.sequelize.col('status')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const completed = await TheatrePatients.count({
      where: {
        ...dateFilter,
        status: 'completed'
      }
    });

    // Average surgery duration
    const completedSurgeries = await TheatrePatients.findAll({
      where: {
        ...dateFilter,
        status: 'completed',
        actual_start_time: { [Op.ne]: null },
        actual_end_time: { [Op.ne]: null }
      },
      attributes: ['actual_start_time', 'actual_end_time']
    });

    let avgDuration = 0;
    if (completedSurgeries.length > 0) {
      const totalDuration = completedSurgeries.reduce((sum, s) => {
        const start = new Date(s.actual_start_time);
        const end = new Date(s.actual_end_time);
        return sum + (end - start);
      }, 0);
      avgDuration = Math.round(totalDuration / completedSurgeries.length / 60000); // in minutes
    }

    const stats = {
      total,
      completed,
      cancelled: 0,
      postponed: 0,
      in_progress: 0,
      scheduled: 0,
      average_duration_minutes: avgDuration
    };

    statusCounts.forEach(item => {
      stats[item.status] = parseInt(item.count);
    });

    res.status(200).json({
      message: 'Surgery statistics fetched successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error fetching surgery statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch surgery statistics',
      details: error.message
    });
  }
};

