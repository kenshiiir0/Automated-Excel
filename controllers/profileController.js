import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabase.js';

// Work-info fields shown on the self-service profile page. Deliberately
// excludes salary, SSS/PhilHealth/HDMF/TIN, and bank account -- those stay
// admin-only in the Employees section, not surfaced on someone's own
// profile even though it's their own data, per the same "keep sensitive
// stuff out of casual view" posture used elsewhere in the app.
const EMPLOYEE_WORK_FIELDS =
    'emp_id, first_name, last_name, department, position, position_category, ' +
    'employment_status, employment_classification, work_arrangement, territory, ' +
    'reporting_to, hire_date, phone';

// Login accounts aren't formally linked to an employee row (no emp_id on
// `users`), so the match is by email: a user's login email is matched
// against either employees.email or employees.zoho_email, since both hold
// the same company address for Zoho-based accounts (confirmed against
// existing data). No match just means the account isn't tied to a listed
// employee yet (e.g. a newly created login) -- profile still works, this
// section is simply omitted.
async function findEmployeeByEmail(email) {
    if (!email) return null;
    const { data, error } = await supabaseAdmin
        .from('employees')
        .select(EMPLOYEE_WORK_FIELDS)
        .or(`email.eq.${email},zoho_email.eq.${email}`)
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error('findEmployeeByEmail error:', error.message);
        return null;
    }
    return data || null;
}

// req.user only carries what was in the JWT (id, username, role) -- this
// fetches the full row so the profile page has email, full_name,
// created_at, last_login_at without needing a second endpoint.
const getProfile = async (req, res) => {
    try {
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, username, email, full_name, role, created_at, last_login_at')
            .eq('id', req.user.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        const employee = await findEmployeeByEmail(user.email);
        res.json({ user, employee });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { fullName } = req.body;
        if (!fullName || !fullName.trim()) {
            return res.status(400).json({ error: 'Full name is required.' });
        }

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .update({ full_name: fullName.trim() })
            .eq('id', req.user.id)
            .select('id, username, email, full_name, role, created_at, last_login_at')
            .single();

        if (error) throw error;

        const employee = await findEmployeeByEmail(user.email);
        res.json({ user, employee });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters.' });
        }

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, password_hash')
            .eq('id', req.user.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        const matches = await bcrypt.compare(currentPassword, user.password_hash);
        if (!matches) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ password_hash: newHash })
            .eq('id', req.user.id);

        if (updateError) throw updateError;
        res.json({ message: 'Password updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { getProfile, updateProfile, changePassword };
