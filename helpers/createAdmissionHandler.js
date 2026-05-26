const Admission = require("../models/admission");
const Patient = require("../models/patient");
const Staff = require("../models/staff");
const Department = require("../models/department");
const Bed = require("../models/beds");
const Appointment = require("../models/appointment");


// Track admission notifications for each department
const admissionNotifications = {};

exports.createAdmission = async (data, clients, ws) => {
    const { patient_id, department_id, institution_id, staff_id, admission_date, note, bed_id, bed_number,appointment_id } = data.data;
    console.log(data.data)

    try {
        console.log("Attempting to create admission with data:", data);

        // Validate entities
        const patient = await Patient.findByPk(patient_id);
        const staff = await Staff.findByPk(staff_id);
        const department = await Department.findByPk(department_id);

        if (!patient || !staff || !department) {
            throw new Error("Patient, staff, or department not found.");
        }

        // Check and update bed availability
        const assignBed = await Bed.findOne({ where: { bed_number, department_id, id: bed_id } });
        if (!assignBed) return ws.send(JSON.stringify({ error: 'Bed is not available' }));

        await assignBed.update({
            patient_id,
            is_occupied: true,
            status: 'occupied'
        });

        // Create the admission in the database
        const admission = await Admission.create({
            patient_id,
            department_id,
            institution_id,
            staff_id,
            admission_date,
            note,
            bed_id
        });
        patient.update({
            'department_id':department_id,
            is_admitted: true,
        })
        console.log("Deleting appointment with ID:", appointment_id, "and Institution ID:", institution_id);

        await Appointment.destroy({ where: { id:appointment_id,institution_id } });
        

        if (!admission) {
            throw new Error("Admission creation returned null or undefined.");
        }

        // Update patient's admission status
        
        // DELETE APPOINTMENT
     

        // Initialize department notifications if not present, then add new notification message
        if (!admissionNotifications[department_id]) {
            admissionNotifications[department_id] = [];
        }
        const message = `Admission created for patient ${patient.first_name} ${patient.last_name} in department ${department.name}`;
        admissionNotifications[department_id].push(message);

        // WebSocket notification to department staff
        console.log('Connected clients:', clients);
        clients.forEach((client) => {
            if (client.department_id === department_id && client.socket.readyState === ws.OPEN) {
                console.log(`Broadcasting admission notification to staff in department (ID: ${department_id})`, client);

                client.socket.send(JSON.stringify({
                    event: 'admissionNotification',
                    notifications: admissionNotifications[department_id], // Send the list of notifications
                    newMessage: message // Send the latest message for display
                }));
                console.log("Sending admission notification to client:", client);
            }
        });

        console.log("Admission successfully created and notifications sent.");
        return ws.send(JSON.stringify({ event: 'admissionSuccess', admission }));
    } catch (error) {
        console.error('Error creating admission:', error);
        throw new Error('Failed to create admission');
    }
};
