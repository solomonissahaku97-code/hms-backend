const { Diagnosis } = require('../models');
const { v4: uuidv4 } = require('uuid');

exports.addDiagnosis = async (req, res) => {
  try {
    const { visit_id, institution_id, staff_id, system_diagnosis_ids, department_id, chief_complain, doctor_evaluation } = req.body;

    if (!visit_id || !staff_id || !system_diagnosis_ids) {
      return res.status(400).json({ error: 'visit_id, staff_id, and system_diagnosis_ids are required' });
    }

    const groupId = uuidv4();
    const diagnoses = await Promise.all(
      system_diagnosis_ids.map(system_diagnosis_id =>
        Diagnosis.create({ visit_id, institution_id, staff_id, system_diagnosis_id, doctor_evaluation, chief_complain, department_id, diagnosis_group_id: groupId })
      )
    );

    res.status(201).json({ message: 'Diagnoses added', data: diagnoses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add diagnosis', details: err.message });
  }
};

exports.getPatientDiagnoses = async (req, res) => {
  try {
    const { visit_id } = req.query;
    if (!visit_id) return res.status(400).json({ error: 'visit_id is required' });

    const diagnoses = await Diagnosis.findAll({ where: { visit_id }, order: [['createdAt', 'DESC']] });
    res.json({ data: diagnoses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch diagnoses', details: err.message });
  }
};

exports.updateDiagnosis = async (req, res) => {
  try {
    const diagnosis = await Diagnosis.findByPk(req.params.id);
    if (!diagnosis) return res.status(404).json({ error: 'Diagnosis not found' });

    await diagnosis.update(req.body);
    res.json({ message: 'Diagnosis updated', data: diagnosis });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update diagnosis', details: err.message });
  }
};

exports.deleteDiagnosis = async (req, res) => {
  try {
    const diagnosis = await Diagnosis.findByPk(req.params.id);
    if (!diagnosis) return res.status(404).json({ error: 'Diagnosis not found' });

    await diagnosis.destroy();
    res.json({ message: 'Diagnosis deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete diagnosis', details: err.message });
  }
};
