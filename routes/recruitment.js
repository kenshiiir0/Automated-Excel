import express from 'express';
import { getAllCandidates, createCandidate, updateCandidate, deleteCandidate } from '../controllers/recruitmentController.js';

const router = express.Router();

router.get('/candidates', getAllCandidates);
router.post('/candidates', createCandidate);
router.put('/candidates/:id', updateCandidate);
router.delete('/candidates/:id', deleteCandidate);

export default router;