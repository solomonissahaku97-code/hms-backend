const Staff = require('../models/staff');
const { sendSMS } = require('../service/smsService'); // Adjust the path accordingly

exports.broadCastMessageByDepartment = async (req, res) => {
    const { institution_id, department_id, message } = req.body;

    if (!institution_id || !department_id || !message ) {
        return res.status(400).json({ error: 'All fields are required: institution_id, department_id, message, title' });
    }

    try {
        // Find all staff members in the specified department and institution
        const staffs = await Staff.findAll({ where: { institution_id, department_id } });

        if (staffs.length === 0) {
            return res.status(404).json({ message: 'No staff found in the specified department and institution.' });
        }

        // Track any SMS failures
        const smsFailures = [];

        // Send the SMS to each staff member
        for (const staff of staffs) {
            try {
                // Assuming the staff model has a `phone` field
                await sendSMS(staff.phone, message);
            } catch (error) {
                console.error(`Failed to send SMS to ${staff.phone}:`, error.message);
                smsFailures.push(staff.phone);
            }
        }

        if (smsFailures.length > 0) {
            return res.status(207).json({
                message: 'Message broadcasted with some failures.',
                failedNumbers: smsFailures,
            });
        }

        res.status(200).json({ message: 'Message broadcasted successfully to all staff in the department.' });
    } catch (error) {
        console.error('Error broadcasting message:', error.message);
        res.status(500).json({ error: 'An error occurred while broadcasting the message.' });
    }
};


exports.BroadcastSingle = async (req, res) => {
    const { institution_id, staff_id, message } = req.body;

    // Validate required fields
    if (!institution_id || !staff_id || !message) {
        return res.status(400).json({ error: 'All fields are required: institution_id, staff_id, message' });
    }

    try {
        const staff = await Staff.findOne({ where: { id: staff_id, institution_id } });

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found in the specified institution.' });
        }

        await sendSMS(staff.phone, message);
        
        res.status(200).json({ message: 'Message sent successfully to the specified staff member.' });
    } catch (error) {
        console.error('Error sending single broadcast message:', error.message);
        res.status(500).json({ error: 'An error occurred while sending the message.' });
    }
};



