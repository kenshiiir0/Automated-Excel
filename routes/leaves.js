import express from 'express';
import { getAllLeaves, getLeavesByEmployee, createLeave, updateLeave } from '../controllers/leaveController.js';

const router = express.Router();

router.get('/', getAllLeaves);
router.get('/:emp_id', getLeavesByEmployee);
router.post('/', createLeave);
router.put('/:id', updateLeave);

export default router;