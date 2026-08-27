const { PastMedicalHistory, PatientOccupation } = require('../models');

// ── Past Medical History ────────────────────────────────────────

exports.createPastMedicalHistory = async (req, res) => {
  try {
    const record = await PastMedicalHistory.create(req.body);
    res.status(201).json({ data: record });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPastMedicalHistories = async (req, res) => {
  try {
    const where = req.query.visit_id ? { visit_id: req.query.visit_id } : {};
    const records = await PastMedicalHistory.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ data: records });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updatePastMedicalHistory = async (req, res) => {
  try {
    const record = await PastMedicalHistory.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    await record.update(req.body);
    res.json({ data: record });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deletePastMedicalHistory = async (req, res) => {
  try {
    const record = await PastMedicalHistory.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    await record.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Occupation History ──────────────────────────────────────────

exports.createOccupation = async (req, res) => {
  try {
    const record = await PatientOccupation.create(req.body);
    res.status(201).json({ data: record });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getOccupations = async (req, res) => {
  try {
    const where = req.query.visit_id ? { visit_id: req.query.visit_id } : {};
    const records = await PatientOccupation.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ data: records });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateOccupation = async (req, res) => {
  try {
    const record = await PatientOccupation.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    await record.update(req.body);
    res.json({ data: record });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteOccupation = async (req, res) => {
  try {
    const record = await PatientOccupation.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    await record.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
