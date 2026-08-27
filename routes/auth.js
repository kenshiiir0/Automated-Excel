import express from 'express';
import { login, me } from '../controllers/authController.js';
import { requestOtp, verifyOtp } from '../controllers/signupController.js';
import { requireAuth } from '../lib/requireAuth.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/signup/request-otp', requestOtp);
router.post('/signup/verify-otp', verifyOtp);

export default router;
