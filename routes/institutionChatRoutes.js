const express = require('express');
const router = express.Router();
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware');
const institutionCommunicationController = require('../controllers/institution/institutionCommunicationController');
const { upload } = require('../middlewares/profile_multer');

router.post('/send', eitherAuthOrAdmin, institutionCommunicationController.sendInstitutionMessage);
router.get('/:institution_id/conversations', eitherAuthOrAdmin, institutionCommunicationController.getInstitutionConversations);
router.get('/:institution_id/history', eitherAuthOrAdmin, institutionCommunicationController.getInstitutionChatHistory);
router.get('/:institution_id/unread-counts', eitherAuthOrAdmin, institutionCommunicationController.getUnreadCounts);
router.post('/:institution_id/mark-read', eitherAuthOrAdmin, institutionCommunicationController.markInstitutionMessagesAsRead);
router.post('/upload-media', eitherAuthOrAdmin, upload.single('media'), institutionCommunicationController.uploadInstitutionMedia);

module.exports = router;
