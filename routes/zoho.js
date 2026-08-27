import express from 'express';
import { requireApiKey } from '../lib/apiKeyAuth.js';
import { getEmployeesForZoho } from '../controllers/zohoController.js';

const router = express.Router();

// GET /api/zoho/employees?api_key=...
// Read-only, safe-field-subset employee export for the Zoho integration.
router.get('/employees', requireApiKey, getEmployeesForZoho);

export default router;
