import { supabaseAdmin } from '../lib/supabase.js';

const VALID_ENTITY_TYPES = ['employee', 'intern', 'candidate', 'user'];

// Backs the History page: every create/update/archive/restore across
// Employees, Interns, Recruitment Candidates, and User Accounts, newest
// first. Filterable by entity type and paginated with a simple offset --
// this table only ever grows, so a full-scan "give me everything" endpoint
// would get slow and heavy over time.
const listAuditLog = async (req, res) => {
    try {
        const { entityType, action, limit, offset } = req.query;

        const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

        let query = supabaseAdmin
            .from('audit_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(pageOffset, pageOffset + pageSize - 1);

        if (entityType && VALID_ENTITY_TYPES.includes(entityType)) {
            query = query.eq('entity_type', entityType);
        }
        if (action && ['create', 'update', 'archive', 'restore'].includes(action)) {
            query = query.eq('action', action);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({ entries: data, total: count, limit: pageSize, offset: pageOffset });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { listAuditLog };
