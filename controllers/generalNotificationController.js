const { GeneralNotification, Department, Institution } = require('../models');

// Send a notification to a department within an institution
exports.sendNotification = async (req, res) => {
    const { departmentId, institutionId, message } = req.body;

    try {
        const department = await Department.findOne({
            where: {
                id: departmentId,
                institution_id: institutionId
            }
        });

        if (!department) {
            return res.status(404).json({ message: 'Department not found in the specified institution' });
        }

        const notification = await GeneralNotification.create({
            department_id: departmentId,
            message,
            department_id:department_id
        });

        return res.status(201).json({ message: 'Notification sent successfully', notification });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while sending the notification' });
    }
};
