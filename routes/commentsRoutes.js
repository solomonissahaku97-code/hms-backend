const express = require('express');
const router = express.Router();
const {
  addComment,
  editComment,
  deleteComment,
  getCommentsByNoteId
} = require('../controllers/commentController');
const authenticateToken = require('../middlewares/authMiddlewares')


// Add a new comment
router.post('/comments', addComment);
router.get('/comments/get',authenticateToken, getCommentsByNoteId);

// Edit a comment
router.put('/comments/:comment_id',authenticateToken, editComment);

// Delete a comment
router.delete('/comments/:comment_id',authenticateToken, deleteComment);

module.exports = router;
