const { Sequelize } = require("sequelize");
const { ObstetricHistory, Patient, Institution } = require("../../models");
const Joi = require("joi");

// Validation schema using Joi
const obstetricHistorySchema = Joi.object({
    patient_id: Joi.string().guid({ version: "uuidv4" }).required(),
    institution_id: Joi.string().guid({ version: "uuidv4" }).required(),
    gravida: Joi.number().integer().min(0),
    parity: Joi.number().integer().min(0),
    miscarriages: Joi.number().integer().min(0).allow(null),
    stillbirths: Joi.number().integer().min(0).allow(null),
    c_section: Joi.boolean().default(false),
    complications: Joi.string().allow(null, ""),
});

// Create Obstetric History
exports.createObstetricHistory = async (req, res) => {
    const { error, value } = obstetricHistorySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const transaction = await ObstetricHistory.sequelize.transaction();
    try {
        // Ensure patient and institution exist
        const patientExists = await Patient.findByPk(value.patient_id);
        const institutionExists = await Institution.findByPk(value.institution_id);
        if (!patientExists || !institutionExists) {
            return res.status(404).json({ error: "Patient or Institution not found" });
        }

        const obstetricHistory = await ObstetricHistory.create(value, { transaction });
        await transaction.commit();
        res.status(201).json(obstetricHistory);
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Get All Obstetric Histories
exports.getAllObstetricHistories = async (req, res) => {
    try {
        const obstetricHistories = await ObstetricHistory.findAll({
            include: [
                { model: Patient, attributes: ["id", "name"] },
                { model: Institution, attributes: ["id", "name"] },
            ],
        });
        res.status(200).json(obstetricHistories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get Single Obstetric History
exports.getObstetricHistoryById = async (req, res) => {
    try {
        const obstetricHistory = await ObstetricHistory.findByPk(req.params.id, {
            include: [
                { model: Patient, attributes: ["id", "name"] },
                { model: Institution, attributes: ["id", "name"] },
            ],
        });

        if (!obstetricHistory) {
            return res.status(404).json({ error: "Obstetric history not found" });
        }
        res.status(200).json(obstetricHistory);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Obstetric History
exports.updateObstetricHistory = async (req, res) => {
    const { error, value } = obstetricHistorySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const transaction = await ObstetricHistory.sequelize.transaction();
    try {
        const obstetricHistory = await ObstetricHistory.findByPk(req.params.id);
        if (!obstetricHistory) {
            return res.status(404).json({ error: "Obstetric history not found" });
        }

        await obstetricHistory.update(value, { transaction });
        await transaction.commit();
        res.status(200).json(obstetricHistory);
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ error: error.message });
    }
};

// Delete Obstetric History
exports.deleteObstetricHistory = async (req, res) => {
    const transaction = await ObstetricHistory.sequelize.transaction();
    try {
        const obstetricHistory = await ObstetricHistory.findByPk(req.params.id);
        if (!obstetricHistory) {
            return res.status(404).json({ error: "Obstetric history not found" });
        }

        await obstetricHistory.destroy({ transaction });
        await transaction.commit();
        res.status(204).send();
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({ error: error.message });
    }
};
