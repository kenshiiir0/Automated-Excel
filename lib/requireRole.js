// Gates a route by account role. Must run after requireAuth (needs
// req.user.role, which requireAuth sets from the JWT).
//
// Role tiers, weakest to strongest: 'user' < 'admin' < 'super_admin'.
// 'user' is read-only everywhere -- this middleware is what actually
// enforces that on the server, not just hides buttons in the UI, since a
// hidden button never stopped a direct API call.
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'You do not have permission to do that.' });
        }
        next();
    };
}

// Shorthand for "any account that can create/edit/delete data" -- used on
// every mutating route (POST/PUT/PATCH/DELETE) across employees,
// recruitment, interns, leaves, and email directory.
export const requireWriteAccess = requireRole('admin', 'super_admin');
