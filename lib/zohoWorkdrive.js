import axios from 'axios';
import { supabaseAdmin } from './supabase.js';

// Global/US Zoho data center -- accounts.zoho.com for OAuth, zohoapis.com
// for the WorkDrive API itself. If this org is ever migrated to a
// different data center (.eu, .in, etc.), these two base URLs are the
// only things that need to change.
const ACCOUNTS_BASE = 'https://accounts.zoho.com';
const WORKDRIVE_API_BASE = 'https://www.zohoapis.com/workdrive/api/v1';

function getClientId() {
    const id = process.env.ZOHO_WORKDRIVE_CLIENT_ID;
    if (!id) throw new Error('ZOHO_WORKDRIVE_CLIENT_ID is not set.');
    return id;
}
function getClientSecret() {
    const secret = process.env.ZOHO_WORKDRIVE_CLIENT_SECRET;
    if (!secret) throw new Error('ZOHO_WORKDRIVE_CLIENT_SECRET is not set.');
    return secret;
}
function getRedirectUri() {
    // Must match EXACTLY what's registered in the Zoho API Console's
    // "Authorized Redirect URIs" -- Zoho rejects the request otherwise.
    return process.env.ZOHO_WORKDRIVE_REDIRECT_URI
        || 'https://automated-excel-three.vercel.app/api/zoho-workdrive/callback';
}
function getFolderId() {
    const id = process.env.ZOHO_WORKDRIVE_FOLDER_ID;
    if (!id) throw new Error('ZOHO_WORKDRIVE_FOLDER_ID is not set.');
    return id;
}

// Step 1 of OAuth: the URL we send a super_admin's browser to, so they can
// approve HR Automation reading their WorkDrive folder. WorkDrive.files.READ
// is the narrowest scope that lets us list/read files -- no write scope is
// requested, since this integration is read-only by design.
function buildAuthUrl(state) {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: getClientId(),
        scope: 'WorkDrive.files.READ',
        redirect_uri: getRedirectUri(),
        access_type: 'offline', // required to get a refresh_token back, not just an access_token
        prompt: 'consent',       // forces the consent screen so we reliably get a refresh_token even on repeat connects
    });
    // "state" round-trips through Zoho unchanged and comes back on the
    // callback -- used here to carry the connecting super_admin's user id
    // across the redirect, since the callback itself has no session/cookie
    // to read it from otherwise.
    if (state) params.set('state', state);
    return `${ACCOUNTS_BASE}/oauth/v2/auth?${params.toString()}`;
}

// Step 2 of OAuth: exchange the one-time authorization code (from the
// callback query string) for an access token + refresh token, and persist
// the refresh token -- that's the only piece we need to keep long-term.
async function exchangeCodeForTokens(code) {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        redirect_uri: getRedirectUri(),
        code,
    });
    const { data } = await axios.post(`${ACCOUNTS_BASE}/oauth/v2/token`, params);
    if (!data.refresh_token) {
        throw new Error('Zoho did not return a refresh_token. Try disconnecting the app in Zoho account settings and reconnecting.');
    }
    return data; // { access_token, refresh_token, expires_in, ... }
}

async function saveRefreshToken(refreshToken, connectedByUserId) {
    const { error } = await supabaseAdmin
        .from('zoho_workdrive_connection')
        .upsert({ id: 1, refresh_token: refreshToken, connected_by: connectedByUserId, connected_at: new Date().toISOString() });
    if (error) throw error;
}

async function getStoredRefreshToken() {
    const { data, error } = await supabaseAdmin
        .from('zoho_workdrive_connection')
        .select('refresh_token')
        .eq('id', 1)
        .maybeSingle();
    if (error) throw error;
    return data?.refresh_token || null;
}

// In-memory access-token cache, shared across requests within the same
// running server instance. Access tokens live ~1 hour; refreshing on
// every single API call would be wasteful and slower than needed, so we
// keep the current one and its expiry in memory and only ask Zoho for a
// new one a little before it actually expires.
let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

async function getAccessToken() {
    const now = Date.now();
    if (cachedAccessToken && now < cachedAccessTokenExpiresAt - 60_000) {
        return cachedAccessToken;
    }

    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) {
        const err = new Error('WorkDrive is not connected yet. A super admin needs to connect it first.');
        err.code = 'NOT_CONNECTED';
        throw err;
    }

    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: refreshToken,
    });
    const { data } = await axios.post(`${ACCOUNTS_BASE}/oauth/v2/token`, params);
    cachedAccessToken = data.access_token;
    cachedAccessTokenExpiresAt = now + (data.expires_in * 1000);
    return cachedAccessToken;
}

// Lists the immediate contents of a given WorkDrive folder (defaults to
// the one connected "HR Documents" root). Used both for the initial page
// load and for drilling into a subfolder -- the frontend just passes a
// different folderId as the user clicks into folders. WorkDrive's API is
// JSON:API-shaped -- data is an array of { id, attributes: { name, type,
// ... } } objects.
async function listFolderContents(folderId = getFolderId()) {
    const accessToken = await getAccessToken();
    const { data } = await axios.get(`${WORKDRIVE_API_BASE}/files/${folderId}/files`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    return (data.data || []).map(item => ({
        id: item.id,
        name: item.attributes?.name,
        type: item.attributes?.type,               // 'folder' or a file type
        isFolder: item.attributes?.is_folder === true || item.attributes?.type === 'folder',
        modifiedTime: item.attributes?.modified_time,
        createdTime: item.attributes?.created_time,
        size: item.attributes?.storage_info?.size ?? null,
        // WorkDrive's own web viewer handles previewing every file type
        // (PDF, docx, images, ...) correctly -- rather than proxying raw
        // file bytes through our own server and reimplementing a viewer,
        // "opening" a file just sends the user to this page, in a new tab.
        permalink: item.attributes?.permalink || `https://workdrive.zoho.com/file/${item.id}`,
    }));
}

// One level of "is this folder actually inside the connected HR
// Documents tree" safety: WorkDrive's own permission model already
// blocks a request for a folder the connected account can't see, so this
// isn't a hard security boundary -- it's just a basic guard against a
// stray/mistyped folderId making a pointless API call.
function isLikelyValidFolderId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{5,60}$/.test(id);
}

// Streams a file's raw bytes from WorkDrive, authenticated with our own
// stored access token -- so an HR app viewer never needs a Zoho login of
// their own, unlike opening the item.permalink WorkDrive web-viewer URL
// directly. Returns an axios response with responseType 'stream' so the
// caller (the Express route) can pipe it straight to the browser without
// buffering the whole file in memory.
async function downloadFileStream(fileId) {
    const accessToken = await getAccessToken();
    return axios.get(`${WORKDRIVE_API_BASE}/download/${fileId}`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        responseType: 'stream',
    });
}

async function isConnected() {
    const token = await getStoredRefreshToken();
    return !!token;
}

export {
    buildAuthUrl,
    exchangeCodeForTokens,
    saveRefreshToken,
    listFolderContents,
    downloadFileStream,
    isConnected,
    getFolderId,
    isLikelyValidFolderId,
};
