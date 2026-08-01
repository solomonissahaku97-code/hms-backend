const { AccessControl, Role } = require('../models');
const Permission = require('../models/permission');
const Staff = require('../models/staff');
const StaffPermission = require('../models/staffPermission');
const RolePermission = require('../models/RolePermission');

// Get all access controls
exports.getAllAccessControls = async (req, res) => {
  try {
    const accessControls = await AccessControl.findAll();
    res.status(200).json(accessControls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getAllPermissions = async(req,res)=>{ 
  try {
    const permissions = await Permission.findAll()
    return res.status(200).json({ permissions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching the permissions.' });
  }
}


exports.getAllRoles = async(req,res)=>{
  try {
    const roles = await Role.findAll()
    res.status(200).json({ roles });
  } catch (error) {
    res.status(500).json({ error: 'error fetching roles' });
  }
}

exports.getRolePermissions = async (req, res) => {
  const { role_id } = req.params;
  try {
    const rolePermissions = await RolePermission.findAll({
      where: { role_id },
      include: [
        { model: Permission, as: 'permission', attributes: ['id', 'name', 'description'] }
      ]
    });

    const permissions = rolePermissions.map(rp => rp.permission).filter(Boolean);
    return res.status(200).json({ permissions });
  } catch (error) {
    return res.status(500).json({ error: 'An error occurred while fetching role permissions.', details: error.message });
  }
};

exports.updateStaffPermissions = async (req, res) => {
  const { staff_id, institution_id, permission_ids } = req.body;

  try {
      const staff = await Staff.findOne({ where: { id: staff_id, institution_id: institution_id } });
      if (!staff) return res.status(404).json({ error: 'Staff does not exist' });

      const currentPermissions = await StaffPermission.findAll({
          where: { staff_id: staff_id }
      }); 

      const currentPermissionIds = currentPermissions.map(p => p.permission_id);

      const permissionsToAdd = permission_ids.filter(id => !currentPermissionIds.includes(id));
      const permissionsToRemove = currentPermissionIds.filter(id => !permission_ids.includes(id));

      if (permissionsToRemove.length) {
          await StaffPermission.destroy({
              where: { staff_id: staff_id, permission_id: permissionsToRemove }
          });
      }

      const newPermissions = permissionsToAdd.map(permissionId => ({
          staff_id: staff_id,
          permission_id: permissionId
      }));
      if (newPermissions.length) {
          await StaffPermission.bulkCreate(newPermissions);
      }

      return res.status(200).json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error(error);
      res.status(500).json({ error: error.message });
  }
}
