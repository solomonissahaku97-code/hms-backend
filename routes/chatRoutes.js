const express = require('express');
const router = express.Router();
const { getRecentChats,sendMessage,getDepartmentsByInstitution } = require('../controllers/chatController');
const eitherAuthOrAdminMiddleware = require('../middlewares/eitherAuthOrAdminMiddleware')   


router.get('/recent-chats', async (req, res) => {
    const { userId, departmentId } = req.query;

    try {
        const recentChats = await getRecentChats(userId, departmentId);
        res.json(recentChats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching recent chats' });
    }
});

// SEND MESSAGE
router.post('/send',eitherAuthOrAdminMiddleware,sendMessage)

router.get('/get-departments',eitherAuthOrAdminMiddleware,getDepartmentsByInstitution)

module.exports = router;
