const express = require('express');
const {  login,  getAllDoctors,  resetPassword,verifyLogicAnswer,updateUserFCMToken,adminLogin,getUserDetails } = require('../controllers/authentication/authControllers');
const { registerAdmin,registerStaffs,deleteStaff,getAllStaffByInstitution,getStaffByInstitutionAndId,assignedPrimaryDepartment } = require('../controllers/authentication/admin_staff_registration')
const authenticateToken = require('../middlewares/authMiddlewares');
const { upload, uploadToLocal } = require('../middlewares/profile_multer'); const router = express.Router();
const { updateStaffInfo } = require('../controllers/updateUserController')
const staffDeptCtrl = require('../controllers/departments/staffDepartmentController');

const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')
const checkTrialStatus = require('../middlewares/checkTrialStatus')
const adminAuth = require('../middlewares/adminMiddleware')

 // #swagger.tags = ['Auth']

// REGISTER CONTROLS
router.post(
    '/register/staff',
    uploadToLocal('profile_pic'),
    adminAuth,
    checkTrialStatus,
    uploadToLocal('profile_pic'),
    registerStaffs // Controller
);

router.post('/register/admin', registerAdmin);
router.post('/departments/assign', adminAuth,staffDeptCtrl.assignDepartmentsToStaff);
router.post('/update-user-fcm-token',authenticateToken,updateUserFCMToken)

router.post('/departments/assign-primary',adminAuth,assignedPrimaryDepartment)

// GET ALL DOCTORS
router.get('/staffs',checkTrialStatus,adminAuth, getAllDoctors)


// GET ALL STAFFS
router.get('/all-staffs',adminAuth,getAllStaffByInstitution) 

// GET A SINGLE STAFF
router.get('/single-staff',getStaffByInstitutionAndId)
router.get('/user/:id', authenticateToken, getUserDetails);



router.post('/reset-password', authenticateToken, resetPassword);

// LOGIN CONTROLLS
router.post('/login', login);
router.post('/verify-logic-answer', verifyLogicAnswer);

router.post('/admin/login', adminLogin);
// router.post('/admin/verify-token', verifyAdminToken);
router.delete('/admin/institution/staff/remove-staff',adminAuth, deleteStaff)



// UPDATE STAFF INFORMATION
router.put('/admin/staff/update-profile',eitherAuthOrAdmin, uploadToLocal('profile_pic'),
uploadToLocal('profile_pic'), updateStaffInfo);













module.exports = router;
