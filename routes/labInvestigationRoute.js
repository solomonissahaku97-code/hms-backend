const express = require('express');
const router = express.Router();
const labInvestigationController = require('../controllers/claims/labInvestigationController');


router.post('/', labInvestigationController.create);
router.get('/', labInvestigationController.findAll);
router.get('/search', labInvestigationController.search);
router.get('/:id', labInvestigationController.findOne);
router.put('/:id', labInvestigationController.update);
router.delete('/:id', labInvestigationController.delete);







module.exports = router;