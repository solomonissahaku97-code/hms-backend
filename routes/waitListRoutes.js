const waitlist = require('../controllers/waitlist/waitlistController')
const express = require('express');
const router = express.Router();



router.post('/waitlist',waitlist.addWaitList)






module.exports = router;