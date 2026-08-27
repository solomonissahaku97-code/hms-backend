const { Op } = require('sequelize');
const { Admission, Bed, Visit, Patient, Staff, Department, Institution } = require('../models');
const sequelize = require('../config/database');

exports.createAdmission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { visit_id, institution_id, staff_id, department_id, bed_id, note } = req.body;
    if (!visit_id || !institution_id || !staff_id) {
      return res.status(400).json({ error: 'visit_id, institution_id, and staff_id are required' });
    }

    const visit = await Visit.findByPk(visit_id, { transaction: t });
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    // Check if already admitted
    const existing = await Admission.findOne({ where: { visit_id, status: 'Admitted' }, transaction: t });
    if (existing) return res.status(400).json({ error: 'Patient is already admitted' });

    // Assign bed if provided
    let bedNumber = null;
    if (bed_id) {
      const bed = await Bed.findByPk(bed_id, { transaction: t });
      if (!bed || bed.status !== 'available') {
        return res.status(400).json({ error: 'Bed not found or not available' });
      }
      await bed.update({ status: 'occupied', is_occupied: true, visit_id }, { transaction: t });
      bedNumber = bed.bed_number;
    }

    const admission = await Admission.create({
      visit_id, institution_id, staff_id, department_id,
      bed_id, bed_number: bedNumber, note,
      patient_id: visit.patient_id,
    }, { transaction: t });

    await t.commit();
    res.status(201).json({ success: true, data: admission });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

exports.getAllAdmissions = async (req, res) => {
  try {
    const { institution_id, department_id, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (institution_id) where.institution_id = institution_id;
    if (department_id) where.department_id = department_id;
    if (status) where.status = status;

    const offset = (page - 1) * limit;
    const { count, rows } = await Admission.findAndCountAll({
      where,
      include: [
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Staff, as: 'staff', attributes: ['id', 'firstName', 'lastName'] },
        { model: Department, as: 'department', attributes: ['id', 'name'] },
      ],
      order: [['admission_date', 'DESC']],
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

exports.getAdmissionById = async (req, res) => {
  try {
    const admission = await Admission.findByPk(req.params.id, {
      include: [
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Staff, as: 'staff' },
        { model: Bed, as: 'bed' },
      ],
    });
    if (!admission) return res.status(404).json({ error: 'Admission not found' });
    res.json({ success: true, data: admission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.dischargePatient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { admission_id, discharge_type, notes } = req.body;
    const admission = await Admission.findByPk(admission_id, { transaction: t });
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    await admission.update({
      status: 'Discharged',
      discharge_date: new Date(),
      note: notes || admission.note,
    }, { transaction: t });

    // Free the bed
    if (admission.bed_id) {
      const bed = await Bed.findByPk(admission.bed_id, { transaction: t });
      if (bed) {
        await bed.update({ status: 'available', is_occupied: false, visit_id: null }, { transaction: t });
      }
    }

    await t.commit();
    res.json({ success: true, message: 'Patient discharged successfully', data: admission });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

exports.updateAdmissionStatus = async (req, res) => {
  try {
    const { admission_id, admission_status } = req.body;
    const admission = await Admission.findByPk(admission_id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    await admission.update({ admission_status });
    res.json({ success: true, data: admission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.transferPatient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { admission_id, new_department_id, new_bed_id, note } = req.body;
    const admission = await Admission.findByPk(admission_id, { transaction: t });
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    // Release old bed
    if (admission.bed_id) {
      const oldBed = await Bed.findByPk(admission.bed_id, { transaction: t });
      if (oldBed) await oldBed.update({ status: 'available', is_occupied: false, visit_id: null }, { transaction: t });
    }

    // Assign new bed
    let bedNumber = null;
    if (new_bed_id) {
      const newBed = await Bed.findByPk(new_bed_id, { transaction: t });
      if (!newBed || newBed.status !== 'available') {
        return res.status(400).json({ error: 'New bed not available' });
      }
      await newBed.update({ status: 'occupied', is_occupied: true, visit_id: admission.visit_id }, { transaction: t });
      bedNumber = newBed.bed_number;
    }

    await admission.update({
      department_id: new_department_id,
      bed_id: new_bed_id,
      bed_number: bedNumber,
      note: note || admission.note,
    }, { transaction: t });

    await t.commit();
    res.json({ success: true, message: 'Patient transferred', data: admission });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const { institution_id } = req.query;
    const where = institution_id ? { institution_id } : {};

    const total = await Admission.count({ where });
    const admitted = await Admission.count({ where: { ...where, status: 'Admitted' } });
    const discharged = await Admission.count({ where: { ...where, status: 'Discharged' } });
    const transferred = await Admission.count({ where: { ...where, status: 'Transferred' } });

    const totalBeds = await Bed.count({ where: institution_id ? { institution_id } : {} });
    const occupiedBeds = await Bed.count({ where: { ...(institution_id ? { institution_id } : {}), is_occupied: true } });

    res.json({
      success: true,
      data: {
        admissions: { total, admitted, discharged, transferred },
        beds: { total: totalBeds, occupied: occupiedBeds, available: totalBeds - occupiedBeds },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
