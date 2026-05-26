const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');

// Route to create a new group
router.post('/groups', groupController.createGroup);
// GET ALL GROUPS
router.get('/groups', groupController.getAllGroups); // Add this route for fetching all groups
// Route to add users to a group
router.post('/groups/add-users', groupController.addUsersToGroup);

// Route to get all users in a group 
router.get('/groups/users', groupController.getGroupUsers);

// REMOVE USER FROM CHAT ROOM 
router.delete('/groups/remove-user', groupController.removeUserFromGroup);

// get user groups

router.get('/user/groups',groupController.getUserGroups)

module.exports = router;
