const { FamilyHealthHistory } = require('../models');

exports.createFamilyHistory = async (req, res) => {
  try {
    const history = await FamilyHealthHistory.create(req.body);
    res.status(201).json({ message: 'Family history recorded', data: history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create family history', details: err.message });
  }
};

exports.getPatientFamilyHistory = async (req, res) => {
  try {
    const histories = await FamilyHealthHistory.findAll({ where: { patient_id: req.params.patient_id, is_active: true }, order: [['createdAt', 'DESC']] });
    res.json({ data: histories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch family history', details: err.message });
  }
};

exports.updateFamilyHistory = async (req, res) => {
  try {
    const history = await FamilyHealthHistory.findByPk(req.params.id);
    if (!history) return res.status(404).json({ error: 'Family history not found' });
    await history.update(req.body);
    res.json({ message: 'Family history updated', data: history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update family history', details: err.message });
  }
};

exports.deleteFamilyHistory = async (req, res) => {
  try {
    const history = await FamilyHealthHistory.findByPk(req.params.id);
    if (!history) return res.status(404).json({ error: 'Family history not found' });
    await history.update({ is_active: false });
    res.json({ message: 'Family history deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete family history', details: err.message });
  }
};

exports.getFamilyHistorySummary = async (req, res) => {
  try {
    const histories = await FamilyHealthHistory.findAll({ where: { patient_id: req.params.patient_id, is_active: true } });
    const summary = { father: [], mother: [], siblings: [], grandparents: [], other: [] };
    histories.forEach(fh => {
      if (['father'].includes(fh.relationship)) summary.father.push(...(fh.conditions || []));
      else if (['mother'].includes(fh.relationship)) summary.mother.push(...(fh.conditions || []));
      else if (['brother', 'sister'].includes(fh.relationship)) summary.siblings.push(...(fh.conditions || []));
      else if (['grandfather', 'grandmother'].includes(fh.relationship)) summary.grandparents.push(...(fh.conditions || []));
      else summary.other.push(...(fh.conditions || []));
    });
    res.json({ summary, total_family_members: histories.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary', details: err.message });
  }
};
