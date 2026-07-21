const express = require('express');
const router = express.Router();
const { getRecentChats,sendMessage,getDepartmentsByInstitution,getUnreadCounts } = require('../controllers/chatController');
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

router.get('/unread-counts', eitherAuthOrAdminMiddleware, async (req, res) => {
    const { userId, departmentIds } = req.query;
    if (!userId || !departmentIds) {
        return res.status(400).json({ error: 'userId and departmentIds are required' });
    }
    const deptIds = departmentIds.split(',').filter(Boolean);
    const counts = await getUnreadCounts(userId, deptIds);
    res.json({ success: true, counts });
});

module.exports = router;
