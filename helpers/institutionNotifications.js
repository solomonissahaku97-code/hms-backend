// Track general notifications for each institution
const institutionNotifications = {};

// Institution-wide notification handler
exports.sendInstitutionNotification = async (data, clients, ws) => {
    const { institution_id, message } = data;

    try {
        console.log("Attempting to send institution-wide notification to institution:", institution_id);

        // Initialize the notification list for the institution if it doesn't exist
        if (!institutionNotifications[institution_id]) {
            institutionNotifications[institution_id] = [];
        }
        
        // Add the new notification message to the list
        institutionNotifications[institution_id].push(message);

        // WebSocket notification to all staff in the specified institution
        clients.forEach((client) => {
            if (client.role === 'Staff' && client.institutionId === institution_id && client.socket.readyState === ws.OPEN) {
                console.log(`Broadcasting institution-wide notification to staff in institution (ID: ${institution_id})`, client);

                client.socket.send(JSON.stringify({
                    event: 'institutionNotification',
                    notifications: institutionNotifications[institution_id], // Send the list of notifications
                    newMessage: message // Send the latest message for display
                }));
                console.log("Sent notification to staff client:", client);
            }
        });

        console.log("Institution-wide notification successfully sent to all staff in the institution.");
        return ws.send(JSON.stringify({ message: 'Notification sent to all staff in institution', institution_id, message }));
    } catch (error) {
        console.error('Error sending institution-wide notification:', error);
        throw new Error('Failed to send institution-wide notification');
    }
};
