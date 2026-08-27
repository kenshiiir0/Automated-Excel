import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../Icon.jsx';
import { useAuth } from '../../authContext.jsx';

function fmtDate(v) {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return v;
    }
}

function fmtSize(bytes) {
    if (bytes === null || bytes === undefined) return '—';
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Reads ?zoho_connected=1 / ?zoho_error=... left by the OAuth callback
// redirect, shows a one-time toast for it, then strips the query string
// so a page refresh doesn't re-show the same message.
function useConnectionRedirectToast(showToast) {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const connected = params.get('zoho_connected');
        const error = params.get('zoho_error');
        if (connected) {
            showToast('success', 'Zoho WorkDrive connected.');
        } else if (error) {
            showToast('error', `Could not connect Zoho WorkDrive (${error}).`);
        }
        if (connected || error) {
            params.delete('zoho_connected');
            params.delete('zoho_error');
            const qs = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}

export default function HrDocuments() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';

    const [connected, setConnected] = useState(null); // null = not checked yet
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    }, []);

    useConnectionRedirectToast(showToast);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/hr-documents');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load documents.');
            setConnected(data.connected);
            setItems(Array.isArray(data.items) ? data.items : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const [connecting, setConnecting] = useState(false);

    // Can't use a plain <a href="/api/zoho-workdrive/connect"> here --
    // that route requires a Bearer token (requireAuth), and a raw browser
    // navigation can't attach one (only our patched fetch() can, via
    // authContext.jsx). So this fetches the Zoho consent URL as JSON
    // first, authenticated, then does the actual page navigation itself.
    const handleConnect = async () => {
        setConnecting(true);
        try {
            const res = await fetch('/api/zoho-workdrive/connect');
            const data = await res.json();
            if (!res.ok || !data.authUrl) throw new Error(data.error || 'Could not start the Zoho connection.');
            window.location.href = data.authUrl;
        } catch (err) {
            showToast('error', err.message);
            setConnecting(false);
        }
    };

    const sortedItems = [...items].sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
    });

    return (
        <div className="page-container">
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            <div className="page-header">
                <div>
                    <h1 className="page-title">HR Documents</h1>
                    <p className="page-subtitle">
                        Company files synced from Zoho WorkDrive.
                    </p>
                </div>
                {isSuperAdmin && connected && (
                    <button type="button" className="btn-ghost" onClick={handleConnect} disabled={connecting}>
                        {connecting ? 'Redirecting…' : 'Reconnect'}
                    </button>
                )}
            </div>

            {error && <div className="login-error">Could not load documents: {error}</div>}

            {loading ? (
                <div className="page-loading">Loading…</div>
            ) : connected === false ? (
                <div className="table-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ color: '#cbd5e0', marginBottom: 12 }}>
                        <Icon name="folder" size={40} />
                    </div>
                    <p style={{ fontSize: 14.5, color: '#4a5568', margin: '0 0 4px' }}>
                        Zoho WorkDrive isn't connected yet.
                    </p>
                    {isSuperAdmin ? (
                        <>
                            <p style={{ fontSize: 13, color: '#a0aec0', margin: '0 0 16px' }}>
                                Connect it once, and files will stay in sync automatically for everyone.
                            </p>
                            <button type="button" className="btn-primary" onClick={handleConnect} disabled={connecting}>
                                {connecting ? 'Redirecting…' : 'Connect Zoho WorkDrive'}
                            </button>
                        </>
                    ) : (
                        <p style={{ fontSize: 13, color: '#a0aec0', margin: 0 }}>
                            Ask a Super Admin to connect it from this page.
                        </p>
                    )}
                </div>
            ) : sortedItems.length === 0 ? (
                <div className="table-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#a0aec0', fontStyle: 'italic' }}>
                    This folder is empty.
                </div>
            ) : (
                <div className="table-card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Size</th>
                                <th>Last Modified</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedItems.map(item => (
                                <tr key={item.id} className="table-row">
                                    <td style={{ fontWeight: 600, color: '#1a202c', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Icon name={item.isFolder ? 'folder' : 'file'} size={16} />
                                        {item.name}
                                    </td>
                                    <td style={{ fontSize: 12, color: '#718096' }}>{item.isFolder ? '—' : fmtSize(item.size)}</td>
                                    <td style={{ fontSize: 12, color: '#a0aec0' }}>{fmtDate(item.modifiedTime)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
