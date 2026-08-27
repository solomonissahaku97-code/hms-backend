const { Op } = require('sequelize');
const { Discharge, Admission, Bed, Visit, Patient, Staff } = require('../models');
const sequelize = require('../config/database');

exports.createDischarge = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      patient_id, visit_id, doctor_id, institution_id, type, notes,
      follow_up_date, instructions,
      ama_reason, risks_acknowledged,
      facility_name, transfer_reason,
      time_of_death, cause_of_death, death_certificate_number,
    } = req.body;

    if (!patient_id || !visit_id || !doctor_id || !type) {
      return res.status(400).json({ error: 'patient_id, visit_id, doctor_id, and type are required' });
    }

    const discharge = await Discharge.create({
      patient_id, visit_id, doctor_id, institution_id, type, notes,
      follow_up_date, instructions,
      ama_reason, risks_acknowledged,
      facility_name, transfer_reason,
      time_of_death, cause_of_death, death_certificate_number,
      discharge_date: new Date(),
    }, { transaction: t });

    // Update admission status
    const admission = await Admission.findOne({ where: { visit_id, status: 'Admitted' }, transaction: t });
    if (admission) {
      await admission.update({ status: 'Discharged', discharge_date: new Date() }, { transaction: t });
      if (admission.bed_id) {
        const bed = await Bed.findByPk(admission.bed_id, { transaction: t });
        if (bed) await bed.update({ status: 'available', is_occupied: false, visit_id: null }, { transaction: t });
      }
    }

    await t.commit();
    res.status(201).json({ success: true, data: discharge });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

exports.getAllDischarges = async (req, res) => {
  try {
    const { institution_id, type, patient_id, start_date, end_date, page = 1, limit = 20 } = req.query;
    const where = {};
    if (institution_id) where.institution_id = institution_id;
    if (type) where.type = type;
    if (patient_id) where.patient_id = patient_id;
    if (start_date || end_date) {
      where.discharge_date = {};
      if (start_date) where.discharge_date[Op.gte] = new Date(start_date);
      if (end_date) where.discharge_date[Op.lte] = new Date(end_date);
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Discharge.findAndCountAll({
      where,
      include: [
        { model: Patient, attributes: ['id', 'first_name', 'last_name'] },
        { model: Staff, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['discharge_date', 'DESC']],
      limit: parseInt(limit), offset, distinct: true,
    });

    res.json({
      success: true,
      data: rows,
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(count / limit), totalItems: count },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDischargeById = async (req, res) => {
  try {
    const discharge = await Discharge.findByPk(req.params.id, {
      include: [
        { model: Patient, attributes: ['id', 'first_name', 'last_name', 'date_of_birth'] },
        { model: Staff, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] },
      ],
    });
    if (!discharge) return res.status(404).json({ error: 'Discharge not found' });
    res.json({ success: true, data: discharge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDischargeStats = async (req, res) => {
  try {
    const { institution_id } = req.query;
    const where = institution_id ? { institution_id } : {};

    const stats = await Discharge.findAll({
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      where,
      group: ['type'],
      raw: true,
    });

    const total = stats.reduce((sum, s) => sum + parseInt(s.count), 0);
    res.json({ success: true, data: { total, byType: stats } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDeceasedPatients = async (req, res) => {
  try {
    const deceased = await Discharge.findAll({
      where: { type: 'expired', status: 'completed' },
      include: [
        { model: Patient, attributes: ['id', 'first_name', 'last_name', 'status'] },
        { model: Staff, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['time_of_death', 'DESC']],
    });
    res.json({ success: true, data: deceased });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
