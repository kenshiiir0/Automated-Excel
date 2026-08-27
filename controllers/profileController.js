import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabase.js';

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
        res.json({ user });
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
        res.json({ user });
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
