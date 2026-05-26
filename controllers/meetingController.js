const { generateMeetingRoom, generateGoodLink } = require("../utils/meetingUtils");
const Meeting = require("../models/meeting");
const Patient = require("../models/patient");
const Staff = require("../models/staff");
const Institution = require("../models/institution");
const sendEmail = require("../service/sendEmail");

exports.createMeeting = async (req, res) => {
    const { patient_id, doctor_id, institution_id, scheduledTime, participants, notes } = req.body;

    console.log(req.body);

    if (!doctor_id || !institution_id || !scheduledTime) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields: doctor_id, institution_id, or scheduledTime",
        });
    }

    try {
        // Validate doctor and institution IDs
        const doctor = await Staff.findByPk(doctor_id);
        const institution = await Institution.findByPk(institution_id);

        if (!doctor || !institution) {
            return res.status(404).json({
                success: false,
                message: "Doctor or institution not found",
            });
        }

        // Validate patient ID if provided
        let patient = null;
        if (patient_id) {
            patient = await Patient.findByPk(patient_id);
            if (!patient) {
                return res.status(404).json({
                    success: false,
                    message: "Patient not found",
                });
            }
        }

        // Generate meeting details
        const meetingRoom = generateMeetingRoom();
        const goodLink = generateGoodLink();
        const meetingLink = `https://meet.jit.si/${meetingRoom}`;

        // Prepare participant emails
        const participantEmails = participants || [];
        
        // Include patient email if patient exists and has an email
        if (patient && patient.email) {
            participantEmails.push(patient.email);
        }

        // Include doctor email if doctor has an email
        if (doctor.email) {
            participantEmails.push(doctor.email);
        }

        // Save meeting to the database
        const meeting = await Meeting.create({
            patient_id: patient_id || null, // Allow null if no patient
            doctor_id,
            institution_id,
            meetingLink,
            scheduledTime,
            participants: participantEmails, // Save final list of participant emails
            status: "Scheduled",
            note: notes,
        });

        // Notify participants via email
        await Promise.all(participantEmails.map(email =>
            sendEmail(email, "Virtual Meeting Scheduled", "meeting-schedule", {
                meetingLink,
                scheduledTime,
                goodLink,
                recipientName: patient && patient.firstName ? patient.firstName : 'Valued Guest',
                role: "doctor",
            })
        ));
        

        res.status(201).json({
            success: true,
            message: "Virtual meeting created successfully",
            meeting,
        });
    } catch (error) {
        console.log("Error creating meeting:", error);
        res.status(500).json({
            success: false,
            message: error,
        });
    }
};

exports.updateMeetingStatus = async (req, res) => {
    const { meetingId, status, notes } = req.body;

    if (!meetingId || !status) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields: meetingId or status",
        });
    }

    try {
        const meeting = await Meeting.findByPk(meetingId);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found",
            });
        }

        // Update meeting status and notes
        meeting.status = status;
        meeting.notes = notes || null;
        await meeting.save();

        res.status(200).json({
            success: true,
            message: "Meeting status updated successfully",
            meeting,
        });
    } catch (error) {
        console.error("Error updating meeting status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update meeting status",
        });
    }
};

exports.getMeetings = async (req, res) => {
    const { patient_id, doctor_id, institution_id, status } = req.query;

    try {
        const filters = {};

        if (patient_id) filters.patient_id = patient_id;
        if (doctor_id) filters.doctor_id = doctor_id;
        if (institution_id) filters.institution_id = institution_id;
        if (status) filters.status = status;

        const meetings = await Meeting.findAll({
            where: filters,
            include: [
                { model: Patient },
                { model: Staff },
                { model: Institution, attributes: ["id", "name"] },
            ],
        });

        res.status(200).json({
            success: true,
            message: "Meetings fetched successfully",
            meetings,
        });
    } catch (error) {
        console.error("Error fetching meetings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch meetings",
        });
    }
};
