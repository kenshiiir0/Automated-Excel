import { supabaseAdmin } from '../lib/supabase.js';

const VALID_ROLES = ['super_admin', 'admin', 'user'];

// Account list for the "Manage Users" page. admin and super_admin can both
// view it; only super_admin gets edit rights (enforced by requireRole on
// the PATCH route, not here) -- this is why the list endpoint itself only
// needs requireWriteAccess (admin+), one tier looser than the edit route.
const listUsers = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, username, email, full_name, role, is_active, email_verified, created_at, last_login_at')
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Updates role and/or is_active on another account. super_admin only
// (enforced by requireRole on the route). A super_admin can't demote or
// deactivate their OWN account through this endpoint -- that's the one
// guard against locking every super_admin out at once; if there's ever
// more than one super_admin, they can still act on each other.
const updateUser = async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        const { role, is_active } = req.body;

        if (targetId === req.user.id) {
            return res.status(400).json({ error: 'You cannot change your own role or status here.' });
        }

        const updates = {};
        if (role !== undefined) {
            if (!VALID_ROLES.includes(role)) {
                return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}.` });
            }
            updates.role = role;
        }
        if (is_active !== undefined) {
            updates.is_active = !!is_active;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Nothing to update.' });
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .update(updates)
            .eq('id', targetId)
            .select('id, username, email, full_name, role, is_active, email_verified, created_at, last_login_at')
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Account not found.' });
        res.json({ user: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { listUsers, updateUser };
