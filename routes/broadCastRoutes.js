const express = require('express');
const router = express.Router();
const broadcastController = require('../controllers/broadcastController')


router.post('/department/staffs',broadcastController.broadCastMessageByDepartment)





module.exports = router;
