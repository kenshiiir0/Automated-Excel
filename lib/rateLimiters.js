import rateLimit from 'express-rate-limit';

// Login gets hit the hardest by brute-force/credential-stuffing attempts,
// so it's the tightest limit: 10 attempts per IP per 15 minutes. A real
// user mistyping their password a few times never comes close to this;
// a script trying thousands of passwords does.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
});

// OTP request/verify: looser window since these are used less often per
// person, but still capped to stop someone from spamming OTP emails at a
// target inbox or brute-forcing a 6-digit code.
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});

// A broad safety net across every /api/* route so no single endpoint (or
// IP) can hammer the server or run up Supabase usage, without getting in
// the way of normal app usage.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down and try again shortly.' },
});

export { loginLimiter, otpLimiter, apiLimiter };
