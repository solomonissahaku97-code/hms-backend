const express = require('express');
const router = express.Router();
const bedsController = require('../controllers/beds/bedControllers');
const  verifyAdminMiddleware  = require('../middlewares/adminMiddleware');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')

/**
 * @swagger
 * tags:
 *   - name: Beds
 *     description: Bed management related endpoints
 */


router.get('/departments/:departmentId/institution/:institution_id/beds', eitherAuthOrAdmin, bedsController.getAllBedsInDepartment)
router.get('/beds-summary',eitherAuthOrAdmin,bedsController.getBedsSummaryByInstitution)
router.put('/department/update-status',eitherAuthOrAdmin,bedsController.updateBedsStatus)

module.exports = router;
