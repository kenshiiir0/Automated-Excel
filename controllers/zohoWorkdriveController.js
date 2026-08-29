import {
    buildAuthUrl,
    exchangeCodeForTokens,
    saveRefreshToken,
    listFolderContents,
    downloadFileStream,
    isConnected,
    isLikelyValidFolderId,
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
        console.error('controllers/zohoWorkdriveController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
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

// GET /api/hr-documents?folderId=... -- any logged-in user (requireAuth
// only, no role gate). Read-only: this route has no corresponding
// POST/PUT/DELETE, so "user role = view only" is enforced by the API
// surface itself, not just hidden buttons in the UI. Omitting folderId
// lists the connected root folder; passing one (from clicking a
// subfolder in the UI) lists that subfolder instead -- WorkDrive's own
// permission model is what actually stops this from reaching anything
// the connected account can't see, this route doesn't add its own
// folder allowlist on top of that.
const listDocuments = async (req, res) => {
    try {
        const connected = await isConnected();
        if (!connected) {
            return res.status(200).json({ connected: false, items: [] });
        }
        const { folderId } = req.query;
        if (folderId && !isLikelyValidFolderId(folderId)) {
            return res.status(400).json({ error: 'Invalid folder id.' });
        }
        const items = await listFolderContents(folderId || undefined);
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
        console.error('controllers/zohoWorkdriveController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// File types a browser tab can actually render on its own -- these get
// "inline" so the tab previews the file instead of triggering a save
// dialog. Everything else (docx, xlsx, zip, ...) has no in-browser
// renderer no matter what header we send, so it stays "attachment" and
// downloads -- that's a real browser limitation, not a choice we're
// making here.
const INLINE_PREVIEWABLE_TYPES = new Set([
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
    'text/plain', 'text/csv',
]);

function sanitizeFilenameForHeader(name) {
    // Content-Disposition filenames can't contain raw quotes/newlines --
    // strip anything that would break the header rather than reject it.
    return String(name || 'file').replace(/["\r\n]/g, '');
}

// GET /api/hr-documents/:fileId/download -- any logged-in account
// (requireAuth only, matching every other read route here). Streams the
// file's bytes through our own server so a plain 'user' account can open
// it without ever needing a Zoho login of their own -- unlike WorkDrive's
// own web-viewer link, which requires signing into Zoho.
const downloadFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        const { name } = req.query; // optional, passed by the frontend for a nicer filename
        const upstream = await downloadFileStream(fileId);
        const contentType = upstream.headers['content-type'] || 'application/octet-stream';

        if (contentType) res.setHeader('Content-Type', contentType);
        if (upstream.headers['content-length']) res.setHeader('Content-Length', upstream.headers['content-length']);

        // We set Content-Disposition ourselves (ignoring whatever WorkDrive
        // sent) so PDFs and images open inline in the browser tab instead
        // of forcing a "Save As" dialog -- WorkDrive's download endpoint
        // defaults to "attachment" for everything, which is what was
        // causing every file to download instead of preview.
        const baseType = contentType.split(';')[0].trim().toLowerCase();
        const disposition = INLINE_PREVIEWABLE_TYPES.has(baseType) ? 'inline' : 'attachment';
        const filename = sanitizeFilenameForHeader(name);
        res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

        upstream.data.pipe(res);
    } catch (err) {
        if (err.code === 'NOT_CONNECTED') {
            return res.status(409).json({ error: 'WorkDrive is not connected.' });
        }
        console.error('Zoho WorkDrive download failed:', err.response?.data || err.message);
        res.status(500).json({ error: 'Could not download this file from Zoho WorkDrive.' });
    }
};

export { connect, callback, listDocuments, connectionStatus, downloadFile };
