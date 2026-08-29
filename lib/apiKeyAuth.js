// Simple API-key gate for endpoints meant to be called by outside systems
// (e.g. a Zoho People Deluge function via a Custom Service Connection),
// as opposed to our own frontend, which talks to the rest of the API
// un-gated for now. Checks a single shared secret passed as a query
// string parameter -- matching the "Query String" / "api_key" parameter
// setup chosen on the Zoho Connections side.
//
// This does NOT replace real user authentication (still a separate,
// open item for the rest of the app) -- it only protects the handful of
// integration endpoints under /api/zoho, so an external system has to
// prove it holds the shared key before it can read anything.
import { safeEqual } from './safeCompare.js';

export function requireApiKey(req, res, next) {
    const provided = req.query.api_key || req.headers['x-api-key'];
    const expected = process.env.ZOHO_INTEGRATION_API_KEY;

    if (!expected) {
        // Fail closed: if no key was ever configured on the server, treat
        // the endpoint as not set up rather than silently open.
        return res.status(503).json({ error: 'Integration endpoint not configured.' });
    }
    if (!provided || !safeEqual(provided, expected)) {
        return res.status(401).json({ error: 'Invalid or missing API key.' });
    }
    next();
}
