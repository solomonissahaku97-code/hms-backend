
const { Op } = require('sequelize');
const FluidMonitoring = require('../../models/fluid_monitering/FluidMonitoring');
const FluidBalanceSummary = require('../../models/fluid_monitering/FluidBalanceSummary');
const FluidMonitoringSettings = require('../../models/fluid_monitering/FluidMonitoringSettings');
const Patient = require('../../models/patient');
const Visit = require('../../models/Visit');
const Staff = require('../../models/staff');

// Get fluid entries for a patient
const getFluidEntries = async (req, res) => {
  try {
    const { visit_id,  institution_id, start_date, end_date, type } = req.query;

    const whereClause = {
      institution_id,
      is_void: false
    };

    if (visit_id) whereClause.visit_id = visit_id;
    if (type) whereClause.type = type;

    if (start_date && end_date) {
      whereClause.recorded_at = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }

    const entries = await FluidMonitoring.findAll({
      where: whereClause,
      include: [
        { model: Staff, as: 'staff', },
        { model: Visit, as: 'visit', }
      ],
      order: [['recorded_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: entries
    });
  } catch (error) {
    console.error('Error fetching fluid entries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fluid entries'
    });
  }
};

// Add new fluid entry
const addFluidEntry = async (req, res) => {
  try {
    const {
      visit_id,
      type,
      category,
      amount,
      unit,
      description,
      color,
      consistency,
      method,
      fluid_type,
      iv_solution,
      iv_rate,
      iv_rate_unit,
      recorded_at,
      notes,
      institution_id,
      staff_id
    } = req.body;
    console.log(req.body)

    const newEntry = await FluidMonitoring.create({
      visit_id,
      institution_id,
      staff_id,
      type,
      category,
      amount,
      unit,
      description,
      color,
      consistency,
      method,
      fluid_type,
      iv_solution,
      iv_rate,
      iv_rate_unit,
      recorded_at: recorded_at || new Date(),
      notes,
      created_by: staff_id
    });

    // Update fluid balance summary
    await updateFluidBalanceSummary(visit_id,  institution_id);

    res.status(201).json({
      success: true,
      message: 'Fluid entry added successfully',
      data: newEntry
    });
  } catch (error) {
    console.error('Error adding fluid entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding fluid entry'
    });
  }
};

// Update fluid entry
const updateFluidEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    updates.updated_by = req.user.id;

    const entry = await FluidMonitoring.findByPk(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Fluid entry not found'
      });
    }

    await entry.update(updates);

    // Update fluid balance summary
    await updateFluidBalanceSummary(entry.visit_id, entry. entry.institution_id);

    res.status(200).json({
      success: true,
      message: 'Fluid entry updated successfully',
      data: entry
    });
  } catch (error) {
    console.error('Error updating fluid entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating fluid entry'
    });
  }
};

// Delete/void fluid entry
const deleteFluidEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { void_reason } = req.body;

    const entry = await FluidMonitoring.findByPk(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Fluid entry not found'
      });
    }

    await entry.update({
      is_void: true,
      void_reason,
      status: 'voided',
      updated_by: req.user.id
    });

    // Update fluid balance summary
    await updateFluidBalanceSummary(entry.visit_id, entry. entry.institution_id);

    res.status(200).json({
      success: true,
      message: 'Fluid entry voided successfully'
    });
  } catch (error) {
    console.error('Error voiding fluid entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error voiding fluid entry'
    });
  }
};

// Get fluid balance summary
const getFluidBalanceSummary = async (req, res) => {
  try {
    const { visit_id,  institution_id, date } = req.query;

    const summaryDate = date ? new Date(date) : new Date();

    let summary = await FluidBalanceSummary.findOne({
      where: {
        visit_id,
        institution_id,
        summary_date: summaryDate
      },
      include: [
        { model: Visit, as: 'visit' },
      ]
    });

    if (!summary) {
      // Create summary if it doesn't exist
      summary = await updateFluidBalanceSummary(visit_id,  institution_id, summaryDate);
    }

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.log('Error fetching fluid balance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fluid balance summary'
    });
  }
};

