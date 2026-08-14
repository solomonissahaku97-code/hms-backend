const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const authenticateToken = require('../middlewares/authMiddlewares');

router.post('/sync', authenticateToken, syncController.syncBatch);
router.get('/sync/pending', authenticateToken, syncController.getPendingOperations);
router.patch('/sync/operations/:operation_id/complete', authenticateToken, syncController.markOperationCompleted);

module.exports = router;
