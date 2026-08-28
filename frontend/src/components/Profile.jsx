import React, { useState, useEffect, useCallback, useRef } from 'react';
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

function fmtShortDate(v) {
    if (!v) return null;
    try {
        return new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return v;
    }
}

function StatusPill({ ok, trueLabel, falseLabel }) {
    return (
        <span className={`profile-status-pill ${ok ? 'ok' : 'warn'}`}>
            {ok ? trueLabel : falseLabel}
        </span>
    );
}

export default function Profile({ visible } = {}) {
    const { user: sessionUser, setUserFromProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [employee, setEmployee] = useState(null);
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
            setEmployee(data.employee || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // See EmployeeList.jsx's identical comment: kept-alive pages only
    // mount once per session, so this quietly re-fetches on returning
    // to the page (skipping the first mount). Safe alongside the name/
    // phone edit form below -- that form seeds its own local state from
    // `profile` only once, on its own mount (via useState's initializer),
    // so a background refresh here never overwrites text already typed
    // into it.
    const isFirstVisible = useRef(true);
    useEffect(() => {
        if (visible === undefined) return;
        if (isFirstVisible.current) { isFirstVisible.current = false; return; }
        if (visible) loadProfile();
    }, [visible, loadProfile]);

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

    const initials = (profile.full_name || profile.username || '?')
        .split(' ')
        .map(p => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="page-container profile-page">
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            <div className="profile-banner">
                <div className="profile-banner-bg" aria-hidden="true" />
                <div className="profile-banner-inner">
                    <div className="profile-avatar-xl">{initials}</div>
                    <div className="profile-banner-text">
                        <div className="profile-banner-name">
                            {profile.full_name || profile.username}
                            {profile.email_verified && (
                                <span className="profile-verified-badge" title="Email verified">
                                    <Icon name="check" size={12} />
                                </span>
                            )}
                        </div>
                        <div className="profile-banner-email">{profile.email || profile.username}</div>
                    </div>
                </div>
            </div>

            <div className="profile-card-grid">
                <div className="profile-info-card">
                    <div className="profile-form-title">Account Details</div>
                    <InfoRow label="Username" value={profile.username} />
                    <InfoRow label="Full Name" value={profile.full_name || '—'} />
                    <InfoRow label="Email" value={profile.email || '—'} />
                    <InfoRow label="Phone" value={profile.phone || '—'} />
                    <InfoRow label="Role" value={profile.role} capitalize />
                </div>

                <WorkInfoCard employee={employee} />

                <div className="profile-info-card">
                    <div className="profile-form-title">Security &amp; Activity</div>
                    <InfoRow label="Member Since" value={fmtDate(profile.created_at)} />
                    <InfoRow label="Last Login" value={fmtDate(profile.last_login_at)} />
                    <InfoRowPill label="Email Verification">
                        <StatusPill ok={profile.email_verified} trueLabel="Verified" falseLabel="Unverified" />
                    </InfoRowPill>
                    <InfoRowPill label="Account Status">
                        <StatusPill ok={profile.is_active} trueLabel="Active" falseLabel="Inactive" />
                    </InfoRowPill>
                </div>

                <EditProfileCard
                    profile={profile}
                    onSaved={(updated, updatedEmployee) => {
                        setProfile(updated);
                        if (updatedEmployee !== undefined) setEmployee(updatedEmployee);
                        if (setUserFromProfile) setUserFromProfile(updated);
                        showToast('success', 'Profile updated.');
                    }}
                    onError={(msg) => showToast('error', msg)}
                />
            </div>

            <div className="profile-card-grid profile-card-grid-single">
                <ChangePasswordCard
                    onSaved={() => showToast('success', 'Password updated.')}
                    onError={(msg) => showToast('error', msg)}
                />
            </div>
        </div>
    );
}

function InfoRow({ label, value, capitalize }) {
    return (
        <div className="profile-workinfo-row">
            <span className="profile-workinfo-label">{label}</span>
            <span className={`profile-workinfo-value${capitalize ? ' cap' : ''}`}>{value}</span>
        </div>
    );
}

function InfoRowPill({ label, children }) {
    return (
        <div className="profile-workinfo-row">
            <span className="profile-workinfo-label">{label}</span>
            {children}
        </div>
    );
}

const WORK_INFO_ROWS = [
    ['position', 'Position'],
    ['department', 'Department'],
    ['position_category', 'Category'],
    ['employment_status', 'Employment Status'],
    ['employment_classification', 'Classification'],
    ['work_arrangement', 'Work Arrangement'],
    ['territory', 'Territory'],
    ['reporting_to', 'Reports To'],
];

function WorkInfoCard({ employee }) {
    if (!employee) {
        return (
            <div className="profile-info-card">
                <div className="profile-form-title">Work Information</div>
                <p className="profile-workinfo-empty">
                    No matching employee record found for this account's email. Work details will
                    appear here once this login is linked to an employee.
                </p>
            </div>
        );
    }

    const hireDate = fmtShortDate(employee.hire_date);

    return (
        <div className="profile-info-card">
            <div className="profile-form-title">Work Information</div>
            {employee.emp_id && <div className="profile-workinfo-empid">ID: {employee.emp_id}</div>}
            {WORK_INFO_ROWS.map(([key, label]) => (
                employee[key] ? <InfoRow key={key} label={label} value={employee[key]} /> : null
            ))}
            {hireDate && <InfoRow label="Hire Date" value={hireDate} />}
        </div>
    );
}

function EditProfileCard({ profile, onSaved, onError }) {
    const [fullName, setFullName] = useState(profile.full_name || '');
    const [phone, setPhone] = useState(profile.phone || '');
    const [submitting, setSubmitting] = useState(false);

    const dirty = (fullName.trim() !== (profile.full_name || '') && fullName.trim().length > 0)
        || phone.trim() !== (profile.phone || '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!dirty) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, phone }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update profile.');
            onSaved(data.user, data.employee);
        } catch (err) {
            onError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="profile-form-card" onSubmit={handleSubmit}>
            <div className="profile-form-title">Edit Profile</div>
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
            <div className="emp-form-group">
                <label className="emp-form-label">Phone Number</label>
                <input
                    className="emp-form-input"
                    type="tel"
                    placeholder="e.g. 0917 123 4567"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                />
            </div>
            <button type="submit" className="btn-primary" disabled={!dirty || submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {submitting && <span className="btn-spinner" />}
                {submitting ? 'Saving…' : 'Save Changes'}
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

            <div className="profile-password-grid">
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
            </div>

            <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
                {submitting && <span className="btn-spinner" />}
                {submitting ? 'Updating…' : 'Update Password'}
            </button>
        </form>
    );
}
