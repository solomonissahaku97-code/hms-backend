const { Op } = require("sequelize");
const PregnancyHistory = require("../../models/PregnancyHistory");

// Create a new pregnancy history record
exports.createPregnancyHistory = async (req, res) => {
  try {
    const { patient_id, institution_id, ...historyData } = req.body;

    if (!patient_id || !institution_id) {
      return res.status(400).json({ message: "Patient ID and Institution ID are required." });
    }

    const history = await PregnancyHistory.create({
      patient_id,
      institution_id,
      ...historyData,
    });

    res.status(201).json({ message: "Pregnancy history added successfully.", history });
  } catch (error) {
    console.error("Error creating pregnancy history:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get all pregnancy history records for a specific patient
exports.getPregnancyHistoryByPatient = async (req, res) => {
  try {
    const { patient_id } = req.params;

    if (!patient_id) {
      return res.status(400).json({ message: "Patient ID is required." });
    }

    const histories = await PregnancyHistory.findAll({
      where: { patient_id },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(histories);
  } catch (error) {
    console.error("Error fetching pregnancy history:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Update a pregnancy history record
exports.updatePregnancyHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    const history = await PregnancyHistory.findByPk(id);
    if (!history) {
      return res.status(404).json({ message: "Pregnancy history not found." });
    }

    await history.update(updatedData);

    res.status(200).json({ message: "Pregnancy history updated successfully.", history });
  } catch (error) {
    console.error("Error updating pregnancy history:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Delete a pregnancy history record
exports.deletePregnancyHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await PregnancyHistory.findByPk(id);
    if (!history) {
      return res.status(404).json({ message: "Pregnancy history not found." });
    }

    await history.destroy();
    res.status(200).json({ message: "Pregnancy history deleted successfully." });
  } catch (error) {
    console.error("Error deleting pregnancy history:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
