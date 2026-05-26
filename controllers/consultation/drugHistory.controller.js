const DrugHistory = require("../../models/DrugHistory");

// CREATE
exports.createDrugHistory = async (req, res) => {
    try {
        const { 
            visit_id, 
            drug_name, 
            dosage, 
            frequency, 
            route, 
            start_date, 
            end_date 
        } = req.body;

        if (!visit_id || !drug_name) {
            return res.status(400).json({
                success: false,
                message: "visit_id and drug_name are required"
            });
        }

        const record = await DrugHistory.create({
            visit_id,
            drug_name,
            dosage,
            frequency,
            route,
            start_date,
            end_date
        });

        return res.status(201).json({
            success: true,
            message: "Drug history created successfully",
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
exports.getAllDrugHistories = async (req, res) => {
    try {
        const { visit_id } = req.query;

        const where = visit_id ? { visit_id } : {};

        const records = await DrugHistory.findAll({
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
exports.getDrugHistoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await DrugHistory.findByPk(id);

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
exports.updateDrugHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await DrugHistory.findByPk(id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Record not found"
            });
        }

        await record.update(req.body);

        return res.status(200).json({
            success: true,
            message: "Drug history updated successfully",
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
exports.deleteDrugHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await DrugHistory.findByPk(id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Record not found"
            });
        }

        await record.destroy(); // paranoid true → soft delete

        return res.status(200).json({
            success: true,
            message: "Drug history deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

