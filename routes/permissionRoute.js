const express = require('express');
const router = express.Router();
const { getAllPermissions,addPermissionToUser,getAllStaffPermissions, updateUserPermissions,getAllRoles } = require('../controllers/permissionControllers'); // Ensure the correct path to your controller
const adminMiddleWare = require('../middlewares/adminMiddleware')


router.get('/permissions',  getAllPermissions);
router.put('/update-permissions', updateUserPermissions);
router.get('/staff/permissions',getAllStaffPermissions);
router.get('/roles',adminMiddleWare,getAllRoles)
module.exports = router;
 
