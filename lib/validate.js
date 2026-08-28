// Generic Zod-backed request validator. Wrap any route with
// validate({ body, params, query }) and each provided schema parses and
// REPLACES req.body / req.params / req.query with the validated result --
// so downstream handlers can trust the shape (extra/unknown fields are
// stripped by default in each schema below via .strict() or .strip()
// semantics, and coercions like trimming/lowercasing already happened).
//
// Runs before requireAuth-protected handlers touch req.body at all, so a
// malformed payload never reaches a Supabase call. Kept deliberately
// framework-agnostic (no Express-specific magic) so it's easy to unit test.
function formatZodError(zodError) {
    // Flatten Zod's nested issue list into "field: message" pairs -- easier
    // to read in a toast/alert on the frontend than a raw Zod error tree.
    return zodError.issues.map(issue => {
        const path = issue.path.join('.') || '(root)';
        return `${path}: ${issue.message}`;
    });
}

export function validate({ body, params, query } = {}) {
    return (req, res, next) => {
        try {
            if (body) {
                const result = body.safeParse(req.body);
                if (!result.success) {
                    return res.status(400).json({ error: 'Invalid request body.', details: formatZodError(result.error) });
                }
                req.body = result.data;
            }
            if (params) {
                const result = params.safeParse(req.params);
                if (!result.success) {
                    return res.status(400).json({ error: 'Invalid request parameters.', details: formatZodError(result.error) });
                }
                req.params = result.data;
            }
            if (query) {
                const result = query.safeParse(req.query);
                if (!result.success) {
                    return res.status(400).json({ error: 'Invalid query parameters.', details: formatZodError(result.error) });
                }
                req.query = result.data;
            }
            next();
        } catch (err) {
            res.status(500).json({ error: 'Validation failed unexpectedly: ' + err.message });
        }
    };
}
