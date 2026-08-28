import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabase.js';
import { sendWelcomeEmail } from '../lib/resend.js';
import { isAllowedSignupEmail, ALLOWED_SIGNUP_DOMAINS } from '../lib/allowedDomains.js';
import { logCreate, logUpdate, logArchive, logRestore } from '../lib/auditLog.js';

const VALID_ROLES = ['super_admin', 'admin', 'user'];
const USER_SELECT_FIELDS = 'id, username, email, full_name, role, is_active, is_archived, archived_at, email_verified, created_at, last_login_at, last_seen_at';

function userLabel(u) {
    if (!u) return null;
    return u.full_name || u.username || u.email || null;
}

// Account list for the "Manage Users" page. admin and super_admin can both
// view it; only super_admin gets edit rights (enforced by requireRole on
// the PATCH route, not here) -- this is why the list endpoint itself only
// needs requireWriteAccess (admin+), one tier looser than the edit route.
// Archived accounts are hidden from the default list -- pass
// ?includeArchived=1 to see only archived ones (used by History/the
// "Archived Accounts" view).
const listUsers = async (req, res) => {
    try {
        const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';

        let query = supabaseAdmin
            .from('users')
            .select(USER_SELECT_FIELDS)
            .order('created_at', { ascending: true });

        query = includeArchived ? query.eq('is_archived', true) : query.eq('is_archived', false);

        const { data, error } = await query;

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

        const { data: before, error: findErr } = await supabaseAdmin
            .from('users')
            .select(USER_SELECT_FIELDS)
            .eq('id', targetId)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!before) return res.status(404).json({ error: 'Account not found.' });

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
            .select(USER_SELECT_FIELDS)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Account not found.' });
        await logUpdate({ entityType: 'user', entityId: data.id, entityLabel: userLabel(data), before, after: updates, req });
        res.json({ user: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


function generateTempPassword() {
    // 12 random chars from an unambiguous alphabet (no 0/O/1/l/I) so it's
    // easy to read off an email and type in, but still hard to guess.
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < 12; i++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}

// Admin-initiated account creation, distinct from self-signup: a
// super_admin picks the email, name, and role right here, we generate a
// temporary password and email it, and the account is active + verified
// immediately -- no OTP round-trip. The new person fills in the rest of
// their own details (phone, password change) later via their own Profile
// page, rather than the admin having to know that info up front.
const createUser = async (req, res) => {
    try {
        const { email, fullName, role } = req.body;
        if (!email || !fullName) {
            return res.status(400).json({ error: 'Email and full name are required.' });
        }
        if (!isAllowedSignupEmail(email)) {
            return res.status(403).json({
                error: `Accounts are limited to ${ALLOWED_SIGNUP_DOMAINS.map(d => '@' + d).join(' and ')} email addresses.`,
            });
        }
        const chosenRole = role || 'user';
        if (!VALID_ROLES.includes(chosenRole)) {
            return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}.` });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const { data: existing } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        const tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const { data, error } = await supabaseAdmin
            .from('users')
            .insert({
                email: normalizedEmail,
                username: normalizedEmail,
                full_name: fullName.trim(),
                password_hash: passwordHash,
                role: chosenRole,
                is_active: true,
                email_verified: true,
            })
            .select(USER_SELECT_FIELDS)
            .single();

        if (error) throw error;

        await logCreate({ entityType: 'user', entityId: data.id, entityLabel: userLabel(data), req });

        // Best-effort: the account is already created and usable even if
        // the email fails to send, so don't roll anything back -- just
        // tell the admin so they can pass the password along another way.
        let emailSent = true;
        try {
            await sendWelcomeEmail(normalizedEmail, fullName.trim(), tempPassword);
        } catch (emailErr) {
            emailSent = false;
            console.error('sendWelcomeEmail failed:', emailErr.message);
        }

        res.status(201).json({ user: data, tempPassword, emailSent });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// "Delete" button in Manage Users -- archives instead of removing the row.
// The account can no longer log in (is_active is forced false alongside
// is_archived, since authController.js's login check only looks at
// is_active) and disappears from the default account list, but every
// disciplinary memo or Zoho connection it created keeps working and still
// shows this person's real name -- nothing references a deleted row.
// A super_admin cannot archive their own account (same self-protection
// rule as updateUser) or archive an already-archived one.
const archiveUser = async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        if (targetId === req.user.id) {
            return res.status(400).json({ error: 'You cannot archive your own account.' });
        }

        const { data: existing, error: findErr } = await supabaseAdmin
            .from('users')
            .select(USER_SELECT_FIELDS)
            .eq('id', targetId)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) return res.status(404).json({ error: 'Account not found.' });
        if (existing.is_archived) return res.status(400).json({ error: 'This account is already archived.' });

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({ is_archived: true, is_active: false, archived_at: new Date().toISOString(), archived_by: req.user.id })
            .eq('id', targetId)
            .select(USER_SELECT_FIELDS)
            .single();

        if (error) throw error;
        await logArchive({ entityType: 'user', entityId: data.id, entityLabel: userLabel(data), req });
        res.json({ user: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Undo for archiveUser. Restores login access (is_active back to true) --
// an admin can immediately deactivate again afterward if that wasn't
// intended, same as any other account.
const restoreUser = async (req, res) => {
    try {
        const targetId = Number(req.params.id);

        const { data: existing, error: findErr } = await supabaseAdmin
            .from('users')
            .select(USER_SELECT_FIELDS)
            .eq('id', targetId)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) return res.status(404).json({ error: 'Account not found.' });
        if (!existing.is_archived) return res.status(400).json({ error: 'This account is not archived.' });

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({ is_archived: false, is_active: true, archived_at: null, archived_by: null })
            .eq('id', targetId)
            .select(USER_SELECT_FIELDS)
            .single();

        if (error) throw error;
        await logRestore({ entityType: 'user', entityId: data.id, entityLabel: userLabel(data), req });
        res.json({ user: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { listUsers, updateUser, createUser, archiveUser, restoreUser };
