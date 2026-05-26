const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institution/institutionController');
const institutionPayment = require('../controllers/institution/institutionPaymentController')
const adminMiddleware = require('../middlewares/adminMiddleware');
const institutionAccountSetup = require('../controllers/institution/institutionAccountsController')

const { upload,uploadToLocal } = require('../middlewares/profile_multer')

const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')

  
router.post('/institutions',upload.single('logo'),uploadToLocal('logo'),  institutionController.createInstitution);
router.get('/institutions',eitherAuthOrAdmin, institutionController.getAllInstitutions);
router.put('/institutions/:id',eitherAuthOrAdmin,upload.single('logo'),uploadToLocal('logo'),institutionController.updateInstitution)
router.get('/institutions/:id', institutionController.getInstitutionById);
router.get('/admin/:adminId/details',eitherAuthOrAdmin, institutionController.getAdminDetails);


// institution bills payment
router.post('/institution/payment',institutionPayment.makePaymentForInstitutionCharges)


// SETUP INSTITUTION ACCOUNTS 
router.post('/institution/accounts/create',eitherAuthOrAdmin,institutionAccountSetup.setupInstitutionAccount)


module.exports = router; 
