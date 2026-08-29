import crypto from 'crypto';

// Constant-time string comparison. Plain `!==`/`===` on strings short-
// circuits at the first differing character, so response time can leak
// how many leading characters an attacker's guess got right -- a real
// risk for secrets checked directly against user-suppliable input (an
// API key, an OTP code). crypto.timingSafeEqual doesn't have that
// short-circuit, but it requires both buffers to be the same length, so
// we guard that first (a length mismatch is itself safe to reveal --
// it's not enough information to reconstruct the secret).
export function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
