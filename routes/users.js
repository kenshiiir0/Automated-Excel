import express from 'express';
import { listUsers, updateUser, createUser, archiveUser, restoreUser } from '../controllers/usersController.js';
import { requireRole, requireWriteAccess } from '../lib/requireRole.js';
import { validate } from '../lib/validate.js';
import { createUserSchema, updateUserSchema, idParamSchema } from '../lib/schemas.js';

const router = express.Router();

// admin + super_admin can view the account list; only super_admin can
// change a role, activate/deactivate an account, create a new one, or
// archive/restore one.
router.get('/', requireWriteAccess, listUsers);
router.post('/', requireRole('super_admin'), validate({ body: createUserSchema }), createUser);
router.patch('/:id', requireRole('super_admin'), validate({ params: idParamSchema, body: updateUserSchema }), updateUser);
router.delete('/:id', requireRole('super_admin'), validate({ params: idParamSchema }), archiveUser);
router.post('/:id/restore', requireRole('super_admin'), validate({ params: idParamSchema }), restoreUser);

export default router;
