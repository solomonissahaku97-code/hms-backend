const Appointment = require("../models/appointment");
const Patient = require("../models/patient");
const Staff = require("../models/staff");
const sendEmail = require('../service/sendEmail');

// Track appointment notifications as a list for each doctor
const appointmentNotifications = {};

exports.createAppointment = async (data, clients, ws) => {
    const { patient_id, staff_id, institution_id, appointment_date, appointment_time, reason } = data.data;

    try {
        console.log("Attempting to create appointment with data:", data);
        
        // Create the appointment in the database
        const appointment = await Appointment.create({
            patient_id,
            staff_id,         
            institution_id,
            appointment_date,
            appointment_time,
            reason
        });

        if (!appointment) {
            throw new Error("Appointment creation returned null or undefined.");
        }

        // Fetch additional details for patient and staff
        const staff = await Staff.findOne({ where: { id: staff_id } });
        const patient = await Patient.findOne({ where: { id: patient_id } });

        // Initialize the notification list if it doesn't exist, then add the new message
        if (!appointmentNotifications[staff_id]) {
            appointmentNotifications[staff_id] = [];
        }
        const message = `You have a new appointment with ${patient.first_name} ${patient.last_name}`;
        appointmentNotifications[staff_id].push(message);

        // WebSocket notification to the doctor
        console.log('Connected clients:', clients);
        clients.forEach((client) => {
            if (client.role === 'Doctor' && client.userId === staff_id && client.socket.readyState === ws.OPEN) {
                console.log(`Broadcasting notification to doctor (ID: ${staff_id}) for patient (ID: ${patient_id})`, client);

                client.socket.send(JSON.stringify({
                    event: 'appointmentNotification',
                    notifications: appointmentNotifications[staff_id], // Send the list of notifications
                    newMessage: message[0], // Send the latest message for display
                    doctorId:client.userId
                }));
                console.log("Sending notification to client:", client);
            }
        });

        console.log("Appointment successfully created and notifications sent.");
        return ws.send(JSON.stringify({ message: 'Appointment created and doctor notified', appointment }));
    } catch (error) {
        console.error('Error creating appointment:', error);
        throw new Error('Failed to create appointment');
    }
};
