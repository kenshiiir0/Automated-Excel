import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './supabase.js';

// In-memory throttle for last_seen_at writes: userId -> ms timestamp of
// the last time we actually wrote to the database for them. Every
// authenticated request passes through here, but only one in roughly
// SEEN_THROTTLE_MS actually reaches Supabase -- checking this in-memory
// map first is what keeps that cheap, since it skips the DB call
// entirely on every request in between rather than just skipping some
// other cost. Resets on server restart, which just means the first
// request after a restart writes immediately -- harmless.
const lastSeenWrites = new Map();
const SEEN_THROTTLE_MS = 60 * 1000; // at most once a minute per account

// Fire-and-forget: never blocks or fails the request it's attached to.
// "Online" status is a nice-to-have on the Manage Users page, not
// something that should ever be able to break a real API call if
// Supabase hiccups on this specific write.
function touchLastSeen(userId) {
    const now = Date.now();
    const last = lastSeenWrites.get(userId) || 0;
    if (now - last < SEEN_THROTTLE_MS) return;
    lastSeenWrites.set(userId, now);

    supabaseAdmin
        .from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId)
        .then(({ error }) => {
            if (error) console.error('touchLastSeen failed:', error.message);
        });
}

// Protects every route it's applied to: requires a valid, non-expired JWT
// in the Authorization header ("Bearer <token>"), issued by POST /api/auth/login.
// This is the real access control for the app -- unlike the old frontend-only
// "Show Sensitive Information" toggle, a request without a valid token is
// rejected here on the server, before it ever reaches Supabase.
export function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(503).json({ error: 'Authentication not configured.' });
    }

    try {
        const payload = jwt.verify(token, secret);
        req.user = { id: payload.userId, username: payload.username, role: payload.role };
        touchLastSeen(payload.userId);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }
}
