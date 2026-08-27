import jwt from 'jsonwebtoken';

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
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }
}
