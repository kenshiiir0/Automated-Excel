import express from 'express';
import { getProfile, updateProfile, changePassword } from '../controllers/profileController.js';
import { requireAuth } from '../lib/requireAuth.js';

const router = express.Router();

router.get('/', requireAuth, getProfile);
router.patch('/', requireAuth, updateProfile);
router.post('/change-password', requireAuth, changePassword);

export default router;
