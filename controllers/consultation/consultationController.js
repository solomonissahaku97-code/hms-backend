const { where } = require("sequelize");
const Consultation = require("../../models/Consultation");
const Institution = require("../../models/institution");
const Record = require("../../models/record");
const { sendNotificationToDepartment } = require('../../helpers/sendPushNotification');
const { createNotification } = require('../../helpers/notificationService');
const Department = require("../../models/department");
const Patient = require("../../models/patient");

// Request a consultation
exports.requestConsultation = async (req, res) => {
    try {
        const { institution_id, visit_id } = req.body;

        // Create the consultation request
        const consultation = await Consultation.create({
            institution_id,
            visit_id,
            status: 'pending'
        });

        // Fetch all consultation departments in the institution
        const consultationDepartments = await Department.findAll({
            where: {
                institution_id,
                departmentType: 'Consultation'
            }
        });

        // Send notification to all consultation departments
        for (const department of consultationDepartments) {
            await sendNotificationToDepartment({
                department_id: department.id,
                institution_id,
                title: "Patient Ready for Consultation",
                body: `A new consultation request has been made. Please attend to the patient.`,
            });
            await createNotification({
                toDepartmentId: department.id,
                institutionId: institution_id,
                title: "Patient Ready for Consultation",
                description: `A new consultation request has been made. Please attend to the patient`,
            });
        }

        res.status(201).json({ message: 'Consultation requested successfully', consultation });
    } catch (error) {
        console.error("Error requesting consultation:", error);
        res.status(500).json({ message: 'Error requesting consultation', error: error.message });
    }
}; 

// Approve a consultation
exports.approveConsultation = async (req, res) => {
    try { 
        const { id } = req.params;
        const consultation = await Consultation.findByPk(id);

        if (!consultation) { 
            return res.status(404).json({ message: 'Consultation not found' });
        }

        consultation.status = 'approved'; 
        await consultation.save();

        res.json({ message: 'Consultation approved successfully', consultation });
    } catch (error) {
        res.status(500).json({ message: 'Error approving consultation', error: error.message });
    }
};

// Reject (Delete) a consultation
exports.rejectConsultation = async (req, res) => {
    try {
        const { id } = req.params;
        const consultation = await Consultation.findByPk(id);

        if (!consultation) {
            return res.status(404).json({ message: 'Consultation not found' });
        }

        await consultation.destroy();

        res.json({ message: 'Consultation request rejected successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting consultation', error: error.message });
    }
};

// Get consultation results
exports.getConsultationResults = async (req, res) => {
    try {
        const { institution_id } = req.query;
        const consultation = await Consultation.findAll({
            include: [
                {
                    model: Record, as: 'record', include: [
                        {
                            model: Patient,
                            as: 'patient'
                        }
                    ]
                }
            ],
            where: {
                institution_id
            }
        });

        if (!consultation || consultation.length === 0) {
            return res.status(404).json({ message: 'No consultations found' });
        }

        res.json({ message: 'Consultation details retrieved successfully', consultation });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error retrieving consultation results', error: error.message });
    }
};








