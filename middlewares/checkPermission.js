const { Staff, Permission } = require('../models');

const checkPermission = (requiredPermissionId) => {
    return async (req, res, next) => {
        try {
            const staffId = req.staffId;
            if (!staffId) {
                return res.status(403).json({ error: 'Staff ID is required' });
            }

            const staff = await Staff.findByPk(staffId, {
                include: {
                    model: Permission,
                    as: 'permissions',
                    attributes: ['id']
                }
            });

            if (!staff) {
                return res.status(404).json({ error: 'Staff not found' });
            }

            // Extract the permission IDs
            const staffPermissionIds = staff.permissions;

            // Check if the required permission ID is in the staff's permissions
            const hasPermission = staffPermissionIds.includes(requiredPermissionId);

            if (!hasPermission) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'An error occurred while checking permissions' });
        }
    };
};

module.exports = checkPermission;
