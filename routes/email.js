import express from 'express';
import { getEmailDirectory, addToDirectory, sendEmail } from '../controllers/emailController.js';
import { requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

router.get('/directory', getEmailDirectory);
router.post('/directory', requireWriteAccess, addToDirectory);
router.post('/send', requireWriteAccess, sendEmail);

export default router;
