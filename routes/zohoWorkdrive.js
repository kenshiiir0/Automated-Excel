import express from 'express';
import { connect, callback, listDocuments, connectionStatus } from '../controllers/zohoWorkdriveController.js';
import { requireAuth } from '../lib/requireAuth.js';
import { requireRole } from '../lib/requireRole.js';

const router = express.Router();

// One-time setup, super_admin only: kicks off the Zoho consent flow.
router.get('/zoho-workdrive/connect', requireAuth, requireRole('super_admin'), connect);

// Zoho redirects the browser here after consent -- this is a plain
// navigation with no Authorization header, so it can't sit behind
// requireAuth. Who approved it is instead tracked via the "state" param
// (see zohoWorkdriveController.js).
router.get('/zoho-workdrive/callback', callback);

// Any logged-in account can view the connection status and the document
// list -- this is the "user role = view/read only" requirement. There is
// no corresponding write route, so read-only is enforced by the API
// surface itself, not just the UI.
router.get('/hr-documents/status', requireAuth, connectionStatus);
router.get('/hr-documents', requireAuth, listDocuments);

export default router;
