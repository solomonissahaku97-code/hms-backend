// controllers/partographController.js

const { Op } = require("sequelize");
const Partograph = require("../../models/partograph");
const Visit = require("../../models/Visit");
const { evaluatePartographRecord } = require("../../utils/partographUtils");





// ➕ Add record
exports.addPartographRecord = async (req, res) => {
    try {
        const { visit_id, cervical_dilatation, contractions, fetal_heart_rate, maternal_pulse, bp_systolic, bp_diastolic, remark } = req.body;

        // Check visit exists
        const visit = await Visit.findByPk(visit_id);
        if (!visit) {
            return res.status(404).json({ message: "Visit not found" });
        }

        // Get first record at 4cm as reference
        const firstActiveRecord = await Partograph.findOne({
            where: { visit_id, cervical_dilatation: { [Op.gte]: 4 } },
            order: [["record_time", "ASC"]],
        });
        const startTime = firstActiveRecord?.record_time

        // Evaluate risk factors
        const evaluation = evaluatePartographRecord(req.body, startTime);

        const record = await Partograph.create({
            visit_id,
            cervical_dilatation,
            contractions_frequency:contractions,
            fetal_heart_rate,
            pulse:maternal_pulse,
            bp_systolic,
            bp_diastolic,
            remark,
            alert: evaluation.alert,
            action: evaluation.action,
            risk_alerts: evaluation.riskAlerts, // store as JSON array
        });

        res.status(201).json({ message: "Partograph record added successfully", record });
    } catch (error) {
        console.error("Add Partograph Error:", error);
        res.status(500).json({ message: "Failed to add partograph record", error: error.message });
    }
};

// ✏️ Update record
exports.updatePartographRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await Partograph.findByPk(id);

        if (!record) {
            return res.status(404).json({ message: "Record not found" });
        }

        await record.update(req.body);

        res.json({ message: "Partograph record updated successfully", record });
    } catch (error) {
        console.error("Update Partograph Error:", error);
        res.status(500).json({ message: "Failed to update partograph record", error: error.message });
    }
};

// ❌ Delete record
exports.deletePartographRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await Partograph.findByPk(id);

        if (!record) {
            return res.status(404).json({ message: "Record not found" });
        }

        await record.destroy();

        res.json({ message: "Partograph record deleted successfully" });
    } catch (error) {
        console.error("Delete Partograph Error:", error);
        res.status(500).json({ message: "Failed to delete partograph record", error: error.message });
    }
};

// 📥 Get records for a visit
exports.getPartographByVisit = async (req, res) => {
    try {
        const { visit_id } = req.params;

        const records = await Partograph.findAll({
            where: { visit_id },
            order: [['createdAt', 'ASC']]
        });

        res.json({ visit_id, records });
    } catch (error) {
        console.error("Get Partograph Error:", error);
        res.status(500).json({ message: "Failed to fetch partograph records", error: error.message });
    }
};
