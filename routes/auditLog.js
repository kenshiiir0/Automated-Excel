import express from 'express';
import { listAuditLog } from '../controllers/auditLogController.js';
import { requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

// admin + super_admin only -- same tier as Manage Users and Disciplinary
// Memos. A plain 'user' account never sees who changed what.
router.get('/', requireWriteAccess, listAuditLog);

export default router;
