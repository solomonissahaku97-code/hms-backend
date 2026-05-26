const Appointment = require('../models/appointment');
const Department = require('../models/department');
const Diagnosis = require('../models/diagnosis');
const Patient = require('../models/patient');
const Staff = require('../models/staff');
const WebSocket = require('ws'); // Import WebSocket
const Visit = require('../models/Visit');
const { Op } = require('sequelize');




// FETCH ALL APPOINTMENTS BY PATIENT ID AND INSTITUTION ID
exports.fetchPatientAppointments = async (req, res) => {
    const { patient_id, institution_id } = req.query;

    try {
        const appointments = await Appointment.findAll({
            where: { patient_id, institution_id },
            include: [{
                model: Staff,
                as:'doctor'
               
            },
            {
                model:Patient,
                as:'patient'
            }
        ]
        });

        res.json(appointments);
        console.log('========APPOINTMENTS======');
        console.log(appointments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CREATE AN APPOINTMENT
exports.createAppointment = async (req, res) => {
    const { send_reminder, visit_id, staff_id, institution_id, appointment_date, appointment_time, reason, appointment_type } = req.body;

    try {
        // Validate required fields
        if (!visit_id || !staff_id || !institution_id || !appointment_date || !appointment_time || !reason || !appointment_type) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const appointmentData = {
            visit_id,
            staff_id,
            institution_id,
            appointment_date,
            appointment_time,
            reason,
            appointment_type,
            send_reminder: send_reminder || false // Default to false if not provided
        };

        // Create appointment
        const appointment = await Appointment.create(appointmentData);

     
        return res.status(201).json({ 
            message: 'Appointment scheduled successfully',
            appointment: {
                id: appointment.id,
                appointment_date: appointment.appointment_date,
                appointment_time: appointment.appointment_time,
                type: appointment.appointment_type,
                reminder_sent: send_reminder
            }
        });
    } catch (error) {
        console.error('Error creating appointment:', error);
        
        // Handle specific database errors
        if (error.name === 'SequelizeValidationError') {
            const errors = error.errors.map(err => err.message);
            return res.status(400).json({ message: 'Validation error', errors });
        }
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Appointment conflict or duplicate entry' });
        }

        return res.status(500).json({ 
            message: 'Error creating appointment',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


// GET ALL STAFFS ACCORDING TO THEIR ROLE
exports.getRollStaffs = async (req, res) => {
    const { institution_id, role_id } = req.query;

    try {
        const staffs = await Staff.findAll({
            where: { institution_id, role_id }
        });
        res.json(staffs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching staffs', error });
    }

};

// GET APPOINTMENTS BY INSTITUTION AND DOCTOR
exports.getAppointmentByDoctorId = async (req, res) => {
    const { institution_id, doctor_id } = req.query;

    try {
        const appointments = await Appointment.findAll({
            where: { institution_id, staff_id: doctor_id },
            include:[
                {
                    model:Patient,
                    as:'patient',
                    include:[
                        {
                            model:Diagnosis,
                            as:'diagnosis',
                        }
                    ]
                }
            ]
        });
        return res.json(appointments);
        console.log(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching doctor appointments', error });
        console.log(error);
    }
};


// GET ALL APPOINTMENT IN AN INSTITUTION
exports.getAllAppointments = async (req, res) => {
    const { institution_id } = req.query

    try {
        const appointment = await Appointment.findAll({ where: { institution_id: institution_id },include:[
            {
                model:Visit,
                as:'patient',
                include:[
                    {
                        model:Patient,
                        as:'patient'
                    }
                ]
            },
            {
                model:Staff,
                as:'doctor'
            }
        ]})
        if (!appointment) return res.status(404).json({ error: 'appointment does not exist' });
        return res.status(200).json(appointment)
    } catch (error) {
        console.log(error)
        return res.status(404).json({error:error})
    }
}


// DELETE AN APPOINTMENT
exports.deleteAppointment = async (req, res) => {
    const { id,institution_id } = req.query;

    try {
        const result = await Appointment.destroy({ where: { id,institution_id } });

        if (result === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.status(200).json({ message: 'Appointment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting appointment', error });
    }
};


// APPROVE APPOINTMENT
exports.approveAppointment = async (req, res) => {
    const { patient_id, appointmentId, department_id, institution_id } = req.body; // Can be from req.body for a more RESTful approach
    console.log(req.body)
    
    try {
        // Check if department exists
        const department = await Department.findOne({ where: { id: department_id, institution_id } });
        if (!department) return res.status(404).json({ error: 'Department does not exist' });

        // Check if patient exists in the institution
        const patient = await Patient.findOne({ where: { id: patient_id, institution_id:institution_id } });
        if (!patient) return res.status(404).json({ error: 'Patient does not exist in the institution' });

        // Check if appointment exists for the patient
        const appointment = await Appointment.findOne({ where: { patient_id: patient_id, id: appointmentId } });
        if (!appointment) return res.status(404).json({ error: 'Appointment does not exist' });

        // Update appointment status to 'approved'
        await appointment.update({ status: "completed" });

            // Update patient's department
        await patient.update({ department_id: department_id });

        // Send success response
        return res.status(200).json({ message: 'Appointment approved successfully' });
        
    } catch (error) {
        console.error('Error approving appointment:', error); // Log the error for debugging
        return res.status(500).json({ error: 'An error occurred while approving the appointment' });
    }
};

// GET UPCOMING APPOINTMENTS
exports.getUpcomingAppointments = async (req, res) => {
    const { institution_id, limit = 10 } = req.query;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const appointments = await Appointment.findAll({
            where: {
                institution_id,
                appointment_date: {
                    [Op.gte]: today
                },
                status: {
                    [Op.ne]: 'completed'
                }
            },
            include: [
                {
                    model: Visit,
                    as: 'patient',
                    include: [
                        {
                            model: Patient,
                            as: 'patient',
                        }
                    ]
                },
                {
                    model: Staff,
                    as: 'doctor',
                }
            ],
            order: [
                ['appointment_date', 'ASC'],
                ['appointment_time', 'ASC']
            ],
            limit: parseInt(limit)
        });

        // Transform to match frontend expected format
        const transformedAppointments = appointments.map(apt => ({
            id: apt.id,
            patient: apt.patient && apt.patient.patient 
                ? `${apt.patient.patient.first_name} ${apt.patient.patient.last_name}` 
                : 'Unknown',
            time: apt.appointment_time,
            department: 'General',
            status: apt.status || 'pending',
            date: apt.appointment_date,
            reason: apt.reason
        }));

        return res.status(200).json(transformedAppointments);
    } catch (error) {
        console.error('Error fetching upcoming appointments:', error);
        return res.status(500).json({ error: 'An error occurred while fetching upcoming appointments' });
    }
};



