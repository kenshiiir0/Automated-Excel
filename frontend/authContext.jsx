import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY = 'hr_auth_token';
const USER_KEY = 'hr_auth_user';

// Wraps the browser's own fetch so every API call this app makes
// automatically carries the login token, without having to edit every
// existing fetch('/api/...') call across the codebase (Dashboard.jsx,
// EmployeeList.jsx, InternList.jsx, RecruitmentTracker.jsx, etc. all keep
// working exactly as written). If a response ever comes back 401 (token
// missing/expired/invalid), it clears the stored session and reloads to
// the login screen -- so an expired session surfaces as "please log in
// again" instead of a confusing blank page or silent failure.
function installAuthFetch(onUnauthorized) {
    if (window.__hrFetchPatched) return;
    window.__hrFetchPatched = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;
        const isApiCall = url.startsWith('/api/');
        const isAuthCall = url.startsWith('/api/auth/');

        if (isApiCall && !isAuthCall) {
            const token = localStorage.getItem(TOKEN_KEY);
            if (token) {
                init = {
                    ...init,
                    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
                };
            }
        }

        const res = await originalFetch(input, init);
        if (isApiCall && !isAuthCall && res.status === 401) {
            onUnauthorized();
        }
        return res;
    };
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });
    // Drives the brief "Signing out..." state on the logged-in shell while
    // we clear storage and swap back to the login screen -- purely a UI
    // affordance since logout itself is instant/local, but it stops the
    // screen from just snapping away with no feedback.
    const [loggingOut, setLoggingOut] = useState(false);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setLoggingOut(false);
    }, []);

    const logoutWithDelay = useCallback(() => {
        setLoggingOut(true);
        setTimeout(() => logout(), 450);
    }, [logout]);

    // Patched synchronously during render (NOT inside useEffect) so that
    // window.fetch already carries the auth header before any child
    // component's own useEffect can fire its first API call. On a hard
    // refresh, React mounts AuthProvider and its children together; if
    // this patch happened inside a useEffect here, a child's effect
    // (e.g. a page's initial data fetch) could run first and go out
    // with no Authorization header at all -- a real, correct 401 from
    // the server, but a confusing one since the token was fine all
    // along. Calling it directly in the component body avoids that race.
    installAuthFetch(logout);

    const login = useCallback(async (username, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Login failed.');
        }
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
    }, []);

    // Signup step 1: send the OTP. Throws with a friendly message on
    // failure (e.g. wrong domain, already registered) for the form to show.
    const requestSignupOtp = useCallback(async (email, fullName, password) => {
        const res = await fetch('/api/auth/signup/request-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, fullName, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not send verification code.');
        return data;
    }, []);

    // Signup step 2: verify the code. On success the account is active,
    // but the user still needs to log in with their new credentials --
    // we don't auto-login here so the flow ends the same way a normal
    // login would (deliberate choice, keeps the mental model simple).
    const verifySignupOtp = useCallback(async (email, code) => {
        const res = await fetch('/api/auth/signup/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed.');
        return data;
    }, []);

    // Called after a profile edit (e.g. name change) so the sidebar and
    // anywhere else showing `user` reflect it immediately, without needing
    // a full re-login. Merges into the existing stored user rather than
    // replacing it, since the profile response may include fields (email,
    // created_at, etc.) beyond what login originally stored.
    const setUserFromProfile = useCallback((updatedFields) => {
        setUser(prev => {
            const merged = { ...(prev || {}), ...updatedFields };
            localStorage.setItem(USER_KEY, JSON.stringify(merged));
            return merged;
        });
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout: logoutWithDelay, loggingOut, requestSignupOtp, verifySignupOtp, setUserFromProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
