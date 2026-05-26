// controllers/staffController.js

const { Staff, Permission } = require('../models');
const Role = require('../models/role');
const StaffPermission = require('../models/staffPermission');

exports.getAllPermissions = async (req, res) => {
    try {
        const permissions = await Permission.findAll();
        return res.status(200).json({ permissions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching the permissions.' });
    }
};

exports.getAllRoles = async (req, res) => {
    try {
        const roles = await Role.findAll()
        return res.status(200).json({ roles });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'error fetching roles' });

    }

}


exports.getAllStaffPermissions = async (req, res) => {
    const { staff_id, institution_id } = req.query;
    try {
        // Find the staff member
        const staff = await Staff.findOne({
            where: { id: staff_id, institution_id: institution_id }
        });
        if (!staff) return res.status(400).json({ error: 'User not found' });

        // Find all StaffPermission records for this staff member
        const staffPermissions = await StaffPermission.findAll({
            where: { staff_id: staff_id },
            attributes: ['permission_id']  // Only select the permission_id field
        });

        if (staffPermissions.length === 0) {
            return res.status(200).json(staffPermissions);
        }

        // Extract permission_ids from StaffPermission records
        const permissionIds = staffPermissions.map(sp => sp.permission_id);

        // Find all corresponding Permission records
        const permissions = await Permission.findAll({
            where: { id: permissionIds }
        });

        return res.status(200).json(permissions);  // Return the list of permissions
    } catch (error) {
        return res.status(500).json({ error: 'An error occurred while fetching staff permissions.', details: error.message });
    }
};




exports.updateUserPermissions = async (req, res) => {
    const { staff_id, institution_id, permission_ids } = req.body;

    try {
        // Verify that the staff member exists
        const staff = await Staff.findOne({
            where: { id: staff_id, institution_id: institution_id }
        });

        if (!staff) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        // Clear existing permissions for the staff member
        await StaffPermission.destroy({
            where: { staff_id: staff_id }
        });

        // Add the new permissions
        const newPermissions = permission_ids.map(permission_id => ({
            staff_id: staff_id,
            permission_id: permission_id
        }));

        await StaffPermission.bulkCreate(newPermissions);

        return res.status(200).json({ message: 'Permissions updated successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'An error occurred while updating staff permissions',
            details: error.message
        });
    }
};

