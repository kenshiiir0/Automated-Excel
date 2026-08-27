import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../Icon.jsx';
import { useAuth } from '../../authContext.jsx';

function fmtDate(v) {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleString('en-PH', {
            year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });
    } catch {
        return v;
    }
}

export default function Profile() {
    const { user: sessionUser, setUserFromProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/profile');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load profile.');
            setProfile(data.user);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    if (loading) {
        return <div className="page-loading">Loading profile…</div>;
    }
    if (error) {
        return (
            <div className="page-container">
                <div className="login-error">Could not load profile: {error}</div>
            </div>
        );
    }

    return (
        <div className="page-container profile-page">
            <div className="page-header">
                <div>
                    <div className="page-title">My Profile</div>
                    <div className="page-subtitle">Manage your account details and password.</div>
                </div>
            </div>

            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            <div className="profile-grid">
                <ProfileSummaryCard profile={profile} />
                <div className="profile-forms">
                    <EditNameCard
                        profile={profile}
                        onSaved={(updated) => {
                            setProfile(updated);
                            if (setUserFromProfile) setUserFromProfile(updated);
                            showToast('success', 'Name updated.');
                        }}
                        onError={(msg) => showToast('error', msg)}
                    />
                    <ChangePasswordCard
                        onSaved={() => showToast('success', 'Password updated.')}
                        onError={(msg) => showToast('error', msg)}
                    />
                </div>
            </div>
        </div>
    );
}

function ProfileSummaryCard({ profile }) {
    const initials = (profile.full_name || profile.username || '?')
        .split(' ')
        .map(p => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="profile-summary-card">
            <div className="profile-avatar-lg">{initials}</div>
            <div className="profile-summary-name">{profile.full_name || profile.username}</div>
            <div className="profile-summary-role">{profile.role}</div>

            <div className="profile-summary-rows">
                <div className="profile-summary-row">
                    <Icon name="mail" size={14} />
                    <span>{profile.email || profile.username}</span>
                </div>
                <div className="profile-summary-row">
                    <Icon name="clipboard" size={14} />
                    <span>Member since {fmtDate(profile.created_at)}</span>
                </div>
                <div className="profile-summary-row">
                    <Icon name="refresh" size={14} />
                    <span>Last login {fmtDate(profile.last_login_at)}</span>
                </div>
            </div>
        </div>
    );
}

function EditNameCard({ profile, onSaved, onError }) {
    const [fullName, setFullName] = useState(profile.full_name || '');
    const [submitting, setSubmitting] = useState(false);

    const dirty = fullName.trim() !== (profile.full_name || '') && fullName.trim().length > 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!dirty) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update name.');
            onSaved(data.user);
        } catch (err) {
            onError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="profile-form-card" onSubmit={handleSubmit}>
            <div className="profile-form-title">Display Name</div>
            <div className="emp-form-group">
                <label className="emp-form-label">Full Name</label>
                <input
                    className="emp-form-input"
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                />
            </div>
            <button type="submit" className="btn-primary" disabled={!dirty || submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {submitting && <span className="btn-spinner" />}
                {submitting ? 'Saving…' : 'Save Name'}
            </button>
        </form>
    );
}

function ChangePasswordCard({ onSaved, onError }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            onError('New password and confirmation do not match.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/profile/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update password.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            onSaved();
        } catch (err) {
            onError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="profile-form-card" onSubmit={handleSubmit}>
            <div className="profile-form-title">Change Password</div>

            <div className="emp-form-group">
                <label className="emp-form-label">Current Password</label>
                <div className="login-password-wrap">
                    <input
                        className="emp-form-input"
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        required
                    />
                    <button type="button" className="login-password-toggle" tabIndex={-1}
                        onClick={() => setShowCurrent(s => !s)}
                        aria-label={showCurrent ? 'Hide password' : 'Show password'}>
                        <Icon name={showCurrent ? 'eyeOff' : 'eye'} size={16} />
                    </button>
                </div>
            </div>

            <div className="emp-form-group">
                <label className="emp-form-label">New Password</label>
                <div className="login-password-wrap">
                    <input
                        className="emp-form-input"
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        minLength={8}
                        required
                    />
                    <button type="button" className="login-password-toggle" tabIndex={-1}
                        onClick={() => setShowNew(s => !s)}
                        aria-label={showNew ? 'Hide password' : 'Show password'}>
                        <Icon name={showNew ? 'eyeOff' : 'eye'} size={16} />
                    </button>
                </div>
                <span className="login-hint">At least 8 characters.</span>
            </div>

            <div className="emp-form-group">
                <label className="emp-form-label">Confirm New Password</label>
                <input
                    className="emp-form-input"
                    type={showNew ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                />
            </div>

            <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {submitting && <span className="btn-spinner" />}
                {submitting ? 'Updating…' : 'Update Password'}
            </button>
        </form>
    );
}
