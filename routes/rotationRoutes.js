const express = require('express');
const {
    addShift,
    updateShift,
    getShifts,
    getAllUsersFromDepartment,
    addBulkShifts,

} = require('../controllers/rotationController');

const router = express.Router();

// Create a new shift
router.post('/create', addShift);

router.get('/', getShifts);
// Get all users from a specific department
router.get('/users', getAllUsersFromDepartment);


router.put('/get-shifts', updateShift);
// Bulk add shifts
router.post('/bulk', addBulkShifts);



module.exports = router;
