import express from 'express';
import { login, me } from '../controllers/authController.js';
import { requestOtp, verifyOtp } from '../controllers/signupController.js';
import { requireAuth } from '../lib/requireAuth.js';
import { loginLimiter, otpLimiter } from '../lib/rateLimiters.js';
import { validate } from '../lib/validate.js';
import { loginSchema, requestOtpSchema, verifyOtpSchema } from '../lib/schemas.js';

const router = express.Router();

router.post('/login', loginLimiter, validate({ body: loginSchema }), login);
router.get('/me', requireAuth, me);
router.post('/signup/request-otp', otpLimiter, validate({ body: requestOtpSchema }), requestOtp);
router.post('/signup/verify-otp', otpLimiter, validate({ body: verifyOtpSchema }), verifyOtp);

export default router;
