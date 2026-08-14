const express = require('express');
const router = express.Router();
const { getAllAccessControls, getAllRoles, updateStaffPermissions, getAllPermissions, getRolePermissions } = require('../controllers/accessControlController');
const { getAllStaffPermissions, updateUserPermissions } = require('../controllers/permissionControllers');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')
const checkTrialStatus = require('../middlewares/checkTrialStatus')
 


router.get('/access-controls', getAllAccessControls); 

router.get('/roles',eitherAuthOrAdmin,getAllRoles)
router.get('/permissions',eitherAuthOrAdmin,getAllPermissions)
router.get('/roles/:role_id/permissions', eitherAuthOrAdmin, getRolePermissions)
router.put('/permission/update',eitherAuthOrAdmin,updateStaffPermissions)

// Staff permissions (used by the frontend staffPermissionSlice)
router.get('/staff/permissions', eitherAuthOrAdmin, getAllStaffPermissions);
router.put('/staff/permissions', eitherAuthOrAdmin, updateUserPermissions);


module.exports = router;
