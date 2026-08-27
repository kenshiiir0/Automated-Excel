import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

// How long an /api/ request has to take before we consider the
// connection "slow" rather than just momentarily busy. Chosen to sit
// well above a normal Supabase round-trip on a decent connection, so
// this doesn't fire on ordinary load spikes.
const SLOW_REQUEST_MS = 4000;

// After a request stops looking slow (or an offline spell ends), keep
// showing the banner a little longer before it disappears -- prevents
// it flickering on/off if the connection is unstable rather than fully
// gone, and gives the person time to actually read it.
const HOLD_AFTER_RECOVER_MS = 2500;

let listeners = new Set();
let state = { offline: false, slow: false };

function setState(patch) {
    state = { ...state, ...patch };
    listeners.forEach(fn => fn(state));
}

// Called from authContext.jsx's fetch patch, once per /api/ request, so
// this banner reacts to real request timing rather than duplicating its
// own network probing. Exported as a plain function (not a hook) since
// it needs to be called from inside the patched window.fetch, which
// runs outside of React.
export function reportApiRequestTiming(durationMs, failed) {
    if (failed || durationMs > SLOW_REQUEST_MS) {
        setState({ slow: true });
        clearTimeout(reportApiRequestTiming._recoverTimer);
    } else {
        clearTimeout(reportApiRequestTiming._recoverTimer);
        reportApiRequestTiming._recoverTimer = setTimeout(() => {
            setState({ slow: false });
        }, HOLD_AFTER_RECOVER_MS);
    }
}

// Small floating banner mounted once at the top of the app (see App.jsx)
// so it shows over whatever page you're on, not tied to any one route.
// Two independent signals feed it: the browser's own online/offline
// events (reliable, instant), and API request timing reported by the
// fetch patch in authContext.jsx (a proxy for "slow", since there's no
// single reliable browser signal for that).
export default function NetworkStatusBanner() {
    const [{ offline, slow }, setLocalState] = useState(state);

    useEffect(() => {
        listeners.add(setLocalState);

        const goOffline = () => setState({ offline: true });
        const goOnline = () => setState({ offline: false, slow: false });
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setState({ offline: true });
        }

        return () => {
            listeners.delete(setLocalState);
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, []);

    if (!offline && !slow) return null;

    return (
        <div className={`network-status-banner ${offline ? 'offline' : 'slow'}`} role="status">
            <Icon name="alertTriangle" size={15} />
            <span>
                {offline
                    ? "No internet connection. Changes won't save until you're back online."
                    : 'Slow connection detected. Some actions may take longer than usual.'}
            </span>
        </div>
    );
}
