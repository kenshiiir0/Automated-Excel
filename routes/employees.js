import express from 'express';
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee } from '../controllers/employeeController.js';
import { requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

router.get('/', getAllEmployees);
router.get('/:id', getEmployeeById);
router.post('/', requireWriteAccess, createEmployee);
router.put('/:id', requireWriteAccess, updateEmployee);
router.delete('/:id', requireWriteAccess, deleteEmployee);

export default router;
