import express from 'express';
import { getAllCandidates, createCandidate, updateCandidate, deleteCandidate, restoreCandidate } from '../controllers/recruitmentController.js';
import { requireWriteAccess } from '../lib/requireRole.js';
import { validate } from '../lib/validate.js';
import { createCandidateSchema, updateCandidateSchema, idParamSchema } from '../lib/schemas.js';

const router = express.Router();

router.get('/candidates', getAllCandidates);
router.post('/candidates', requireWriteAccess, validate({ body: createCandidateSchema }), createCandidate);
router.put('/candidates/:id', requireWriteAccess, validate({ params: idParamSchema, body: updateCandidateSchema }), updateCandidate);
router.delete('/candidates/:id', requireWriteAccess, validate({ params: idParamSchema }), deleteCandidate);
router.post('/candidates/:id/restore', requireWriteAccess, validate({ params: idParamSchema }), restoreCandidate);

export default router;
