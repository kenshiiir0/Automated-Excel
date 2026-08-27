import express from 'express';
import { getAllLeaves, getLeavesByEmployee, createLeave, updateLeave } from '../controllers/leaveController.js';
import { requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

router.get('/', getAllLeaves);
router.get('/:emp_id', getLeavesByEmployee);
router.post('/', requireWriteAccess, createLeave);
router.put('/:id', requireWriteAccess, updateLeave);

export default router;
