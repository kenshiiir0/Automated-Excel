import express from 'express';
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee, restoreEmployee } from '../controllers/employeeController.js';
import { requireWriteAccess } from '../lib/requireRole.js';
import { validate } from '../lib/validate.js';
import { createEmployeeSchema, updateEmployeeSchema, idParamSchema } from '../lib/schemas.js';

const router = express.Router();

router.get('/', getAllEmployees);
router.get('/:id', validate({ params: idParamSchema }), getEmployeeById);
router.post('/', requireWriteAccess, validate({ body: createEmployeeSchema }), createEmployee);
router.put('/:id', requireWriteAccess, validate({ params: idParamSchema, body: updateEmployeeSchema }), updateEmployee);
router.delete('/:id', requireWriteAccess, validate({ params: idParamSchema }), deleteEmployee);
router.post('/:id/restore', requireWriteAccess, validate({ params: idParamSchema }), restoreEmployee);

export default router;
