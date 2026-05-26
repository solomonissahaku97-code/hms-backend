// controllers/ancController.js
const { Op } = require('sequelize');
const { updatePregnancyTimeline, removeANCFromTimeline } = require('./ancTimelineHelper.controller');
const PregnancyTimeline = require('../../models/maternity/PregnancyTimeline');
const ANC = require('../../models/maternity/ANC');
const Staff = require('../../models/staff');
const  sequelize  = require('../../config/database'); 
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

module.exports = { createANC, updateANC, deleteANC, getPregnancyTimeline, getANCsByVisit };
