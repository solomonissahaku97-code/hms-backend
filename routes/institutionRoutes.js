const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institution/institutionController');
const institutionPayment = require('../controllers/institution/institutionPaymentController')
const adminMiddleware = require('../middlewares/adminMiddleware');
const institutionAccountSetup = require('../controllers/institution/institutionAccountsController')
const institutionPricingController = require('../controllers/institution/institutionPricingController');

const { upload, sftpUpload } = require('../middlewares/storage')
const { galleryUpload, sftpUpload: sftpUploadGallery } = require('../middlewares/storage')

const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')
const authenticateToken = require('../middlewares/authMiddlewares');

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
router.delete('/institutions/:id', eitherAuthOrAdmin, institutionController.deleteInstitution);
router.get('/institutions/:id/reviews', institutionController.getInstitutionReviews);
router.post('/institutions/:id/reviews', institutionController.createInstitutionReview);
router.get('/institution-admins/:institution_id', institutionController.getAllInstitutionAdmins)
router.get('/admin/:adminId/details', eitherAuthOrAdmin, institutionController.getAdminDetails);

// institution bills payment
router.post('/institution/payment', institutionPayment.makePaymentForInstitutionCharges)

// SETUP INSTITUTION ACCOUNTS 
router.post('/institution/accounts/create', eitherAuthOrAdmin, institutionAccountSetup.setupInstitutionAccount)

// INSTITUTION PRICING ROUTES
router.get('/institutions/:institution_id/pricing', authenticateToken, institutionPricingController.getAvailablePricingCatalog);
router.get('/institutions/:institution_id/pricing/:type', authenticateToken, institutionPricingController.getInstitutionPricing);
router.put('/institutions/:institution_id/pricing/:type', authenticateToken, institutionPricingController.setInstitutionPricing);
router.delete('/institutions/:institution_id/pricing/:type', authenticateToken, institutionPricingController.clearInstitutionPricing);

module.exports = router;
