import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import employeeRoutes from './routes/employees.js';
import recruitmentRoutes from './routes/recruitment.js';
import emailRoutes from './routes/email.js';
import leaveRoutes from './routes/leaves.js';
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'GetMeds HR API is running' });
});

// Routes
app.use('/api/employees', employeeRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 GetMeds HR API running on port ${PORT}`);
});