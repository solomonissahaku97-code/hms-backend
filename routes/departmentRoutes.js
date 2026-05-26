const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departments/departmentController');
const staffDepartmentController = require('../controllers/departments/staffDepartmentController');
const verifyAdminMiddleware = require('../middlewares/adminMiddleware');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware');


// ==================== 🏥 Department CRUD ====================

// Create a new department
router.post('/department/create', verifyAdminMiddleware, departmentController.createDepartment);

// Get a single department
router.get("/institution/department/", verifyAdminMiddleware, departmentController.getDepartment);

// Update department beds
router.put('/departments/:departmentId/beds', verifyAdminMiddleware, departmentController.updateDepartmentBeds);

// Get all departments by institution (with patients + staff counts)
router.get('/institutions/departments', verifyAdminMiddleware, departmentController.getDepartmentsByInstitution);

// Get department statistics and summary (with diagnosis details)
router.get('/department/get-summary', eitherAuthOrAdmin, departmentController.getDepartmentSummaryWithDiagnosisDetails);

// delete department
router.delete('/departments/:department_id',verifyAdminMiddleware,departmentController.deleteDepartment)



// ==================== 👨‍⚕️ Staff <-> Department ====================

// Add staff to department
router.post('/departments/add-staff', verifyAdminMiddleware, departmentController.addStaffToDepartment);

// Remove staff from department
router.post('/departments/remove-staff', verifyAdminMiddleware, departmentController.removeStaffFromDepartment);

// Get all staff from an institution
router.get('/department/:institution_id/staffs', eitherAuthOrAdmin, departmentController.getStaffByInstitution);

// ✅ Assign departments to staff (bulk assign)
router.post("/departments/assign", staffDepartmentController.assignDepartmentsToStaff);

// ✅ Get all departments for a staff
router.get("/departments/:staff_id", staffDepartmentController.getDepartmentsForStaff);

// ✅ Update staff departments (replace old with new)
router.put("/:staff_id/departments", staffDepartmentController.updateDepartmentsForStaff);

// ✅ Remove a department from a staff
router.delete("/:staff_id/departments/:department_id", staffDepartmentController.removeDepartmentFromStaff);



// ==================== 🧑‍🤝‍🧑 Patients in Department ====================

// Get all patients in a department
router.get('/department/:department_id/institution/:institution_id/patients', departmentController.getAllPatientFromDepartment);



module.exports = router;
