import express from 'express';
import { listUsers, updateUser } from '../controllers/usersController.js';
import { requireRole, requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

// admin + super_admin can view the account list; only super_admin can
// change a role or activate/deactivate an account.
router.get('/', requireWriteAccess, listUsers);
router.patch('/:id', requireRole('super_admin'), updateUser);

export default router;
