// controllers/maternity/ultrasoundController.js
const Department = require("../../models/department");
const Ultrasound = require("../../models/maternity/Ultrasound");
const { Op, fn, col, literal } = require("sequelize");
const Staff = require("../../models/staff");
// ✅ Create an ultrasound record
exports.createUltrasound = async (req, res) => {
    try {
        const { visit_id, department_id, gestational_age, scan_type, indication, findings, conclusion, performed_by } = req.body;

        // Handle uploaded images
        const imagePaths = req.files ? req.files.map(file => file.path) : [];

        console.log(req.body)

        const ultrasound = await Ultrasound.create({
            visit_id,
            department_id,
            gestational_age,
            scan_type,
            indication,
            findings,
            conclusion,
            performed_by,
            images: imagePaths,
        });

        res.status(201).json({ success: true, data: ultrasound });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ✅ Get all ultrasounds
exports.getAllUltrasounds = async (req, res) => {
    try {
        const ultrasounds = await Ultrasound.findAll({
            include: ["visit", "staff"],
            order: [["date", "DESC"]],
        });

        res.json({ success: true, data: ultrasounds });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Get ultrasound by ID
exports.getUltrasoundById = async (req, res) => {
    try {
        const { id } = req.params;
        const ultrasound = await Ultrasound.findAll({
            where: {
                visit_id: id
            },

        }, {
            include: ["visit", "staff"],
        });

        if (!ultrasound)
            return res.status(404).json({ success: false, message: "Not found" });

        res.json({ success: true, data: ultrasound });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Update ultrasound
exports.updateUltrasound = async (req, res) => {
    try {
        const { id } = req.params;
        const ultrasound = await Ultrasound.findByPk(id);

        if (!ultrasound)
            return res.status(404).json({ success: false, message: "Not found" });

        await ultrasound.update(req.body);

        res.json({ success: true, data: ultrasound });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Delete ultrasound
exports.deleteUltrasound = async (req, res) => {
    try {
        const { id } = req.params;
        const ultrasound = await Ultrasound.findByPk(id);

        if (!ultrasound)
            return res.status(404).json({ success: false, message: "Not found" });

        await ultrasound.destroy();

        res.json({ success: true, message: "Ultrasound deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Statistics (e.g., total count, by department, by scan type, date range)
exports.getUltrasoundStats = async (req, res) => {
    try {
        const { department_id, start_date, end_date } = req.query;

        let where = {};
        if (department_id) where.department_id = department_id;
        if (start_date && end_date) {
            where.date = { [Op.between]: [start_date, end_date] };
        }

        // ✅ Total count
        const total = await Ultrasound.count({ where });

        // ✅ By scan type
        const byScanType = await Ultrasound.findAll({
            where,
            attributes: ["scan_type", [fn("COUNT", col("id")), "count"]],
            group: ["scan_type"],
        });

        // ✅ By month (trend analysis)
        const byMonth = await Ultrasound.findAll({
            where,
            attributes: [
                [fn("DATE_TRUNC", "month", col("date")), "month"],
                [fn("COUNT", col("id")), "count"],
            ],
            group: [literal(`DATE_TRUNC('month', "date")`)],
            order: [[literal(`month`), "ASC"]],
        });

        const byDepartment = await Ultrasound.findAll({
            where,
            attributes: [
                "department_id",
                [fn("COUNT", col("Ultrasound.id")), "count"],
            ],
            include: [
                {
                    model: Department,
                    as: "department",
                    attributes: ["id", "name"],
                },
            ],
            group: ["department_id", "department.id", "department.name"],
            order: [[literal("count"), "DESC"]],
        });


        // ✅ By staff (who performed more scans)
        const byStaff = await Ultrasound.findAll({
            where,
            attributes: [
                "performed_by",
                [fn("COUNT", col("Ultrasound.id")), "count"],
            ],
            include: [
                {
                    model: Staff,
                    as: "staff",
                    attributes: ["id", "firstName", "lastName", ],
                },
            ],
            group: ["performed_by", "staff.id", "staff.firstName", "staff.lastName"],
            order: [[literal("count"), "DESC"]],
        });


        // ✅ Top indications (reason for scan)
        const byIndication = await Ultrasound.findAll({
            where,
            attributes: ["indication", [fn("COUNT", col("id")), "count"]],
            group: ["indication"],
            order: [[literal("count"), "DESC"]],
            limit: 5, // top 5 most common
        });

        res.json({
            success: true,
            data: {
                total,
                byScanType,
                byMonth,
                byStaff,
                byDepartment,
                topIndications: byIndication,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
