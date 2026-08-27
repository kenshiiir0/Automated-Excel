import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
        const isLoginCall = url.startsWith('/api/auth/login');

        if (isApiCall && !isLoginCall) {
            const token = localStorage.getItem(TOKEN_KEY);
            if (token) {
                init = {
                    ...init,
                    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
                };
            }
        }

        const res = await originalFetch(input, init);
        if (isApiCall && !isLoginCall && res.status === 401) {
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

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
    }, []);

    useEffect(() => {
        installAuthFetch(logout);
    }, [logout]);

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

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
