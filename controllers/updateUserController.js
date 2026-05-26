const Department = require("../models/department");
const Role = require("../models/role");
const Staff = require("../models/staff");


exports.updateStaffInfo = async (req, res) => {
    const { staffId } = req.query;
    const { firstName, middleName, lastName, email, phoneNumber, department_id, role_id, permissionIds } = req.body;

    console.log(req.query)

    // Convert ID fields from string to integer if they are provided
    const departmentId = department_id ? parseInt(department_id, 10) : null;
    const roleId = role_id ? parseInt(role_id, 10) : null;

    try {
        const staff = await Staff.findByPk(staffId);

        if (!staff) {
            return res.status(404).json({ error: 'Staff not found' });
        }

        // Check if a department is provided and exists
        if (departmentId) {
            const department = await Department.findByPk(departmentId);
            if (!department) {
                return res.status(400).json({ error: 'Invalid department_id' });
            }
        }

        // Check if a role is provided and exists
        if (roleId) {
            const role = await Role.findByPk(roleId);
            if (!role) {
                return res.status(400).json({ error: 'Invalid role_id' });
            }
        }

        // Check if a new profile picture was uploaded
        let profile_pic = staff.profile_pic; // Retain the current profile picture
        if (req.file) {
            console.log('File uploaded:', req.file); // Debugging log
            if (req.file.firebaseUrl) {
                profile_pic = req.file.firebaseUrl; // Update profile picture
            }
        }
        

        // Update staff information
        await staff.update({
            firstName,
            middleName,
            lastName,
            phone_number: phoneNumber,
            profile_pic,
        });

        // Update permissions if provided
        if (permissionIds && permissionIds.length > 0) {
            const permissions = await Permissions.findAll({
                where: {
                    id: permissionIds
                }
            });
            await staff.setPermissions(permissions); // 'setPermissions' handles many-to-many relationships
        }

        res.status(200).json({ message: 'Staff information updated successfully', staff });
    } catch (err) {
        console.error(err);
        if (err.name === 'SequelizeValidationError') {
            res.status(400).json({ error: 'Validation error', details: err.errors });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
};


exports.getStaffProfile = async (req, res) => {
    const { staffId } = req.query;

    try {
        // Find the staff by ID, including related department and role
        const staff = await Staff.findByPk(staffId, {
            include: [
                {
                    model: Department,
                    attributes: ['id', 'name'], // Include only necessary fields
                },
                {
                    model: Role,
                    attributes: ['id', 'name'], // Include only necessary fields
                },
                {
                    model: Permissions,
                    attributes: ['id', 'name'], // Include permissions if needed
                    through: { attributes: [] }, // Omit the through table data for many-to-many relationships
                },
            ],
        });

        if (!staff) {
            return res.status(404).json({ error: 'Staff not found' });
        }

        res.status(200).json();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
