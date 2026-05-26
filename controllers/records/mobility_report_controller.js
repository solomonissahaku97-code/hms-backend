const { Op } = require("sequelize");
const Diagnosis = require("../../models/diagnosis");
const Patient = require("../../models/patient");


exports.getMorbidityReport = async (req, res) => {
    try {
        const { institution_id, startDate, endDate } = req.query;

        if (!institution_id) {
            return res.status(400).json({ message: "Institution ID is required" });
        }

        // Fetch morbidity data
        const morbidityData = await Diagnosis.findAll({
            include: [
                {
                    model: Patient,
                    as: "patient",
                    where: { institution_id },
                    attributes: ["id"],
                },
            ],
            where: {
                createdAt: {
                    [Op.between]: [startDate || "2000-01-01", endDate || new Date()],
                },
            },
            attributes: ["diagnosis_name"],
        });

        // Count occurrences of each diagnosis
        const diagnosisCount = {};
        morbidityData.forEach((entry) => {
            const diagnosis = entry.diagnosis_name;
            diagnosisCount[diagnosis] = (diagnosisCount[diagnosis] || 0) + 1;
        });

        // Format response for the frontend
        const reportData = Object.keys(diagnosisCount).map((key) => ({
            diagnosis: key,
            count: diagnosisCount[key],
        }));

        res.json(reportData);
    } catch (error) {
        console.error("Error fetching morbidity report:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
