import express from 'express';
import { listUsers, updateUser, createUser, archiveUser, restoreUser } from '../controllers/usersController.js';
import { requireRole, requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

// admin + super_admin can view the account list; only super_admin can
// change a role, activate/deactivate an account, create a new one, or
// archive/restore one.
router.get('/', requireWriteAccess, listUsers);
router.post('/', requireRole('super_admin'), createUser);
router.patch('/:id', requireRole('super_admin'), updateUser);
router.delete('/:id', requireRole('super_admin'), archiveUser);
router.post('/:id/restore', requireRole('super_admin'), restoreUser);

export default router;
