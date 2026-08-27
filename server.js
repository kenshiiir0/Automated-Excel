import express from 'express';
import cors from 'cors';
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
import { requireAuth } from './lib/requireAuth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
