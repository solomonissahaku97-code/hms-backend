const CallHistory = require('../models/CallHistory');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// Create a new call record
exports.createCall = async (req, res) => {
  try {
    const {
      caller_id,
      caller_name,
      caller_department_id,
      receiver_id,
      receiver_name,
      receiver_department_id,
      call_type,
      status,
      room_name,
      notes,
      institution_id,
    } = req.body;

    const call = await CallHistory.create({
      caller_id,
      caller_name,
      caller_department_id,
      receiver_id,
      receiver_name,
      receiver_department_id,
      call_type: call_type || 'video',
      status: status || 'initiated',
      room_name: room_name || `call-${uuidv4()}`,
      notes,
      institution_id,
      start_time: new Date(),
    });

    res.status(201).json({
      success: true,
      data: call,
    });
  } catch (error) {
    console.error('Error creating call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create call record',
      error: error.message,
    });
  }
};

// Update call status
exports.updateCallStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, end_time, receiver_id, receiver_name } = req.body;

    const call = await CallHistory.findByPk(id);
    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    // Update fields
    if (status) call.status = status;
    if (end_time) call.end_time = end_time;
    if (receiver_id) call.receiver_id = receiver_id;
    if (receiver_name) call.receiver_name = receiver_name;

    await call.save();

    res.status(200).json({
      success: true,
      data: call,
    });
  } catch (error) {
    console.error('Error updating call status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update call status',
      error: error.message,
    });
  }
};

// Get call history for a user
exports.getUserCallHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0, type, status } = req.query;

    const where = {
      [Op.or]: [
        { caller_id: userId },
        { receiver_id: userId },
      ],
    };

    if (type) {
      where.call_type = type;
    }

    if (status) {
      where.status = status;
    }

    const calls = await CallHistory.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      data: calls.rows,
      total: calls.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call history',
      error: error.message,
    });
  }
};

// Get department call statistics
exports.getDepartmentStats = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { startDate, endDate } = req.query;

    const where = {
      caller_department_id: departmentId,
    };

    if (startDate && endDate) {
      where.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const stats = await CallHistory.findAll({
      where,
      attributes: [
        'status',
        [CallHistory.sequelize.fn('COUNT', CallHistory.sequelize.col('id')), 'count'],
        [CallHistory.sequelize.fn('SUM', CallHistory.sequelize.col('duration_seconds')), 'total_duration'],
      ],
      group: ['status'],
      raw: true,
    });

    const totalCalls = await CallHistory.count({ where });
    const completedCalls = stats.find(s => s.status === 'completed');
    const missedCalls = stats.find(s => s.status === 'missed');

    res.status(200).json({
      success: true,
      data: {
        total_calls: totalCalls,
        by_status: stats,
        completed: completedCalls ? parseInt(completedCalls.count) : 0,
        missed: missedCalls ? parseInt(missedCalls.count) : 0,
        total_duration: completedCalls ? parseInt(completedCalls.total_duration || 0) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching department stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department statistics',
      error: error.message,
    });
  }
};

// Get all missed calls for a user
exports.getMissedCalls = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const calls = await CallHistory.findAll({
      where: {
        receiver_id: userId,
        status: 'missed',
      },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
    });

    res.status(200).json({
      success: true,
      data: calls,
    });
  } catch (error) {
    console.error('Error fetching missed calls:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch missed calls',
      error: error.message,
    });
  }
};

// End an ongoing call
exports.endCall = async (req, res) => {
  try {
    const { id } = req.params;

    const call = await CallHistory.findByPk(id);
    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    call.status = 'completed';
    call.end_time = new Date();

    // Calculate duration
    const start = new Date(call.start_time);
    const end = new Date(call.end_time);
    call.duration_seconds = Math.floor((end - start) / 1000);

    await call.save();

    res.status(200).json({
      success: true,
      data: call,
    });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end call',
      error: error.message,
    });
  }
};

// Get active calls (ringing or in-progress)
exports.getActiveCalls = async (req, res) => {
  try {
    const { userId } = req.params;

    const calls = await CallHistory.findAll({
      where: {
        [Op.or]: [
          { caller_id: userId },
          { receiver_id: userId },
        ],
        status: {
          [Op.in]: ['initiated', 'ringing', 'accepted'],
        },
      },
      order: [['created_at', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: calls,
    });
  } catch (error) {
    console.error('Error fetching active calls:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active calls',
      error: error.message,
    });
  }
};
