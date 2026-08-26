const express = require('express');
const { getAllLeaves, getLeavesByEmployee, createLeave, updateLeave } = require('../controllers/leaveController.js');

const router = express.Router();

router.get('/', getAllLeaves);
router.get('/:emp_id', getLeavesByEmployee);
router.post('/', createLeave);
router.put('/:id', updateLeave);

module.exports = router;