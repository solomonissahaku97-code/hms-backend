
const { ClinicalIntervention, Prescription, Staff } = require('../../models');
const { Op } = require('sequelize');

// Create a new clinical intervention
exports.createIntervention = async (req, res) => {
  try {
    const { prescription_id, issue_type, description, severity, outcome,visit_id,intervened_by } = req.body;
    console.log(req.body)
    
    // Basic validation
    if (!prescription_id || !issue_type || !severity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const intervention = await ClinicalIntervention.create({
      prescription_id,
      issue_type,
      description,
      severity,
      outcome,
      intervened_by, // Assuming user ID is in the request 
      prescriber_response: 'pending',
      visit_id
    });

    res.status(201).json(intervention);  
  } catch (error) {
    console.error('Error creating clinical intervention:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all interventions (with filtering)
exports.getAllInterventions = async (req, res) => {
  try {
    const { prescription_id, severity, issue_type, start_date, end_date } = req.query;
    const where = {};

    if (prescription_id) where.prescription_id = prescription_id;
    if (severity) where.severity = severity;
    if (issue_type) where.issue_type = issue_type;
    
    if (start_date && end_date) {
      where.intervention_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }

    const interventions = await ClinicalIntervention.findAll({
      where,
      include: [
        { model: Prescription, as: 'prescription' },
        { model: Staff, as: 'intervenedBy' }
      ],
      order: [['intervention_date', 'DESC']]
    });

    res.json(interventions);
  } catch (error) {
    console.error('Error fetching clinical interventions:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get intervention by ID
exports.getInterventionById = async (req, res) => {
  try {
    const intervention = await ClinicalIntervention.findByPk(req.params.id, {
      include: [
        { model: Prescription, as: 'prescription' },
        { model: Staff, as: 'intervenedBy' }
      ]
    });

    if (!intervention) {
      return res.status(404).json({ error: 'Clinical intervention not found' });
    }

    res.json(intervention);
  } catch (error) {
    console.error('Error fetching clinical intervention:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update an intervention
exports.updateIntervention = async (req, res) => {
  try {
    const { description, severity, outcome, prescriber_response } = req.body;
    
    const intervention = await ClinicalIntervention.findByPk(req.params.id);
    if (!intervention) {
      return res.status(404).json({ error: 'Clinical intervention not found' });
    }

    // Only allow certain fields to be updated
    const updates = {};
    if (description !== undefined) updates.description = description;
    if (severity !== undefined) updates.severity = severity;
    if (outcome !== undefined) updates.outcome = outcome;
    if (prescriber_response !== undefined) updates.prescriber_response = prescriber_response;

    await intervention.update(updates);
    res.json(intervention);
  } catch (error) {
    console.error('Error updating clinical intervention:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete an intervention
exports.deleteIntervention = async (req, res) => {
  try {
    const intervention = await ClinicalIntervention.findByPk(req.params.id);
    if (!intervention) {
      return res.status(404).json({ error: 'Clinical intervention not found' });
    }

    await intervention.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting clinical intervention:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get interventions for a specific prescription
exports.getInterventionsByPrescription = async (req, res) => {
  try {
    const interventions = await ClinicalIntervention.findAll({
      where: { prescription_id: req.params.prescription_id },
      include: [
        { model: Staff, as: 'intervenedBy' }
      ],
      order: [['intervention_date', 'DESC']]
    });

    res.json(interventions);
  } catch (error) {
    console.error('Error fetching prescription interventions:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update prescriber response
exports.updatePrescriberResponse = async (req, res) => {
  try {
    const { response } = req.body;
    const validResponses = ['accepted', 'rejected', 'modified', 'pending'];

    if (!validResponses.includes(response)) {
      return res.status(400).json({ error: 'Invalid response value' });
    }

    const intervention = await ClinicalIntervention.findByPk(req.params.id);
    if (!intervention) {
      return res.status(404).json({ error: 'Clinical intervention not found' });
    }

    await intervention.update({ prescriber_response: response });
    res.json(intervention);
  } catch (error) {
    console.error('Error updating prescriber response:', error);
    res.status(500).json({ error: error.message });
  }
};


