import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { reportApiRequestTiming } from './NetworkStatusBanner.jsx';

const AuthContext = createContext(null);
const TOKEN_KEY = 'hr_auth_token';
const USER_KEY = 'hr_auth_user';
const LAST_ACTIVE_KEY = 'hr_last_active_at';

// How long a session survives with the tab closed (or the app otherwise
// not visible) before it's treated as expired. Session itself isn't
// touched on the server -- the JWT is still valid for its full 12h --
// this just makes the app forget the stored token client-side and send
// the person back to the login screen after enough idle/closed time has
// passed, which is what "logs out on tab close" means in practice for a
// stateless-token setup like this one.
const CLOSED_TAB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// True if more time than the timeout has passed since we last saw this
// tab active. No stamp at all (first-ever visit, or storage was cleared)
// counts as "not expired" -- there's nothing to compare against, and
// login() will set a fresh stamp anyway.
function isSessionExpiredByInactivity() {
    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!lastActive) return false;
    const elapsed = Date.now() - Number(lastActive);
    return elapsed > CLOSED_TAB_TIMEOUT_MS;
}

function stampLastActive() {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

// Wraps the browser's own fetch so every API call this app makes
// automatically carries the login token, without having to edit every
// existing fetch('/api/...') call across the codebase (Dashboard.jsx,
// EmployeeList.jsx, InternList.jsx, RecruitmentTracker.jsx, etc. all keep
// working exactly as written). If a response ever comes back 401 (token
// missing/expired/invalid), it clears the stored session and reloads to
// the login screen -- so an expired session surfaces as "please log in
// again" instead of a confusing blank page or silent failure.
//
// onUnauthorized now receives the server's actual error message (e.g.
// "Session expired or invalid. Please log in again." from requireAuth.js)
// instead of just being a bare signal -- this is what lets the app show
// a real, specific reason instead of the page just silently snapping back
// to the login screen with no explanation, which is what made a forced
// logout look identical to an unexplained "restart".
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

        // Times every API call so the network-status banner can flag a
        // slow connection -- there's no single browser signal for
        // "slow" the way there is for "offline", so request duration is
        // used as a proxy. Reported for every /api/ call, auth included,
        // since a slow login should surface the same warning.
        //
        // draft-narrative is excluded from this timing report on purpose:
        // it's a real AI (Gemini) call that legitimately takes several
        // seconds even when everything is working correctly -- reporting
        // its normal latency here made the generic "Slow connection
        // detected" banner fire on ordinary successful drafts, which is
        // actively misleading (it looks like a network problem when
        // there isn't one) and duplicates/contradicts the AI Draft
        // button's own specific status (its ticking counter while
        // waiting, and a real success/error toast once it's done).
        const isDraftNarrativeCall = url.startsWith('/api/disciplinary-memos/draft-narrative');
        const startedAt = Date.now();
        try {
            const res = await originalFetch(input, init);
            if (isApiCall && !isDraftNarrativeCall) {
                reportApiRequestTiming(Date.now() - startedAt, false);
            }
            if (isApiCall && !isAuthCall && res.status === 401) {
                // Try to read the server's specific reason before the
                // caller (whatever component made this fetch) also reads
                // the body -- res.clone() means both can read it
                // independently without "body already used" errors.
                let reason = 'Your session has expired. Please log in again.';
                try {
                    const cloned = res.clone();
                    const body = await cloned.json();
                    if (body && body.error) reason = body.error;
                } catch {
                    // Not JSON, or already consumed -- fall back to the
                    // generic message rather than failing the whole flow.
                }
                onUnauthorized(reason);
            }
            return res;
        } catch (err) {
            // A network-level failure (e.g. truly offline, DNS gone) --
            // the 'offline' browser event usually covers this already,
            // but counting it as "slow/failed" here too means a flaky
            // connection that isn't fully offline still gets flagged.
            if (isApiCall && !isDraftNarrativeCall) {
                reportApiRequestTiming(Date.now() - startedAt, true);
            }
            throw err;
        }
    };
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            // If the tab (or the whole browser) was closed for longer than
            // the timeout, treat the stored session as gone before it's
            // ever read into state -- this is what makes the app land on
            // the login screen on reopen instead of silently staying
            // signed in on an old token.
            if (isSessionExpiredByInactivity()) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
                localStorage.removeItem(LAST_ACTIVE_KEY);
                return null;
            }
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

    // Set only when logout was FORCED by the server rejecting a request
    // (a real 401), as opposed to the person clicking "Log out"
    // themselves. Read once by Login.jsx to show a real reason (e.g.
    // "Your session expired after 12 hours") instead of the screen just
    // silently reappearing with no explanation of what happened.
    const [sessionExpiredReason, setSessionExpiredReason] = useState(null);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(LAST_ACTIVE_KEY);
        setUser(null);
        setLoggingOut(false);
    }, []);

    const logoutWithDelay = useCallback((reason) => {
        // reason is only meaningful when this came from a forced 401 (see
        // installAuthFetch above / onForcedLogout below), where it's a
        // real message string. Navigation.jsx wires this straight up as
        // onClick={logout} for the manual "Log out" button, which means
        // React passes a SyntheticEvent as this same argument on a normal
        // click -- the typeof check is what keeps that from being
        // mistaken for a session-expired reason and shown as a bogus
        // error on an ordinary, deliberate logout.
        if (typeof reason === 'string' && reason) setSessionExpiredReason(reason);
        setLoggingOut(true);
        setTimeout(() => logout(), 450);
    }, [logout]);

    // Wraps logoutWithDelay specifically for installAuthFetch's
    // onUnauthorized callback so the reason string from a real 401 always
    // reaches sessionExpiredReason, independent of whatever
    // AuthContext.logout consumers pass (they never pass a reason).
    const onForcedLogout = useCallback((reason) => {
        logoutWithDelay(reason);
    }, [logoutWithDelay]);

    // Patched synchronously during render (NOT inside useEffect) so that
    // window.fetch already carries the auth header before any child
    // component's own useEffect can fire its first API call. On a hard
    // refresh, React mounts AuthProvider and its children together; if
    // this patch happened inside a useEffect here, a child's effect
    // (e.g. a page's initial data fetch) could run first and go out
    // with no Authorization header at all -- a real, correct 401 from
    // the server, but a confusing one since the token was fine all
    // along. Calling it directly in the component body avoids that race.
    installAuthFetch(onForcedLogout);

    // Keeps LAST_ACTIVE_KEY fresh while this tab is open and visible, so
    // "time since last active" only starts counting once the tab is
    // actually closed/backgrounded, not from the moment it was opened.
    // Three triggers cover the real ways a tab stops being "active":
    // a periodic tick (in case the other two are missed), the tab losing
    // focus/visibility, and the tab/window actually closing.
    useEffect(() => {
        if (!user) return undefined;

        stampLastActive();
        const intervalId = setInterval(stampLastActive, 60 * 1000);

        const onVisibilityOrUnload = () => {
            if (document.visibilityState === 'hidden' || document.visibilityState === undefined) {
                stampLastActive();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityOrUnload);
        window.addEventListener('beforeunload', stampLastActive);
        window.addEventListener('pagehide', stampLastActive);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityOrUnload);
            window.removeEventListener('beforeunload', stampLastActive);
            window.removeEventListener('pagehide', stampLastActive);
        };
    }, [user]);

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
        stampLastActive();
        setSessionExpiredReason(null);
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
        <AuthContext.Provider value={{
            user,
            login,
            logout: logoutWithDelay,
            loggingOut,
            sessionExpiredReason,
            clearSessionExpiredReason: () => setSessionExpiredReason(null),
            requestSignupOtp,
            verifySignupOtp,
            setUserFromProfile,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
