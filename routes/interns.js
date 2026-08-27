import express from 'express';
import { getAllInterns, getInternById, createIntern, updateIntern, deleteIntern } from '../controllers/internController.js';

const router = express.Router();

router.get('/', getAllInterns);
router.get('/:id', getInternById);
router.post('/', createIntern);
router.put('/:id', updateIntern);
router.delete('/:id', deleteIntern);

export default router;
