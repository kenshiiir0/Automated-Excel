const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const employeeRoutes = require('./routes/employees.js');
const recruitmentRoutes = require('./routes/recruitment.js');
const emailRoutes = require('./routes/email.js');
const leaveRoutes = require('./routes/leaves.js');
const dashboardRoutes = require('./routes/dashboard.js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/employees', employeeRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(express.static(path.join(__dirname, 'frontend')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;