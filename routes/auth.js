import express from 'express';
import { login, me } from '../controllers/authController.js';
import { requestOtp, verifyOtp } from '../controllers/signupController.js';
import { requireAuth } from '../lib/requireAuth.js';
import { loginLimiter, otpLimiter } from '../lib/rateLimiters.js';

const router = express.Router();

router.post('/login', loginLimiter, login);
router.get('/me', requireAuth, me);
router.post('/signup/request-otp', otpLimiter, requestOtp);
router.post('/signup/verify-otp', otpLimiter, verifyOtp);

export default router;
