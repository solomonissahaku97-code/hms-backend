const express = require('express');
const router = express.Router();
const partographController = require('../controllers/maternity/partograph.controller');


// Routes

router.post('/', partographController.addPartographRecord);
router.put('/:id', partographController.updatePartographRecord);
router.delete('/:id', partographController.deletePartographRecord);
router.get('/visit/:visit_id', partographController.getPartographByVisit);


module.exports = router;
