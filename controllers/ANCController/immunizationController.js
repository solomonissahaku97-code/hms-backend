const ImmunizationHistory = require("../../models/ImmunizationHistory");
const Joi = require("joi");

// Joi Schema for Validation
const immunizationSchema = Joi.object({
    patient_id: Joi.string().uuid().required().messages({
        "any.required": "Patient ID is required",
        "string.uuid": "Patient ID must be a valid UUID",
    }),
    institution_id: Joi.string().uuid().required().messages({
        "any.required": "Institution ID is required",
        "string.uuid": "Institution ID must be a valid UUID",
    }),
    tetanus_vaccine: Joi.boolean(),
    rubella: Joi.boolean(),
    hepatitis_b: Joi.boolean(),
    recent_infections: Joi.boolean(),
    hiv_syphilis_tested: Joi.boolean(),
});

// Create Immunization History
exports.createImmunizationHistory = async (req, res) => {
    try {
        // Validate Request Body
        const { error, value } = immunizationSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ errors: error.details.map(err => err.message) });
        }

        const immunizationHistory = await ImmunizationHistory.create(value);
        res.status(201).json(immunizationHistory);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get All Immunization Histories
exports.getAllImmunizationHistories = async (req, res) => {
    try {
        const immunizationHistories = await ImmunizationHistory.findAll();
        res.status(200).json(immunizationHistories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get Single Immunization History
exports.getImmunizationHistoryById = async (req, res) => {
    try {
        const immunizationHistory = await ImmunizationHistory.findByPk(req.params.id);
        if (!immunizationHistory) {
            return res.status(404).json({ error: "Immunization history not found" });
        }
        res.status(200).json(immunizationHistory);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Immunization History
exports.updateImmunizationHistory = async (req, res) => {
    try {
        const immunizationHistory = await ImmunizationHistory.findByPk(req.params.id);
        if (!immunizationHistory) {
            return res.status(404).json({ error: "Immunization history not found" });
        }

        // Validate Request Body
        const { error, value } = immunizationSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ errors: error.details.map(err => err.message) });
        }

        await immunizationHistory.update(value);
        res.status(200).json(immunizationHistory);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete Immunization History
exports.deleteImmunizationHistory = async (req, res) => {
    try {
        const immunizationHistory = await ImmunizationHistory.findByPk(req.params.id);
        if (!immunizationHistory) {
            return res.status(404).json({ error: "Immunization history not found" });
        }
        await immunizationHistory.destroy();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
