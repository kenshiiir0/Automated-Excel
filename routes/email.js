import express from 'express';
import { getEmailDirectory, addToDirectory, sendEmail } from '../controllers/emailController.js';

const router = express.Router();

router.get('/directory', getEmailDirectory);
router.post('/directory', addToDirectory);
router.post('/send', sendEmail);

export default router;