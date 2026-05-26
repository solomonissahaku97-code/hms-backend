const Institution = require('../models/institution');
const ReportProblem = require('../models/ReportProblem');
const Staff = require('../models/staff');

const createReportProblem = async (req, res) => {
    const { description, institution_id, staff_id } = req.body;
    const screenshot = req.file ? req.file.path : null; // Assuming multer is handling file uploads

    try {
        // Validate that the institution and staff exist
        const institution = await Institution.findByPk(institution_id);
        const staff = await Staff.findByPk(staff_id);

        if (!institution) {
            return res.status(404).json({ message: 'Institution not found.' });
        }

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found.' });
        }

        // Create the problem report
        const reportProblem = await ReportProblem.create({
            description,
            screenshot,
            institution_id,
            staff_id
        });

        return res.status(201).json({
            message: 'Problem reported successfully.',
            report: reportProblem
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while reporting the problem.' });
    }
};

module.exports = {
    createReportProblem
};
