const { PreOpChecklist, TheatrePatient } = require('../models');
const { Op } = require('sequelize');

// Default pre-op checklist template
const defaultTemplate = [
  { section: 'Patient Identification', items: [
    { id: 'pi1', label: 'Patient name confirmed', status: 'pending', required: true },
    { id: 'pi2', label: 'Date of birth verified', status: 'pending', required: true },
    { id: 'pi3', label: 'Hospital number verified', status: 'pending', required: true },
    { id: 'pi4', label: 'Consent form signed', status: 'pending', required: true },
  ]},
  { section: 'Allergy Check', items: [
    { id: 'ac1', label: 'Allergy status checked', status: 'pending', required: true },
    { id: 'ac2', label: 'Allergy band applied', status: 'pending', required: true },
  ]},
  { section: 'Surgical Site', items: [
    { id: 'ss1', label: 'Surgical site marked', status: 'pending', required: true },
    { id: 'ss2', label: 'Site preparation completed', status: 'pending', required: true },
  ]},
  { section: 'Pre-Op Assessment', items: [
    { id: 'pa1', label: 'Vital signs recorded', status: 'pending', required: true },
    { id: 'pa2', label: 'NPO status confirmed', status: 'pending', required: true },
    { id: 'pa3', label: 'IV access established', status: 'pending', required: true },
    { id: 'pa4', label: 'Pre-op medications given', status: 'pending', required: false },
  ]},
  { section: 'Equipment & Implants', items: [
    { id: 'ei1', label: 'Implants verified', status: 'pending', required: false },
    { id: 'ei2', label: 'Special equipment ready', status: 'pending', required: false },
  ]},
];

exports.createOrGetChecklist = async (req, res) => {
  try {
    const { visit_id, surgery_schedule_id } = req.body;
    if (!visit_id) return res.status(400).json({ error: 'visit_id is required' });

    let checklist = await PreOpChecklist.findOne({ where: { [Op.or]: [{ visit_id }, { surgery_schedule_id }] } });
    if (checklist) return res.json({ message: 'Existing checklist found', data: checklist });

    if (surgery_schedule_id) {
      const theatre = await TheatrePatient.findByPk(surgery_schedule_id);
      if (!theatre) return res.status(400).json({ error: `Invalid surgery_schedule_id: ${surgery_schedule_id}` });
    }

    checklist = await PreOpChecklist.create({ visit_id, surgery_schedule_id: surgery_schedule_id || null, checklist_data: defaultTemplate, status: 'in-progress' });
    res.status(201).json({ data: checklist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create/get checklist', details: err.message });
  }
};

exports.updateChecklist = async (req, res) => {
  try {
    const checklist = await PreOpChecklist.findByPk(req.params.id);
    if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

    const { checklist_data, completed_by } = req.body;

    // Auto-complete if all required items done
    let allRequiredDone = true;
    for (const section of checklist_data) {
      for (const item of section.items) {
        if (item.required && item.status !== 'completed') { allRequiredDone = false; break; }
      }
      if (!allRequiredDone) break;
    }

    await checklist.update({
      checklist_data,
      status: allRequiredDone ? 'completed' : 'in-progress',
      completed_by: allRequiredDone ? completed_by : null,
      completed_at: allRequiredDone ? new Date() : null
    });

    res.json({ message: 'Checklist updated', data: checklist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update checklist', details: err.message });
  }
};

exports.getChecklistByVisit = async (req, res) => {
  try {
    const checklist = await PreOpChecklist.findOne({ where: { visit_id: req.params.visit_id } });
    if (!checklist) return res.status(404).json({ error: 'No checklist found for this visit' });
    res.json({ data: checklist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch checklist', details: err.message });
  }
};

exports.getTemplate = async (req, res) => {
  res.json({ data: defaultTemplate });
};
