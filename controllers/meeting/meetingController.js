const { v4: uuidv4 } = require('uuid');
// const Meeting = require('../../models/Meeting');
// const Staff = require('../models/staff');
// const Department = require('../models/department');
// const Institution = require('../models/institution');
const Notification = require('../../models/notification'); // 👈 make sure this model exists
const Meeting = require('../../models/jitsi/meeting');
const Staff = require('../../models/staff');
const Department = require('../../models/department');
const Institution = require('../../models/institution');

// Base URL for your Jitsi server
const JITSI_BASE_URL = 'https://meet.jit.si/';

// ===============================
// Create a new meeting
// ===============================
exports.createMeeting = async (req, res) => {
  try {
    const { institution_id, host_id, title, participants, scheduled_time, duration_minutes, notes } = req.body;
    console.log(req.body)

    if (!institution_id || !host_id || !title || !scheduled_time) {
      return res.status(400).json({ message: 'Required fields: institution_id, host_id, title, scheduled_time' });
    }

    // Generate a unique room name
    const roomName = `meeting-${uuidv4()}`;
    const meetingUrl = `${JITSI_BASE_URL}/${roomName}`;

    // Save meeting
    const meeting = await Meeting.create({
      institution_id,
      host_id,
      title,
      room_name: roomName,
      meeting_url: meetingUrl, 
      participants,
      scheduled_time,
      duration_minutes,
      notes,
      status: 'scheduled',
    });

    // Create notifications for each participant
    if (participants && participants.length > 0) {
      for (const participantId of participants) {
        await Notification.create({
          to_staff_id: participantId,
          from_staff_id:host_id,
          institution_id: institution_id,
          title: 'New Meeting Scheduled',
          description: `You have been invited to a meeting: ${title}`,
          type: 'Reminder',
          reference_id: meeting.id,
          video_url: meetingUrl,
        });

        // 🔥 Emit socket event to the participant (if online)
        if (req.io) {
          req.io.to(`user_${participantId}`).emit('newMeetingNotification', {
            title, 
            meetingUrl,
            scheduled_time,
          });
        }
      }
    }

    res.status(201).json({
      message: 'Meeting created successfully',
      data: meeting,
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ message: 'Failed to create meeting', error: error.message });
  }
};

// ===============================
// Get all meetings (optionally filter)
// ===============================
exports.getMeetings = async (req, res) => {
  try {
    const { institution_id, department_id, status } = req.query;

    const where = {};
    if (institution_id) where.institution_id = institution_id;
    if (department_id) where.department_id = department_id;
    if (status) where.status = status;

    const meetings = await Meeting.findAll({
      where,
      include: [
        { model: Staff, as: 'host', attributes: ['id', 'firstname', 'lastname', 'email'] },
        { model: Department, as: 'department', attributes: ['id', 'name'] },
        { model: Institution, as: 'institution', attributes: ['id', 'name'] },
      ],
      order: [['scheduled_time', 'DESC']],
    });

    res.json(meetings);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ message: 'Failed to fetch meetings', error: error.message });
  }
};

// ===============================
// Get single meeting by ID
// ===============================
exports.getMeetingById = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findByPk(id, {
      include: [
        { model: Staff, as: 'host', attributes: ['id', 'firstname', 'lastname', 'email'] },
        { model: Department, as: 'department', attributes: ['id', 'name'] },
        { model: Institution, as: 'institution', attributes: ['id', 'name'] },
      ],
    });

    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    res.json(meeting);
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ message: 'Failed to fetch meeting', error: error.message });
  }
};

// ===============================
// Cancel a meeting
// ===============================
exports.cancelMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findByPk(id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    meeting.status = 'cancelled';
    await meeting.save();

    res.json({ message: 'Meeting cancelled successfully', data: meeting });
  } catch (error) {
    console.error('Error cancelling meeting:', error);
    res.status(500).json({ message: 'Failed to cancel meeting', error: error.message });
  }
};

// ===============================
// Join meeting (returns Jitsi URL)
// ===============================
exports.joinMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findByPk(id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    res.json({
      message: 'Join meeting',
      meeting_url: meeting.meeting_url,
      room_name: meeting.room_name,
    });
  } catch (error) {
    console.error('Error joining meeting:', error);
    res.status(500).json({ message: 'Failed to join meeting', error: error.message });
  }
};
