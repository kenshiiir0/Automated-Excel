import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../Icon.jsx';
import Modal from '../../Modal.jsx';
import { useAuth } from '../../authContext.jsx';

const ROLE_META = {
    super_admin: { label: 'Super Admin', bg: '#fdecea', color: '#c0392b' },
    admin: { label: 'Admin', bg: '#e3f2fd', color: '#1565c0' },
    user: { label: 'User', bg: '#f1f5f9', color: '#475569' },
};

function RolePill({ role }) {
    const meta = ROLE_META[role] || ROLE_META.user;
    return (
        <span className="user-role-pill" style={{ background: meta.bg, color: meta.color }}>
            {meta.label}
        </span>
    );
}

function fmtDate(v) {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return v;
    }
}

// last_seen_at is refreshed on any authenticated API call (throttled to
// once a minute server-side, see lib/requireAuth.js), so "Online" here
// means "made a request within the last ~15 minutes" -- an approximation,
// not a live/real-time presence indicator. There's no server-side session
// list to check against with stateless JWTs, so this is the practical
// substitute: cheap, and close enough for "is this person around right
// now" at a glance.
const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

function isOnline(lastSeenAt) {
    if (!lastSeenAt) return false;
    return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

function OnlineIndicator({ lastSeenAt }) {
    const online = isOnline(lastSeenAt);
    return (
        <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: online ? '#137333' : '#a0aec0', fontWeight: online ? 700 : 500 }}
            title={online ? 'Active within the last 15 minutes' : 'Not recently active'}
        >
            <span style={{
                width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                background: online ? '#34a853' : '#cbd5e0',
                boxShadow: online ? '0 0 0 3px rgba(52,168,83,0.18)' : 'none',
            }} />
            {online ? 'Online' : 'Offline'}
        </span>
    );
}

const EMPTY_NEW_USER = { fullName: '', email: '', role: 'user' };

