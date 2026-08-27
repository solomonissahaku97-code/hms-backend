const { Prescription, sequelize } = require('../models');

exports.createPrescription = async (req, res) => {
  try {
    const { patient_id, visit_id, medication_id, dosage, frequency, duration, quantity, route, doseUnitType, notes, institution_id, department_id, prescribing_staff_id, doctor_id, is_emergency } = req.body;

    if (!institution_id) return res.status(400).json({ error: 'institution_id is required' });

    const prescription = await Prescription.create({
      patient_id, visit_id, medication_id, dosage, frequency, duration, quantity, route, doseUnitType, notes, institution_id, department_id, prescribing_staff_id, doctor_id, is_emergency: is_emergency || false, status: 'pending'
    });

    res.status(201).json({ message: 'Prescription created', data: prescription });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create prescription', details: err.message });
  }
};

exports.getAllPrescriptions = async (req, res) => {
  try {
    const { institution_id, patient_id, visit_id, status } = req.query;
    const where = {};
    if (institution_id) where.institution_id = institution_id;
    if (patient_id) where.patient_id = patient_id;
    if (visit_id) where.visit_id = visit_id;
    if (status) where.status = status;

    const prescriptions = await Prescription.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ data: prescriptions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prescriptions', details: err.message });
  }
};

exports.getPrescriptionById = async (req, res) => {
  try {
    const prescription = await Prescription.findByPk(req.params.id);
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    res.json({ data: prescription });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prescription', details: err.message });
  }
};

exports.dispensePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findByPk(req.params.id);
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (prescription.status !== 'pending') return res.status(400).json({ error: 'Only pending prescriptions can be dispensed' });

    await prescription.update({ status: 'dispensed', is_dispensed: true, pharmacist_note: req.body.pharmacist_note });
    res.json({ message: 'Prescription dispensed', data: prescription });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dispense prescription', details: err.message });
  }
};

exports.cancelPrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findByPk(req.params.id);
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

    await prescription.update({ status: 'canceled' });
    res.json({ message: 'Prescription cancelled', data: prescription });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel prescription', details: err.message });
  }
};

exports.updatePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findByPk(req.params.id);
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (prescription.status !== 'pending') return res.status(400).json({ error: 'Only pending prescriptions can be edited' });

    await prescription.update(req.body);
    res.json({ message: 'Prescription updated', data: prescription });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update prescription', details: err.message });
  }
};

exports.deletePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findByPk(req.params.id);
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

    await prescription.destroy();
    res.json({ message: 'Prescription deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete prescription', details: err.message });
  }
};
