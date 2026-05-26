const Joi = require("joi");
const MedicalHistory = require("../../models/MedicalHistory");

// Joi Schema for validation
const medicalHistorySchema = Joi.object({
    patient_id: Joi.string().required(),
    institution_id: Joi.string().required(),
    chronic_conditions: Joi.string().allow("").optional(),
    past_surgeries: Joi.string().allow("").optional(),
    blood_transfusions: Joi.boolean().default(false),
    allergies: Joi.string().allow("").optional(),
    medications: Joi.string().allow("").optional(),
});

// Create Medical History
exports.createMedicalHistory = async (req, res) => {
    const { error, value } = medicalHistorySchema.validate(req.body, { abortEarly: false });

    if (error) {
        return res.status(400).json({ errors: error.details.map((err) => err.message) });
    }

    try {
        const medicalHistory = await MedicalHistory.create(value);
        res.status(201).json(medicalHistory);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Get All Medical Histories
exports.getAllMedicalHistories = async (req, res) => {
    try {
        const medicalHistories = await MedicalHistory.findAll();
        res.status(200).json(medicalHistories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get Single Medical History
exports.getMedicalHistoryById = async (req, res) => {
    try {
        const medicalHistory = await MedicalHistory.findByPk(req.params.id);
        if (!medicalHistory) {
            return res.status(404).json({ error: "Medical history not found" });
        }
        res.status(200).json(medicalHistory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update Medical History
exports.updateMedicalHistory = async (req, res) => {
    const { error, value } = medicalHistorySchema.validate(req.body, { abortEarly: false });

    if (error) {
        return res.status(400).json({ errors: error.details.map((err) => err.message) });
    }

    try {
        const medicalHistory = await MedicalHistory.findByPk(req.params.id);
        if (!medicalHistory) {
            return res.status(404).json({ error: "Medical history not found" });
        }
        await medicalHistory.update(value);
        res.status(200).json(medicalHistory);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete Medical History
exports.deleteMedicalHistory = async (req, res) => {
    try {
        const medicalHistory = await MedicalHistory.findByPk(req.params.id);
        if (!medicalHistory) {
            return res.status(404).json({ error: "Medical history not found" });
        }
        await medicalHistory.destroy();
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
