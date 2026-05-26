const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { upload,uploadToLocal } = require('../middlewares/profile_multer')


// Route to send a new message
router.post('/send-message', upload.single('media'),uploadToLocal('media'), messageController.createMessage);
// Route to get all messages (for a group or a user)
router.get('/group/messages', messageController.getMessages);

// get group messages



module.exports = router;
