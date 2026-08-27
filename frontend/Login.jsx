import React, { useState } from 'react';
import { useAuth } from './authContext.jsx';
import Icon from './Icon.jsx';

// ---------------------------------------------------------------------------
// Three-step auth screen:
//   'login'  -- username + password (existing accounts)
//   'signup' -- company email + full name + chosen password -> sends OTP
//   'verify' -- 6-digit code from email -> activates the account
// ---------------------------------------------------------------------------
export default function Login() {
    const [mode, setMode] = useState('login');

    return (
        <div className="login-page">
            <div className="login-page-bg" aria-hidden="true">
                <span className="login-blob login-blob-1" />
                <span className="login-blob login-blob-2" />
                <span className="login-blob login-blob-3" />
            </div>

            <div className="login-card">
                <div className="login-brand">
                    <span className="brand-mark login-brand-mark">GM</span>
                    <div>
                        <div className="login-title">GetMeds HR</div>
                        <div className="login-subtitle">Analytics &amp; Portal</div>
                    </div>
                </div>

                {mode === 'login' && <LoginForm onSwitchToSignup={() => setMode('signup')} />}
                {mode === 'signup' && (
                    <SignupForm
                        onBack={() => setMode('login')}
                        onOtpSent={(payload) => setMode(['verify', payload])}
                    />
                )}
                {Array.isArray(mode) && mode[0] === 'verify' && (
                    <VerifyForm signupPayload={mode[1]} onVerified={() => setMode('login')} onBack={() => setMode('signup')} />
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Step: Login
// ---------------------------------------------------------------------------
function LoginForm({ onSwitchToSignup }) {
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
        <>
            <form onSubmit={handleSubmit} className="login-form">
                <div className="emp-form-group">
                    <label className="emp-form-label">Username or Email</label>
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

                <button type="submit" className="btn-primary login-submit-btn" disabled={submitting}>
                    {submitting ? <span className="btn-spinner" /> : null}
                    {submitting ? 'Signing in…' : 'Sign In'}
                </button>
            </form>

            <div className="login-switch">
                New here?{' '}
                <button type="button" className="login-link-btn" onClick={onSwitchToSignup}>
                    Create an account
                </button>
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step: Signup (request OTP)
// ---------------------------------------------------------------------------
function SignupForm({ onBack, onOtpSent }) {
    const { requestSignupOtp } = useAuth();
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await requestSignupOtp(email, fullName, password);
            onOtpSent({ email: email.trim().toLowerCase(), fullName, password });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <button type="button" className="login-back-btn" onClick={onBack}>
                <Icon name="arrowLeft" size={14} /> Back to sign in
            </button>

            <div className="login-step-heading">
                <Icon name="userPlus" size={18} />
                <span>Create your admin account</span>
            </div>
            <p className="login-step-subtext">
                Use your company email — we'll send a verification code to confirm it's you.
            </p>

            <form onSubmit={handleSubmit} className="login-form">
                <div className="emp-form-group">
                    <label className="emp-form-label">Full Name</label>
                    <input
                        className="emp-form-input"
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        autoFocus
                        required
                    />
                </div>
                <div className="emp-form-group">
                    <label className="emp-form-label">Company Email</label>
                    <input
                        className="emp-form-input"
                        type="email"
                        placeholder="you@getmeds.ph"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
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
                            minLength={8}
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
                    <span className="login-hint">At least 8 characters.</span>
                </div>

                {error && <div className="login-error">{error}</div>}

                <button type="submit" className="btn-primary login-submit-btn" disabled={submitting}>
                    {submitting ? <span className="btn-spinner" /> : null}
                    {submitting ? 'Sending code…' : 'Send Verification Code'}
                </button>
            </form>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step: Verify OTP
// ---------------------------------------------------------------------------
function VerifyForm({ signupPayload, onVerified, onBack }) {
    const { verifySignupOtp, requestSignupOtp } = useAuth();
    const { email } = signupPayload;
    const [code, setCode] = useState('');
    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [resending, setResending] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await verifySignupOtp(email, code);
            onVerified();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleResend = async () => {
        setError(null);
        setInfo(null);
        setResending(true);
        try {
            // The request-otp endpoint upserts on email, so resubmitting the
            // same signup details simply issues (and emails) a fresh code.
            await requestSignupOtp(signupPayload.email, signupPayload.fullName, signupPayload.password);
            setInfo('A new code has been sent.');
        } catch (err) {
            setError(err.message);
        } finally {
            setResending(false);
        }
    };

    return (
        <>
            <button type="button" className="login-back-btn" onClick={onBack}>
                <Icon name="arrowLeft" size={14} /> Back
            </button>

            <div className="login-step-heading">
                <Icon name="shield" size={18} />
                <span>Verify your email</span>
            </div>
            <p className="login-step-subtext">
                We sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account.
            </p>

            <form onSubmit={handleSubmit} className="login-form">
                <div className="emp-form-group">
                    <label className="emp-form-label">Verification Code</label>
                    <input
                        className="emp-form-input login-otp-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="••••••"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                        autoFocus
                        required
                    />
                </div>

                {error && <div className="login-error">{error}</div>}
                {info && <div className="login-hint" style={{ display: 'block' }}>{info}</div>}

                <button type="submit" className="btn-primary login-submit-btn" disabled={submitting || code.length !== 6}>
                    {submitting ? <span className="btn-spinner" /> : null}
                    {submitting ? 'Verifying…' : 'Verify & Activate'}
                </button>
            </form>

            <div className="login-switch">
                Didn't get it?{' '}
                <button type="button" className="login-link-btn" onClick={handleResend} disabled={resending}>
                    Resend code
                </button>
            </div>
        </>
    );
}
