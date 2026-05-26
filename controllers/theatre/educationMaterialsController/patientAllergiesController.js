const PatientAllergies = require("../../../models/theatre/PatientAllergies");
const Visit = require("../../../models/Visit");


exports.createAllergy = async (req, res) => {
  try {
    const { visit_id, allergies, severity, notes } = req.body;

    const record = await PatientAllergies.create({
      visit_id,
      allergies,
      severity,
      notes,
    });

    res.status(201).json({
      message: 'Allergy record created successfully',
      data: record,
    });
  } catch (error) {
    console.error('❌ Error creating allergy:', error);
    res.status(500).json({ message: 'Failed to create allergy record', error: error.message });
  }
};

exports.getAllAllergies = async (req, res) => {
  try {
    const { visit_id } = req.query;

    const where = {};
    if (visit_id) where.visit_id = visit_id;

    const allergies = await PatientAllergies.findAll({
      where,
      include: [{ model: Visit, as: 'visit' }],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      message: 'Allergies fetched successfully',
      data: allergies,
    });
  } catch (error) {
    console.error('❌ Error fetching allergies:', error);
    res.status(500).json({ message: 'Failed to fetch allergies', error: error.message });
  }
};

exports.getAllergyById = async (req, res) => {
  try {
    const { id } = req.params;
    const allergy = await PatientAllergies.findByPk(id, {
      include: [{ model: Visit, as: 'visit' }],
    });

    if (!allergy) {
      return res.status(404).json({ message: 'Allergy record not found' });
    }

    res.json({
      message: 'Allergy record retrieved successfully',
      data: allergy,
    });
  } catch (error) {
    console.error('❌ Error retrieving allergy:', error);
    res.status(500).json({ message: 'Failed to retrieve allergy record', error: error.message });
  }
};

exports.updateAllergy = async (req, res) => {
  try {
    const { id } = req.params;
    const { allergies, severity, notes } = req.body;

    const allergy = await PatientAllergies.findByPk(id);
    if (!allergy) {
      return res.status(404).json({ message: 'Allergy record not found' });
    }

    allergy.allergies = allergies || allergy.allergies;
    allergy.severity = severity || allergy.severity;
    allergy.notes = notes || allergy.notes;

    await allergy.save();

    res.json({
      message: 'Allergy record updated successfully',
      data: allergy,
    });
  } catch (error) {
    console.error('❌ Error updating allergy:', error);
    res.status(500).json({ message: 'Failed to update allergy record', error: error.message });
  }
};

exports.deleteAllergy = async (req, res) => {
  try {
    const { id } = req.params;

    const allergy = await PatientAllergies.findByPk(id);
    if (!allergy) {
      return res.status(404).json({ message: 'Allergy record not found' });
    }

    await allergy.destroy();

    res.json({
      message: 'Allergy record deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting allergy:', error);
    res.status(500).json({ message: 'Failed to delete allergy record', error: error.message });
  }
};
 