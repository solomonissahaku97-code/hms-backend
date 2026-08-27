const { PatientAllergy } = require('../models');

exports.createAllergy = async (req, res) => {
  try {
    const allergy = await PatientAllergy.create(req.body);
    res.status(201).json({ message: 'Allergy recorded', data: allergy });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create allergy', details: err.message });
  }
};

exports.getPatientAllergies = async (req, res) => {
  try {
    const where = { patient_id: req.params.patient_id };
    if (req.query.institution_id) where.institution_id = req.query.institution_id;
    const allergies = await PatientAllergy.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ data: allergies });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch allergies', details: err.message });
  }
};

exports.updateAllergy = async (req, res) => {
  try {
    const allergy = await PatientAllergy.findByPk(req.params.id);
    if (!allergy) return res.status(404).json({ error: 'Allergy not found' });
    await allergy.update(req.body);
    res.json({ message: 'Allergy updated', data: allergy });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update allergy', details: err.message });
  }
};

exports.deleteAllergy = async (req, res) => {
  try {
    const allergy = await PatientAllergy.findByPk(req.params.id);
    if (!allergy) return res.status(404).json({ error: 'Allergy not found' });
    await allergy.update({ is_active: false });
    res.json({ message: 'Allergy deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete allergy', details: err.message });
  }
};

exports.checkDrugAllergies = async (req, res) => {
  try {
    const { patient_id, drug_name } = req.query;
    if (!patient_id || !drug_name) return res.status(400).json({ error: 'patient_id and drug_name are required' });

    const allergies = await PatientAllergy.findAll({ where: { patient_id, allergy_type: 'drug', is_active: true } });
    const matches = allergies.filter(a => a.allergen.toLowerCase().includes(drug_name.toLowerCase()));

    res.json({ has_allergy: matches.length > 0, allergies: matches, warning: matches.length > 0 ? 'Patient has known allergy to this medication!' : null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check allergies', details: err.message });
  }
};

exports.getAllergySummary = async (req, res) => {
  try {
    const allergies = await PatientAllergy.findAll({ where: { patient_id: req.params.patient_id, is_active: true } });
    const summary = { drug: [], food: [], environmental: [], biological: [], other: [] };
    allergies.forEach(a => { if (summary[a.allergy_type]) summary[a.allergy_type].push({ id: a.id, allergen: a.allergen, severity: a.severity }); });
    const severeCount = allergies.filter(a => a.severity === 'severe' || a.severity === 'anaphylaxis').length;
    res.json({ summary, total_allergies: allergies.length, severe_allergies: severeCount, has_critical_allergy: severeCount > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch allergy summary', details: err.message });
  }
};
