const Prescription = require("../models/prescription");
const Patient = require("../models/patient");
const Medication = require("../models/medication");
const Staff = require("../models/staff");
const Department = require("../models/department");
const Institution = require("../models/institution");

// Track prescription notifications as a list for each pharmacy
const prescriptionNotifications = {};

exports.createPrescription = async (data, clients, ws) => {
    const { patient_id, medication_id, prescribed_by, dosage, frequency, duration, refills, notes, institution_id, department_id } = data.data;

    try {
        console.log("Attempting to create prescription with data:", data);

        // Validate entities
        const patient = await Patient.findByPk(patient_id);
        if (!patient) throw new Error("Patient not found.");

        const medication = await Medication.findByPk(medication_id);
        if (!medication) throw new Error("Medication not found.");

        const doctor = await Staff.findByPk(prescribed_by);
        if (!doctor) throw new Error("Doctor not found.");

        const institution = await Institution.findByPk(institution_id);
        if (!institution) throw new Error("Institution not found.");

        const department = await Department.findByPk(department_id);
        if (!department) throw new Error("Department not found.");

        // Create prescription
        const prescription = await Prescription.create({
            patient_id,
            medication_id,
            prescribed_by,
            dosage,
            frequency,
            duration,
            refills,
            refills_left: refills,
            notes,
            status: 'pending',
            institution_id,
            department_id
        });

        // Initialize notification list for the institution if it doesn't exist, then add the new message
        if (!prescriptionNotifications[institution_id]) {
            prescriptionNotifications[institution_id] = [];
        }
        const message = `New prescription created for ${patient.first_name} ${patient.last_name} by Dr. ${doctor.lastName}`;
        prescriptionNotifications[institution_id].push(message);

        // WebSocket notification to pharmacy clients in the institution
        console.log('Connected clients:', clients);
        clients.forEach((client) => {
            if (client.role === 'Pharmacy' && client.institutionId === institution_id && client.socket.readyState === ws.OPEN) {
                console.log(`Broadcasting prescription notification to pharmacy (Institution ID: ${institution_id})`, client);

                client.socket.send(JSON.stringify({
                    event: 'prescriptionNotification',
                    notifications: prescriptionNotifications[institution_id], // Send the list of notifications
                    newMessage: message // Send the latest message for display
                }));
                console.log("Sending notification to pharmacy client:", client);
            }
        });

        console.log("Prescription successfully created and notifications sent.");
        return ws.send(JSON.stringify({ message: 'Prescription created and pharmacy notified', prescription }));
    } catch (error) {
        console.error('Error creating prescription:', error);
        throw new Error('Failed to create prescription');
    }
};
