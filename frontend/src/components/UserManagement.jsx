import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../Icon.jsx';
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

export default function UserManagement() {
    const { user: sessionUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);
    const [savingId, setSavingId] = useState(null);

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
                            ? 'Assign roles and control who can sign in.'
                            : 'Account list. Only a Super Admin can change roles or status.'}
                    </p>
                </div>
            </div>

            {error && <div className="login-error">Could not load accounts: {error}</div>}

            <div className="table-card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Member Since</th>
                            <th>Last Login</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0', fontStyle: 'italic' }}>
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
