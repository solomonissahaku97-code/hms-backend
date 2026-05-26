const LabScreeningRequest = require('../models/lab_screening_request');
const { clients } = require('./authenticateHandler');
const { createNotification } = require('./notificationService');

const labRequestHandler = async (ws, messageData, currentUser) => {
    console.log('Received message data:', messageData);
    console.log('Current user role:', currentUser.role.name);

    // Check if the current user is a doctor or midwife
    if (!['Doctor', 'MidWife'].includes(currentUser.role.name)) {
        ws.send(JSON.stringify({ event: 'error', message: 'Only doctors and midwives can send lab requests.' }));
        console.log('Error: Only doctors and midwives can send lab requests. User role:', currentUser.role.name);
        return;
    }

    const { doctorId, patientId, institutionId, priority, testId, departmentId, message } = messageData.labRequest;

    try {
        // Create lab screening request entry in the database
        const labRequestEntry = await LabScreeningRequest.create({
            doctor_id: doctorId,
            patient_id: patientId,
            institution_id: institutionId,
            priority,
            test_id: testId,
            status: 'pending',
            department_id: departmentId,
            message: message,
        });

        console.log('Lab request created:', labRequestEntry);

        // Create a notification for lab technicians
        const notificationData = {
            title: 'New Lab Request',
            description: `A new lab request has been created with priority: ${priority}.`,
            priority,
            fromDepartmentId: departmentId,
            toDepartmentId: null, // Assuming lab technicians aren't in a specific department
            institutionId,
        };

        const notificationEntry = await createNotification(notificationData);
        console.log('Notification created:', notificationEntry);

        // Broadcast the lab request notification to all lab technicians
        clients.forEach(client => {
            console.log(`Checking client: ID=${client.userId}, Role=${client.role.name}, Socket Ready State=${client.socket.readyState}`);
            if (client.role.name === 'Lab Technician') {
                if (client.socket.readyState === ws.OPEN) {
                    console.log(`Sending lab request notification to Lab Technician (ID: ${client.userId})`);
                    client.socket.send(JSON.stringify({
                        event: 'labRequestNotification',
                        labRequest: labRequestEntry,
                        notification: notificationEntry,
                        message: 'New lab request received',
                    }));
                } else {
                    console.log(`Client (ID: ${client.userId}) is not connected, skipping...`);
                }
            }
        });

        console.log('Lab request notification broadcasted successfully.');
    } catch (error) {
        console.error('Error creating lab request:', error);
        ws.send(JSON.stringify({ event: 'error', message: 'Failed to create lab request.' }));
    }
};

module.exports = labRequestHandler;
