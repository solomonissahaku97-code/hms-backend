const { AccessControl,Role } = require('../models');
const Permission = require('../models/permission');
const Staff = require('../models/staff');
const StaffPermission = require('../models/staffPermission');

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
    return res.status(200).json(permissions)
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


exports.getAllRoles = async(req,res)=>{
  try {
    const roles = await Role.findAll()
    res.status(200).json(roles)
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


exports.updateStaffPermissions = async (req, res) => {
  const { staff_id, institution_id, permissionIds } = req.body; // Assume permissionIds is an array of permission ID numbers

  try {
      const staff = await Staff.findOne({ where: { id: staff_id, institution_id: institution_id } });
      if (!staff) return res.status(404).json({ error: 'Staff does not exist' });

      // Fetch current permissions
      const currentPermissions = await StaffPermission.findAll({
          where: { staff_id: staff_id }
      }); 

      // Extract current permission IDs
      const currentPermissionIds = currentPermissions.map(p => p.permission_id);
      console.log(currentPermissionIds)

      // Determine permissions to add
      const permissionsToAdd = permissionIds.filter(id => !currentPermissionIds.includes(id));

      // Determine permissions to remove
      const permissionsToRemove = currentPermissionIds.filter(id => !permissionIds.includes(id));

      // Remove outdated permissions
      if (permissionsToRemove.length) {
          await StaffPermission.destroy({
              where: { staff_id: staff_id, permission_id: permissionsToRemove }
          });
      }

      // Add new permissions
      const newPermissions = permissionsToAdd.map(permissionId => ({
          staff_id: staff_id,
          permission_id: permissionId
      }));
      if (newPermissions.length) {
          await StaffPermission.bulkCreate(newPermissions);
      }

      return res.status(200).json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.log(error)
      res.status(500).json({ error: error.message });
  }
}












