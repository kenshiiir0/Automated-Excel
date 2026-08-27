import express from 'express';
import { listUsers, updateUser, createUser } from '../controllers/usersController.js';
import { requireRole, requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

// admin + super_admin can view the account list; only super_admin can
// change a role, activate/deactivate an account, or create a new one.
router.get('/', requireWriteAccess, listUsers);
router.post('/', requireRole('super_admin'), createUser);
router.patch('/:id', requireRole('super_admin'), updateUser);

export default router;
