const express = require('express');
const router = express.Router();
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware');
const institutionCommunicationController = require('../controllers/institution/institutionCommunicationController');
const { labAttachmentsUpload } = require('../middlewares/profile_multer');

router.post('/send', eitherAuthOrAdmin, institutionCommunicationController.sendInstitutionMessage);
router.get('/:institution_id/conversations', eitherAuthOrAdmin, institutionCommunicationController.getInstitutionConversations);
router.get('/:institution_id/history', eitherAuthOrAdmin, institutionCommunicationController.getInstitutionChatHistory);
router.get('/:institution_id/unread-counts', eitherAuthOrAdmin, institutionCommunicationController.getUnreadCounts);
router.post('/:institution_id/mark-read', eitherAuthOrAdmin, institutionCommunicationController.markInstitutionMessagesAsRead);
router.post('/upload-media', eitherAuthOrAdmin, labAttachmentsUpload.single('media'), institutionCommunicationController.uploadInstitutionMedia);

// Multer error handler for this router
router.use((err, req, res, next) => {
  if (err) {
    console.error('Upload error:', err);
    return res.status(400).json({ success: false, message: err.message || 'File upload error' });
  }
  next();
});

module.exports = router;
