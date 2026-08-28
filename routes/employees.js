import express from 'express';
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee, restoreEmployee } from '../controllers/employeeController.js';
import { requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

router.get('/', getAllEmployees);
router.get('/:id', getEmployeeById);
router.post('/', requireWriteAccess, createEmployee);
router.put('/:id', requireWriteAccess, updateEmployee);
router.delete('/:id', requireWriteAccess, deleteEmployee);
router.post('/:id/restore', requireWriteAccess, restoreEmployee);

export default router;
