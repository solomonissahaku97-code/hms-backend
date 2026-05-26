// Track general notifications for each department
const generalNotifications = {};

// General notification handler
exports.sendGeneralNotification = async (data, clients, ws) => {
    const { department_id, message } = data;

    try {
        console.log("Attempting to send general notification to department:", department_id);

        // Initialize the notification list for the department if it doesn't exist
        if (!generalNotifications[department_id]) {
            generalNotifications[department_id] = [];
        }
        
        // Add the new notification message to the list
        generalNotifications[department_id].push(message);

        // WebSocket notification to all staff in the specified department
        clients.forEach((client) => {
            if (client.role === 'Staff' && client.departmentId === department_id && client.socket.readyState === ws.OPEN) {
                console.log(`Broadcasting general notification to staff in department (ID: ${department_id})`, client);

                client.socket.send(JSON.stringify({
                    event: 'generalNotification',
                    notifications: generalNotifications[department_id], // Send the list of notifications
                    newMessage: message // Send the latest message for display
                }));
                console.log("Sent notification to staff client:", client);
            }
        });

        console.log("General notification successfully sent to all staff in the department.");
        return ws.send(JSON.stringify({ message: 'Notification sent to all staff in department', department_id, message }));
    } catch (error) {
        console.error('Error sending general notification:', error);
        throw new Error('Failed to send general notification');
    }
};
