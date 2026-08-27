import express from 'express';
import { getAllInterns, getInternById, createIntern, updateIntern, deleteIntern } from '../controllers/internController.js';
import { requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

router.get('/', getAllInterns);
router.get('/:id', getInternById);
router.post('/', requireWriteAccess, createIntern);
router.put('/:id', requireWriteAccess, updateIntern);
router.delete('/:id', requireWriteAccess, deleteIntern);

export default router;
