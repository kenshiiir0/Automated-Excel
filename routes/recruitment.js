import express from 'express';
import { getAllCandidates, createCandidate, updateCandidate, deleteCandidate, restoreCandidate } from '../controllers/recruitmentController.js';
import { requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

router.get('/candidates', getAllCandidates);
router.post('/candidates', requireWriteAccess, createCandidate);
router.put('/candidates/:id', requireWriteAccess, updateCandidate);
router.delete('/candidates/:id', requireWriteAccess, deleteCandidate);
router.post('/candidates/:id/restore', requireWriteAccess, restoreCandidate);

export default router;
