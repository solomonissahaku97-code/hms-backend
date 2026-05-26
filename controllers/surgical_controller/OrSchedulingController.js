const { Op } = require('sequelize');
const OrScheduling = require('../../models/OrSchedule');

// Create a new OR schedule
exports.createOrSchedule = async (req, res) => {
  try {
    const {
      patient_id,
      institution_id,
      scheduled_date,
      scheduled_time,
      surgeon_id,
      anesthesiologist_id,
      status = 'Scheduled'
    } = req.body;

    // Validate required fields
    if (!patient_id || !institution_id || !scheduled_date || !scheduled_time || !surgeon_id || !anesthesiologist_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for scheduling conflicts
    const existingSchedule = await OrScheduling.findOne({
      where: {
        scheduled_date,
        scheduled_time,
        status: {
          [Op.not]: 'Cancelled'
        }
      }
    });

    if (existingSchedule) {
      return res.status(409).json({ error: 'Time slot already booked' });
    }

    const newSchedule = await OrScheduling.create({
      patient_id,
      institution_id,
      scheduled_date,
      scheduled_time,
      surgeon_id,
      anesthesiologist_id,
      status
    });

    res.status(201).json(newSchedule);
  } catch (error) {
    console.error('Error creating OR schedule:', error);
    res.status(500).json({ error: 'Failed to create OR schedule' });
  }
};

// Get all OR schedules
exports.getAllOrSchedules = async (req, res) => {
  try {
    const { institution_id, date, status } = req.query;
    const whereClause = { institution_id };

    if (date) {
      whereClause.scheduled_date = date;
    }

    if (status) {
      whereClause.status = status;
    }

    const schedules = await OrScheduling.findAll({
      where: whereClause,
      include: [
        { association: 'patient' },
        { association: 'surgeon' },
        { association: 'anesthesiologist' }
      ],
      order: [['scheduled_date', 'ASC'], ['scheduled_time', 'ASC']]
    });

    res.status(200).json(schedules);
  } catch (error) {
    console.error('Error fetching OR schedules:', error);
    res.status(500).json({ error: 'Failed to fetch OR schedules' });
  }
};

// Get OR schedule by ID
exports.getOrScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await OrScheduling.findByPk(id, {
      include: [
        { association: 'patient' },
        { association: 'surgeon' },
        { association: 'anesthesiologist' }
      ]
    });

    if (!schedule) {
      return res.status(404).json({ error: 'OR schedule not found' });
    }

    res.status(200).json(schedule);
  } catch (error) {
    console.error('Error fetching OR schedule:', error);
    res.status(500).json({ error: 'Failed to fetch OR schedule' });
  }
};

// Update OR schedule
exports.updateOrSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const schedule = await OrScheduling.findByPk(id);
    if (!schedule) {
      return res.status(404).json({ error: 'OR schedule not found' });
    }

    // Prevent updating cancelled schedules unless reactivating
    if (schedule.status === 'Cancelled' && updates.status !== 'Scheduled') {
      return res.status(400).json({ error: 'Cannot update a cancelled schedule unless reactivating' });
    }

    // Check for scheduling conflicts if date/time is being updated
    if (updates.scheduled_date || updates.scheduled_time) {
      const date = updates.scheduled_date || schedule.scheduled_date;
      const time = updates.scheduled_time || schedule.scheduled_time;

      const conflict = await OrScheduling.findOne({
        where: {
          id: { [Op.not]: id },
          scheduled_date: date,
          scheduled_time: time,
          status: {
            [Op.not]: 'Cancelled'
          }
        }
      });

      if (conflict) {
        return res.status(409).json({ error: 'New time slot already booked' });
      }
    }

    await schedule.update(updates);
    res.status(200).json(schedule);
  } catch (error) {
    console.error('Error updating OR schedule:', error);
    res.status(500).json({ error: 'Failed to update OR schedule' });
  }
};

// Cancel OR schedule
exports.cancelOrSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const schedule = await OrScheduling.findByPk(id);
    if (!schedule) {
      return res.status(404).json({ error: 'OR schedule not found' });
    }

    if (schedule.status === 'Completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed surgery' });
    }

    await schedule.update({ 
      status: 'Cancelled',
      cancellation_reason: cancellation_reason || 'No reason provided'
    });

    res.status(200).json({ message: 'OR schedule cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling OR schedule:', error);
    res.status(500).json({ error: 'Failed to cancel OR schedule' });
  }
};

// Get schedules by surgeon
exports.getSchedulesBySurgeon = async (req, res) => {
  try {
    const { surgeon_id } = req.params;
    const { start_date, end_date } = req.query;

    const whereClause = { 
      surgeon_id,
      status: {
        [Op.not]: 'Cancelled'
      }
    };

    if (start_date && end_date) {
      whereClause.scheduled_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    const schedules = await OrScheduling.findAll({
      where: whereClause,
      include: [
        { association: 'patient' },
        { association: 'anesthesiologist' }
      ],
      order: [['scheduled_date', 'ASC'], ['scheduled_time', 'ASC']]
    });

    res.status(200).json(schedules);
  } catch (error) {
    console.error('Error fetching surgeon schedules:', error);
    res.status(500).json({ error: 'Failed to fetch surgeon schedules' });
  }
};

// Get available time slots for a date
exports.getAvailableTimeSlots = async (req, res) => {
  try {
    const { date } = req.params;
    const { institution_id } = req.query;

    if (!date || !institution_id) {
      return res.status(400).json({ error: 'Date and institution ID are required' });
    }

    // Get all booked slots for the date
    const bookedSchedules = await OrScheduling.findAll({
      where: {
        scheduled_date: date,
        institution_id,
        status: {
          [Op.not]: 'Cancelled'
        }
      },
      attributes: ['scheduled_time']
    });

    const bookedTimes = bookedSchedules.map(s => s.scheduled_time);

    // Generate all possible time slots (assuming 30-minute intervals from 8AM to 6PM)
    const allSlots = [];
    const startHour = 8;
    const endHour = 18;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
        allSlots.push(timeString);
      }
    }

    // Filter out booked slots
    const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

    res.status(200).json({ date, availableSlots });
  } catch (error) {
    console.error('Error fetching available time slots:', error);
    res.status(500).json({ error: 'Failed to fetch available time slots' });
  }
};

// Complete a surgery
exports.completeSurgery = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, outcome } = req.body;

    const schedule = await OrScheduling.findByPk(id);
    if (!schedule) {
      return res.status(404).json({ error: 'OR schedule not found' });
    }

    if (schedule.status === 'Cancelled') {
      return res.status(400).json({ error: 'Cannot complete a cancelled surgery' });
    }

    await schedule.update({ 
      status: 'Completed',
      completion_notes: notes,
      outcome: outcome || 'Successful'
    });

    res.status(200).json({ message: 'Surgery marked as completed' });
  } catch (error) {
    console.error('Error completing surgery:', error);
    res.status(500).json({ error: 'Failed to complete surgery' });
  }
};