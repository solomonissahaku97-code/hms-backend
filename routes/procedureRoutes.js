const express = require('express');
const router = express.Router();
const procedureRoute = require('../controllers/procedure/ProcedureController');
const eitherAuthOrAdminMiddleware = require('../middlewares/eitherAuthOrAdminMiddleware')



router.post('/procedure/add-procedure', eitherAuthOrAdminMiddleware, procedureRoute.addProcedures)
router.get('/procedure/get-procedures', eitherAuthOrAdminMiddleware, procedureRoute.getPatientProcedures)
router.get('/procedure/get-all-procedures', eitherAuthOrAdminMiddleware, procedureRoute.getAllProcedures)
router.delete('/procedure/remove-staff',eitherAuthOrAdminMiddleware,procedureRoute.removeStaffFromProcedure)
router.delete('/procedure/delete-procedure',eitherAuthOrAdminMiddleware,procedureRoute.deleteProcedure)
router.patch('/procedure/update-status',eitherAuthOrAdminMiddleware,procedureRoute.updateProcedureStatus)








module.exports = router;
