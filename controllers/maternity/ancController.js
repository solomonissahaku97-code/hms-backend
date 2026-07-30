// controllers/ancController.js
const { Op } = require('sequelize');
const { updatePregnancyTimeline, removeANCFromTimeline } = require('./ancTimelineHelper.controller');
const PregnancyTimeline = require('../../models/maternity/PregnancyTimeline');
const ANC = require('../../models/maternity/ANC');
const Staff = require('../../models/staff');
const  sequelize  = require('../../config/database'); 
// @desc    Register new ANC patient - creates visit and ANC record
// @route   POST /api/v1/ANC/register
// @access  Private
const registerANC = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      patient_id,
      institution_id,
      department_id,
      auditor_id,
      gestational_age_weeks,
      mother_age,
      parity,
      blood_pressure,
      hemoglobin_level,
      hiv_status,
      visit_type = 'Maternity',
      attendance_type = 'New',
      risk_level = 'Low',
      edd,
      lmp,
      fetal_presentation,
      next_appointment_date,
      notes
    } = req.body;

    if (!patient_id || !institution_id || !department_id) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'patient_id, institution_id and department_id are required' });
    }

    // 1. Create Visit
    const visit = await sequelize.models.Visit.create({
      patient_id,
      institution_id,
      department_id,
      visit_type,
      attendance_type,
      status: 'Active'
    }, { transaction: t });

    // 2. Create ANC record
    const anc = await ANC.create({
      visit_id: visit.id,
      institution_id,
      gestational_age_weeks,
      mother_age,
      parity,
      blood_pressure,
      hemoglobin_level,
      hiv_status,
      auditor_id,
      year: new Date().getFullYear()
    }, { transaction: t });

    // 3. Create Pregnancy Timeline if LMP/EDD provided
    if (lmp || edd) {
      const timelineData = {
        visit_id: visit.id,
        lmp: lmp ? new Date(lmp) : undefined,
        edd: edd ? new Date(edd) : undefined,
        total_weeks: 40,
        current_week: gestational_age_weeks || 0,
        progress_percent: ((gestational_age_weeks || 0) / 40) * 100,
        weeks: [],
        pregnancy_id: anc.id
      };
      await PregnancyTimeline.create(timelineData, { transaction: t });
    }

    // 4. Create Pregnancy History if needed
    await PregnancyHistory.findOrCreate({
      where: { patient_id, institution_id },
      defaults: { patient_id, institution_id }
    });

    await t.commit();

    res.status(201).json({
      success: true,
      message: 'ANC registration successful',
      data: {
        visit,
        anc
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Register ANC Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering ANC patient',
      error: error.message
    });
  }
};

const createANC = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { 
      visit_id, 
      visit_date, 
      gestational_age, 
      hemoglobin_level, 
      auditor_id, 
      year, 
      institution_id, 
      mother_age, 
      hiv_status, 
      gestational_age_weeks, 
      blood_pressure 
    } = req.body;

    // 1. Create ANC record
    const anc = await ANC.create({
      visit_id,
      gestational_age,
      hemoglobin_level,
      auditor_id,
      year,
      institution_id,
      mother_age,
      hiv_status,
      gestational_age_weeks,
      blood_pressure
    }, { transaction: t });

    // 2. Check if pregnancy timeline exists
    let timeline = await PregnancyTimeline.findOne({ where: { visit_id }, transaction: t });

    if (!timeline) {
      const lmp = new Date(visit_date || new Date());
      timeline = await PregnancyTimeline.create({
        visit_id,
        lmp,
        edd: new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000), // +40 weeks
        total_weeks: 40,
        current_week: gestational_age,
        progress_percent: (gestational_age / 40) * 100,
        weeks: [],
        pregnancy_id: anc.id
      }, { transaction: t });
    }

    // 3. Update pregnancy timeline with ANC visit
    await updatePregnancyTimeline(visit_id, anc, t);

    // Commit transaction
    await t.commit();

    res.status(201).json({ success: true, data: anc });
  } catch (error) {
    // Rollback transaction if anything fails
    await t.rollback();
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get ANC data by visit_id
// controllers/ancController.js

const getANCsByVisit = async (req, res) => {
  try {
    const { visit_id } = req.params;

    const ancRecords = await ANC.findAll({
      where: { visit_id },
      order: [["createdAt", "ASC"]], // chronological order
      include: [
        {
          model:Staff,
          as:'auditor'
        },
      ]

    },);

    if (!ancRecords || ancRecords.length === 0) {
      return res.status(404).json({ success: false, message: "No ANC records found for this visit" });
    }

    res.json({ success: true, data: ancRecords });
  } catch (error) {
    console.error("Error fetching ANC records by visit_id:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};






const updateANC = async (req, res) => {
  try {
    const { id } = req.params;
    const { visit_date, gestational_age, vitals, labs, ultrasound, medications } = req.body;

    const anc = await ANC.findByPk(id);
    if (!anc) return res.status(404).json({ success: false, message: 'ANC record not found' });

    await anc.update({ visit_date, gestational_age, vitals, labs, ultrasound, medications });

    // Update Pregnancy Timeline
    await updatePregnancyTimeline(anc.patient_id, anc);

    res.json({ success: true, data: anc });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteANC = async (req, res) => {
  try {
    const { id } = req.params;
    const anc = await ANC.findByPk(id);
    if (!anc) return res.status(404).json({ success: false, message: 'ANC record not found' });

    await anc.destroy();

    // Update Pregnancy Timeline after deletion
    await removeANCFromTimeline(anc.patient_id, anc);

    res.json({ success: true, message: 'ANC record deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get pregnancy timeline for a visit_id
const getPregnancyTimeline = async (req, res) => {
  try {
    const { visit_id } = req.params;
    const timeline = await PregnancyTimeline.findOne({ where: { visit_id } });
    if (!timeline) return res.status(404).json({ success: false, message: 'Pregnancy timeline not found' });

    res.json({ success: true, data: timeline });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createANC, registerANC, updateANC, deleteANC, getPregnancyTimeline, getANCsByVisit };
