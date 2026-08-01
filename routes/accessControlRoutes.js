const express = require('express');
const router = express.Router();
const { getAllAccessControls, getAllRoles, updateStaffPermissions, getAllPermissions, getRolePermissions } = require('../controllers/accessControlController');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')
const checkTrialStatus = require('../middlewares/checkTrialStatus')



router.get('/access-controls', getAllAccessControls);

router.get('/roles',eitherAuthOrAdmin,getAllRoles)
router.get('/permissions',eitherAuthOrAdmin,getAllPermissions)
router.get('/roles/:role_id/permissions', eitherAuthOrAdmin, getRolePermissions)
router.put('/permission/update',eitherAuthOrAdmin,updateStaffPermissions)


module.exports = router;
