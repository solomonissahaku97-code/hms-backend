const PatientOccupationHistory = require("../../models/PatientOccupation");

// CREATE
exports.createOccupation = async (req, res) => {
    try {
        const { visit_id, occupation, start_date, end_date } = req.body;

        if (!visit_id || !occupation) {
            return res.status(400).json({
                success: false,
                message: "visit_id and occupation are required"
            });
        }

        const record = await PatientOccupationHistory.create({
            visit_id,
            occupation,
            start_date,
            end_date
        });

        return res.status(201).json({
            success: true,
            message: "Occupation history created successfully",
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
exports.getAllOccupations = async (req, res) => {
    try {
        const { visit_id } = req.query;

        const where = visit_id ? { visit_id } : {};

        const records = await PatientOccupationHistory.findAll({
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
exports.getOccupationById = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await PatientOccupationHistory.findByPk(id);

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
exports.updateOccupation = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await PatientOccupationHistory.findByPk(id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Record not found"
            });
        }

        await record.update(req.body);

        return res.status(200).json({
            success: true,
            message: "Occupation history updated successfully",
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
exports.deleteOccupation = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await PatientOccupationHistory.findByPk(id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Record not found"
            });
        }

        await record.destroy(); // paranoid true → soft delete

        return res.status(200).json({
            success: true,
            message: "Occupation history deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
