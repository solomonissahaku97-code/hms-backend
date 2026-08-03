const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institution/institutionController');
const institutionPayment = require('../controllers/institution/institutionPaymentController')
const adminMiddleware = require('../middlewares/adminMiddleware');
const institutionAccountSetup = require('../controllers/institution/institutionAccountsController')

const { upload, sftpUpload } = require('../middlewares/profile_multer')
const { galleryUpload, sftpUpload: sftpUploadGallery } = require('../middlewares/profile_multer')

const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')

router.post('/institutions', upload.single('logo'), sftpUpload('logo', 'logos'), institutionController.createInstitution);
router.get('/institutions', eitherAuthOrAdmin, institutionController.getAllInstitutions);

// Institution Public Profile routes (must come before /institutions/:id to avoid route collision)
router.get('/institutions/profile', eitherAuthOrAdmin, institutionController.getInstitutionProfile);
router.put('/institutions/profile', eitherAuthOrAdmin, galleryUpload.any(), sftpUploadGallery('banner_image', 'gallery'), institutionController.updateInstitutionProfile);
router.post('/institutions/profile/gallery', eitherAuthOrAdmin, galleryUpload.single('gallery_image'), sftpUploadGallery('gallery_image', 'gallery'), institutionController.uploadGalleryImage);
router.delete('/institutions/profile/gallery/:index', eitherAuthOrAdmin, institutionController.deleteGalleryImage);

// Generic /:id routes must come AFTER specific routes
router.put('/institutions/:id', eitherAuthOrAdmin, upload.single('logo'), sftpUpload('logo', 'logos'), institutionController.updateInstitution);
router.get('/institutions/:id', institutionController.getInstitutionById);
router.get('/institutions/:id/reviews', institutionController.getInstitutionReviews);
router.post('/institutions/:id/reviews', institutionController.createInstitutionReview);
router.get('/institution-admins/:institution_id', institutionController.getAllInstitutionAdmins)
router.get('/admin/:adminId/details', eitherAuthOrAdmin, institutionController.getAdminDetails);

// institution bills payment
router.post('/institution/payment', institutionPayment.makePaymentForInstitutionCharges)

// SETUP INSTITUTION ACCOUNTS 
router.post('/institution/accounts/create', eitherAuthOrAdmin, institutionAccountSetup.setupInstitutionAccount)

module.exports = router;
