import React, { useState } from 'react';
import { useAuth } from './authContext.jsx';
import Icon from './Icon.jsx';

export default function Login() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await login(username, password);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-brand">
                    <span className="brand-mark" style={{ width: 44, height: 44, fontSize: 16 }}>GM</span>
                    <div>
                        <div className="login-title">GetMeds HR</div>
                        <div className="login-subtitle">Analytics &amp; Portal</div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="emp-form-group">
                        <label className="emp-form-label">Username</label>
                        <input
                            className="emp-form-input"
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="emp-form-group">
                        <label className="emp-form-label">Password</label>
                        <div className="login-password-wrap">
                            <input
                                className="emp-form-input"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="login-password-toggle"
                                onClick={() => setShowPassword(s => !s)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                tabIndex={-1}
                            >
                                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                            </button>
                        </div>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={submitting}>
                        {submitting ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
