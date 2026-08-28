import express from 'express';
import { getAllInterns, getInternById, createIntern, updateIntern, deleteIntern, restoreIntern } from '../controllers/internController.js';
import { requireWriteAccess } from '../lib/requireRole.js';
import { validate } from '../lib/validate.js';
import { createInternSchema, updateInternSchema, idParamSchema } from '../lib/schemas.js';

const router = express.Router();

router.get('/', getAllInterns);
router.get('/:id', validate({ params: idParamSchema }), getInternById);
router.post('/', requireWriteAccess, validate({ body: createInternSchema }), createIntern);
router.put('/:id', requireWriteAccess, validate({ params: idParamSchema, body: updateInternSchema }), updateIntern);
router.delete('/:id', requireWriteAccess, validate({ params: idParamSchema }), deleteIntern);
router.post('/:id/restore', requireWriteAccess, validate({ params: idParamSchema }), restoreIntern);

export default router;
