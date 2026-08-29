import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import dashboardRoutes from './routes/dashboard.js';
import employeeRoutes from './routes/employees.js';
import recruitmentRoutes from './routes/recruitment.js';
import leaveRoutes from './routes/leaves.js';
import emailRoutes from './routes/email.js';
import internRoutes from './routes/interns.js';
import zohoRoutes from './routes/zoho.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import usersRoutes from './routes/users.js';
import zohoWorkdriveRoutes from './routes/zohoWorkdrive.js';
import disciplinaryMemosRoutes from './routes/disciplinaryMemos.js';
import auditLogRoutes from './routes/auditLog.js';
import fileShareRoutes from './routes/fileShare.js';
import { requireAuth } from './lib/requireAuth.js';
import { apiLimiter } from './lib/rateLimiters.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Vercel sits in front of this app as a reverse proxy, so req.ip would
// otherwise resolve to Vercel's proxy IP for every request -- collapsing
// every visitor into one shared rate-limit bucket (and letting one bad
// actor exhaust it for everyone). Trusting exactly one hop reads the real
// client IP from X-Forwarded-For instead.
app.set('trust proxy', 1);

// Security headers (CSP, no-sniff, frame-ancestors, HSTS, etc.). API-only
// service, so the default CSP (meant for HTML pages) is turned off here --
// the actual frontend HTML is served as static files by Vercel, not by
// this server, and a strict API-shaped CSP would just get in the way.
app.use(helmet({ contentSecurityPolicy: false }));
// CORS allowlist. In production the frontend and this API are served
// from the same Vercel project/origin (see vercel.json), so most real
// traffic is same-origin and never even hits CORS -- this exists for the
// cases that aren't: local development (Vite dev server on 5173, or
// hitting the API directly on its own port), and any additional trusted
// origins (e.g. a Vercel preview URL) added via CORS_EXTRA_ORIGINS.
// Unlike the previous `cors()` (no options), which reflected
// Access-Control-Allow-Origin: * for every request, this rejects any
// origin not explicitly listed below.
const DEFAULT_ALLOWED_ORIGINS = [
    'https://automated-excel-three.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
];
const EXTRA_ORIGINS = (process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
const ALLOWED_ORIGINS = [...DEFAULT_ALLOWED_ORIGINS, ...EXTRA_ORIGINS];

const corsOptions = {
    origin(origin, callback) {
        // No Origin header at all (server-to-server calls, curl, Postman,
        // the Zoho Deluge integration hitting /api/zoho/* with its own
        // API key) -- allow, since this isn't a browser enforcing CORS
        // in the first place, and requireApiKey/requireAuth still gate
        // the actual route.
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin not allowed: ${origin}`));
    },
};
app.use(cors(corsOptions));
app.use(express.json());

// Blanket rate limit across every /api/* route -- a coarse safety net so
// no single client can hammer the server or run up Supabase usage. The
// login and OTP routes have their own tighter limits on top of this one.
app.use('/api', apiLimiter);

// Auth routes: POST /api/auth/login is intentionally open (that's how you
// get a token in the first place); GET /api/auth/me requires a token.
app.use('/api/auth', authRoutes);

// Everything below requires a valid login token. This is the real fix for
// the "anyone with the link can see salary/bank/gov-ID data" gap -- these
// routes used to be wide open.
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/recruitment', requireAuth, recruitmentRoutes);
app.use('/api/leaves', requireAuth, leaveRoutes);
app.use('/api/email', requireAuth, emailRoutes);
app.use('/api/interns', requireAuth, internRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/audit-log', requireAuth, auditLogRoutes);


// zohoWorkdriveRoutes applies its own per-route auth (requireAuth +
// requireRole where needed) rather than a blanket requireAuth here,
// because /callback must stay reachable by Zoho's plain browser redirect
// (no Authorization header) while /connect and /hr-documents still need
// to be gated.
app.use('/api', zohoWorkdriveRoutes);
app.use('/api', requireAuth, disciplinaryMemosRoutes);
app.use('/api', requireAuth, fileShareRoutes);

// /api/zoho/* is deliberately NOT behind requireAuth -- it has its own,
// separate API-key check (see lib/apiKeyAuth.js) because it's meant to be
// called by Zoho, not by a logged-in HR user with a browser session.
app.use('/api/zoho', zohoRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
