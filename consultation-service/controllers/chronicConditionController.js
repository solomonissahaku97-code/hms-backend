const { PatientChronicCondition } = require('../models');
const { Op } = require('sequelize');

exports.createCondition = async (req, res) => {
  try {
    const condition = await PatientChronicCondition.create(req.body);
    res.status(201).json({ message: 'Chronic condition recorded', data: condition });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create condition', details: err.message });
  }
};

exports.getPatientConditions = async (req, res) => {
  try {
    const where = { patient_id: req.params.patient_id, is_active: true };
    if (req.query.status) where.status = req.query.status;
    const conditions = await PatientChronicCondition.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ data: conditions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conditions', details: err.message });
  }
};

exports.updateCondition = async (req, res) => {
  try {
    const condition = await PatientChronicCondition.findByPk(req.params.id);
    if (!condition) return res.status(404).json({ error: 'Condition not found' });
    await condition.update(req.body);
    res.json({ message: 'Condition updated', data: condition });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update condition', details: err.message });
  }
};

exports.deleteCondition = async (req, res) => {
  try {
    const condition = await PatientChronicCondition.findByPk(req.params.id);
    if (!condition) return res.status(404).json({ error: 'Condition not found' });
    await condition.update({ is_active: false });
    res.json({ message: 'Condition deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete condition', details: err.message });
  }
};

exports.getConditionSummary = async (req, res) => {
  try {
    const conditions = await PatientChronicCondition.findAll({ where: { patient_id: req.params.patient_id, is_active: true } });
    const summary = {};
    conditions.forEach(c => { if (!summary[c.condition_category]) summary[c.condition_category] = []; summary[c.condition_category].push({ id: c.id, name: c.condition_name, status: c.status }); });
    res.json({ summary, total: conditions.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary', details: err.message });
  }
};

exports.getPatientsDueForFollowUp = async (req, res) => {
  try {
    const where = { is_active: true, status: { [Op.in]: ['active', 'controlled'] }, next_followup_date: { [Op.lte]: new Date() } };
    if (req.query.institution_id) where.institution_id = req.query.institution_id;
    const conditions = await PatientChronicCondition.findAll({ where, order: [['next_followup_date', 'ASC']] });
    res.json({ data: conditions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch follow-ups', details: err.message });
  }
};