// Helper function to update fluid balance summary
const updateFluidBalanceSummary = async (visit_id,  institution_id, summaryDate = new Date()) => {
  const date = new Date(summaryDate);
  date.setHours(0, 0, 0, 0);
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);

  // Get all fluid entries for the day
  const entries = await FluidMonitoring.findAll({
    where: {
      visit_id,
      
      institution_id,
      is_void: false,
      recorded_at: {
        [Op.between]: [date, nextDate]
      }
    }
  });

  // Calculate totals
  const totals = entries.reduce((acc, entry) => {
    if (entry.type === 'intake') {
      acc.total_intake += parseFloat(entry.amount);
      
      switch (entry.category) {
        case 'oral':
          acc.oral_intake += parseFloat(entry.amount);
          break;
        case 'iv':
          acc.iv_intake += parseFloat(entry.amount);
          break;
        default:
          acc.other_intake += parseFloat(entry.amount);
      }
    } else {
      acc.total_output += parseFloat(entry.amount);
      
      switch (entry.category) {
        case 'urine':
          acc.urine_output += parseFloat(entry.amount);
          break;
        case 'stool':
          acc.stool_output += parseFloat(entry.amount);
          break;
        case 'vomit':
          acc.vomit_output += parseFloat(entry.amount);
          break;
        default:
          acc.other_output += parseFloat(entry.amount);
      }
    }
    return acc;
  }, {
    total_intake: 0,
    total_output: 0,
    oral_intake: 0,
    iv_intake: 0,
    other_intake: 0,
    urine_output: 0,
    stool_output: 0,
    vomit_output: 0,
    other_output: 0
  });

  totals.net_balance = totals.total_intake - totals.total_output;

  // Determine status
  let status = 'balanced';
  const settings = await FluidMonitoringSettings.findOne({
    where: {  institution_id }
  });

  if (settings) {
    if (totals.net_balance >= settings.critical_threshold_positive) {
      status = 'critical';
    } else if (totals.net_balance <= settings.critical_threshold_negative) {
      status = 'critical';
    } else if (totals.net_balance >= settings.alert_threshold_positive) {
      status = 'positive_balance';
    } else if (totals.net_balance <= settings.alert_threshold_negative) {
      status = 'negative_balance';
    }
  }

  // Update or create summary
  const [summary] = await FluidBalanceSummary.upsert({
    visit_id,
    
    institution_id,
    summary_date: date,
    ...totals,
    status,
    updated_at: new Date()
  });

  return summary;
};

// Get fluid monitoring settings
const getFluidSettings = async (req, res) => {
  try {
    const {  institution_id,visit_id } = req.query;

    let settings = await FluidMonitoringSettings.findOne({
      where: { visit_id, institution_id },
    //   include: [{ model: Visit, as: 'patient' }]
    });

    if (!settings) {
      // Create default settings if they don't exist
      settings = await FluidMonitoringSettings.create({
        
        institution_id,
        visit_id
      });
    }

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching fluid settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fluid settings'
    });
  }
};

// Update fluid monitoring settings
const updateFluidSettings = async (req, res) => {
  try {
    const {  institution_id } = req.body;
    const updates = req.body;
    updates.updated_by = req.user.id;

    let settings = await FluidMonitoringSettings.findOne({
      where: {  institution_id }
    });

    if (!settings) {
      settings = await FluidMonitoringSettings.create({
        ...updates,
        created_by: req.user.id
      });
    } else {
      await settings.update(updates);
    }

    res.status(200).json({
      success: true,
      message: 'Fluid settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating fluid settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating fluid settings'
    });
  }
};

module.exports = {
  getFluidEntries,
  addFluidEntry,
  updateFluidEntry,
  deleteFluidEntry,
  getFluidBalanceSummary,
  getFluidSettings,
  updateFluidSettings,
  updateFluidBalanceSummary
};