import {
    buildAuthUrl,
    exchangeCodeForTokens,
    saveRefreshToken,
    listFolderContents,
    isConnected,
} from '../lib/zohoWorkdrive.js';

// GET /api/zoho-workdrive/connect -- super_admin only. Returns the Zoho
// consent-screen URL as JSON rather than redirecting directly, because
// this route requires a Bearer token (via requireAuth) and a plain
// browser navigation (<a href>, or pasting the URL) can't attach one --
// only an authenticated fetch() from the already-logged-in app can. The
// frontend fetches this, then does the actual page navigation itself
// with window.location.href.
const connect = (req, res) => {
    try {
        // req.user is set by requireAuth/requireRole on this route -- pass
        // the connecting super_admin's id through as OAuth "state" so the
        // callback (which has no session context of its own) can record
        // who connected the integration.
        res.json({ authUrl: buildAuthUrl(String(req.user.id)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/zoho-workdrive/callback -- Zoho redirects here after the
// super_admin approves (or denies) access, with either ?code=... or
// ?error=... in the query string. Not behind requireAuth: Zoho's redirect
// is a plain browser navigation with no Authorization header, so auth
// here is implicit in "you had to already be logged in as super_admin to
// reach /connect in the first place."
const callback = async (req, res) => {
    const { code, error, state } = req.query;
    if (error) {
        return res.redirect('/hr-documents?zoho_error=' + encodeURIComponent(String(error)));
    }
    if (!code) {
        return res.redirect('/hr-documents?zoho_error=no_code');
    }
    try {
        const tokens = await exchangeCodeForTokens(code);
        const connectingUserId = state ? Number(state) : null;
        await saveRefreshToken(tokens.refresh_token, Number.isFinite(connectingUserId) ? connectingUserId : null);
        res.redirect('/hr-documents?zoho_connected=1');
    } catch (err) {
        console.error('Zoho WorkDrive token exchange failed:', err.response?.data || err.message);
        res.redirect('/hr-documents?zoho_error=' + encodeURIComponent('connection_failed'));
    }
};

// GET /api/hr-documents -- any logged-in user (requireAuth only, no role
// gate). Read-only: this route has no corresponding POST/PUT/DELETE, so
// "user role = view only" is enforced by the API surface itself, not just
// hidden buttons in the UI.
const listDocuments = async (req, res) => {
    try {
        const connected = await isConnected();
        if (!connected) {
            return res.status(200).json({ connected: false, items: [] });
        }
        const items = await listFolderContents();
        res.json({ connected: true, items });
    } catch (err) {
        if (err.code === 'NOT_CONNECTED') {
            return res.status(200).json({ connected: false, items: [] });
        }
        console.error('Zoho WorkDrive list failed:', err.response?.data || err.message);
        res.status(500).json({ error: 'Could not load documents from Zoho WorkDrive.' });
    }
};

// GET /api/hr-documents/status -- lets the frontend show "Connect Zoho
// WorkDrive" vs the file list without needing a super_admin-only probe.
const connectionStatus = async (req, res) => {
    try {
        res.json({ connected: await isConnected() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { connect, callback, listDocuments, connectionStatus };
