const PastMedicalHistory = require("../../models/PastMedicalHistory");

// CREATE
exports.createPastMedicalHistory = async (req, res) => {
    try {
        const { 
            visit_id, 
            condition, 
            diagnosis_date, 
            status, 
            treatment, 
            notes 
        } = req.body;

        if (!visit_id || !condition) {
            return res.status(400).json({
                success: false,
                message: "visit_id and condition are required"
            });
        }

        const record = await PastMedicalHistory.create({
            visit_id,
            condition,
            diagnosis_date,
            status,
            treatment,
            notes
        });

        return res.status(201).json({
            success: true,
            message: "Past medical history created successfully",
            data: record
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// GET ALL (optionally filter by visit_id)
exports.getAllPastMedicalHistories = async (req, res) => {
    try {
        const { visit_id } = req.query;

        const where = visit_id ? { visit_id } : {};

        const records = await PastMedicalHistory.findAll({
            where,
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            success: true,
            count: records.length,
            data: records
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// GET BY ID
exports.getPastMedicalHistoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await PastMedicalHistory.findByPk(id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Record not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: record
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// UPDATE
exports.updatePastMedicalHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await PastMedicalHistory.findByPk(id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Record not found"
            });
        }

        await record.update(req.body);

        return res.status(200).json({
            success: true,
            message: "Past medical history updated successfully",
            data: record
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// SOFT DELETE
exports.deletePastMedicalHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await PastMedicalHistory.findByPk(id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Record not found"
            });
        }

        await record.destroy(); // paranoid true → soft delete

        return res.status(200).json({
            success: true,
            message: "Past medical history deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

