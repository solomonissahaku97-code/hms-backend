const { Consultation } = require('../models');

exports.requestConsultation = async (req, res) => {
  try {
    const { institution_id, visit_id } = req.body;
    if (!institution_id || !visit_id) return res.status(400).json({ error: 'institution_id and visit_id are required' });

    const consultation = await Consultation.create({ institution_id, visit_id, status: 'pending' });
    res.status(201).json({ message: 'Consultation requested', data: consultation });
  } catch (err) {
    res.status(500).json({ error: 'Failed to request consultation', details: err.message });
  }
};

exports.getAllConsultations = async (req, res) => {
  try {
    const { institution_id, status } = req.query;
    const where = {};
    if (institution_id) where.institution_id = institution_id;
    if (status) where.status = status;

    const consultations = await Consultation.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ data: consultations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch consultations', details: err.message });
  }
};

exports.approveConsultation = async (req, res) => {
  try {
    const consultation = await Consultation.findByPk(req.params.id);
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

    await consultation.update({ status: 'approved' });
    res.json({ message: 'Consultation approved', data: consultation });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve consultation', details: err.message });
  }
};

exports.rejectConsultation = async (req, res) => {
  try {
    const consultation = await Consultation.findByPk(req.params.id);
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

    await consultation.destroy();
    res.json({ message: 'Consultation rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject consultation', details: err.message });
  }
};