// Lightweight account creation: a super_admin only picks who this is and
// what tier they start at. No password, no phone, no employee linkage --
// the new person handles the rest of their own profile once they log in
// with the temporary password we email them (self-signup, by contrast,
// requires the person filling in a password themselves + an OTP check).
function CreateAccountModal({ onClose, onCreated, showToast }) {
    const [form, setForm] = useState(EMPTY_NEW_USER);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    const handleChange = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.email.trim(), fullName: form.fullName.trim(), role: form.role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not create account.');
            onCreated(data.user);
            setResult(data);
            if (data.emailSent) {
                showToast('success', 'Account created. Welcome email sent.');
            } else {
                showToast('error', 'Account created, but the welcome email failed to send.');
            }
        } catch (err) {
            showToast('error', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // After a successful create, swap the form for a confirmation screen
    // showing the temp password -- this is the fallback if the email
    // never arrives, so the admin isn't stuck.
    if (result) {
        return (
            <Modal title="Account Created" onClose={onClose} maxWidth={480}>
                <p style={{ fontSize: 13.5, color: '#4a5568', marginTop: 0 }}>
                    {result.user.full_name}'s account is active. {result.emailSent
                        ? 'A welcome email with sign-in details was sent to ' + result.user.email + '.'
                        : "The welcome email couldn't be sent -- share these details with them directly:"}
                </p>
                {!result.emailSent && (
                    <div className="emp-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="emp-form-group">
                            <label className="emp-form-label">Username</label>
                            <div className="emp-form-input" style={{ background: '#f8fafc' }}>{result.user.email}</div>
                        </div>
                        <div className="emp-form-group">
                            <label className="emp-form-label">Temporary Password</label>
                            <div className="emp-form-input" style={{ background: '#f8fafc', fontWeight: 700, letterSpacing: 0.5 }}>
                                {result.tempPassword}
                            </div>
                        </div>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <button type="button" className="btn-primary" onClick={onClose}>Done</button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal title="Create Account" onClose={onClose} maxWidth={480}>
            <form onSubmit={handleSubmit}>
                <div className="emp-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="emp-form-group">
                        <label className="emp-form-label">Full Name</label>
                        <input
                            className="emp-form-input"
                            type="text"
                            value={form.fullName}
                            onChange={handleChange('fullName')}
                            required
                        />
                    </div>
                    <div className="emp-form-group">
                        <label className="emp-form-label">Email</label>
                        <input
                            className="emp-form-input"
                            type="email"
                            value={form.email}
                            onChange={handleChange('email')}
                            required
                        />
                    </div>
                    <div className="emp-form-group">
                        <label className="emp-form-label">Role</label>
                        <select className="emp-form-input" value={form.role} onChange={handleChange('role')}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                        </select>
                    </div>
                </div>
                <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>
                    A temporary password is generated automatically and emailed to them. They can update their
                    name, phone, and password later from their own Profile page.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={submitting}>
                        {submitting ? 'Creating…' : 'Create Account'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default function UserManagement() {
    const { user: sessionUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);
    const [savingId, setSavingId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const isSuperAdmin = sessionUser?.role === 'super_admin';

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load accounts.');
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    const handleRoleChange = async (id, role) => {
        setSavingId(id);
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update role.');
            setUsers(prev => prev.map(u => (u.id === id ? data.user : u)));
            showToast('success', 'Role updated.');
        } catch (err) {
            showToast('error', err.message);
        } finally {
            setSavingId(null);
        }
    };

    const handleToggleActive = async (id, currentlyActive) => {
        setSavingId(id);
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !currentlyActive }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update status.');
            setUsers(prev => prev.map(u => (u.id === id ? data.user : u)));
            showToast('success', currentlyActive ? 'Account deactivated.' : 'Account activated.');
        } catch (err) {
            showToast('error', err.message);
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return <div className="page-loading">Loading accounts…</div>;
    }

    return (
        <div className="page-container">
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            <div className="page-header">
                <div>
                    <h1 className="page-title">Manage Users</h1>
                    <p className="page-subtitle">
                        {isSuperAdmin
                            ? 'Assign roles, control who can sign in, and create new accounts.'
                            : 'Account list. Only a Super Admin can change roles or status.'}
                    </p>
                </div>
                {isSuperAdmin && (
                    <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                        + Add Account
                    </button>
                )}
            </div>

            {showCreateModal && (
                <CreateAccountModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(newUser) => setUsers(prev => [...prev, newUser])}
                    showToast={showToast}
                />
            )}

            {error && <div className="login-error">Could not load accounts: {error}</div>}

            <div className="table-card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Presence</th>
                            <th>Member Since</th>
                            <th>Last Login</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0', fontStyle: 'italic' }}>
                                    No accounts found.
                                </td>
                            </tr>
                        ) : users.map(u => {
                            const isSelf = u.id === sessionUser?.id;
                            const canEditThis = isSuperAdmin && !isSelf;
                            return (
                                <tr key={u.id} className="table-row">
                                    <td style={{ fontWeight: 600, color: '#1a202c' }}>
                                        {u.full_name || u.username}
                                        {isSelf && <span style={{ marginLeft: 6, fontSize: 11, color: '#a0aec0' }}>(you)</span>}
                                    </td>
                                    <td style={{ fontSize: 12, color: '#718096' }}>{u.email || u.username}</td>
                                    <td>
                                        {canEditThis ? (
                                            <select
                                                className="filter-select"
                                                value={u.role}
                                                disabled={savingId === u.id}
                                                onChange={e => handleRoleChange(u.id, e.target.value)}
                                                style={{ fontSize: 12, padding: '6px 10px' }}
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                                <option value="super_admin">Super Admin</option>
                                            </select>
                                        ) : (
                                            <RolePill role={u.role} />
                                        )}
                                    </td>
                                    <td>
                                        {canEditThis ? (
                                            <button
                                                type="button"
                                                className={`profile-status-pill ${u.is_active ? 'ok' : 'warn'}`}
                                                style={{ border: 'none', cursor: savingId === u.id ? 'default' : 'pointer' }}
                                                disabled={savingId === u.id}
                                                onClick={() => handleToggleActive(u.id, u.is_active)}
                                                title="Click to toggle"
                                            >
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        ) : (
                                            <span className={`profile-status-pill ${u.is_active ? 'ok' : 'warn'}`}>
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        )}
                                    </td>
                                    <td><OnlineIndicator lastSeenAt={u.last_seen_at} /></td>
                                    <td style={{ fontSize: 12, color: '#a0aec0' }}>{fmtDate(u.created_at)}</td>
                                    <td style={{ fontSize: 12, color: '#a0aec0' }}>{fmtDate(u.last_login_at)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
