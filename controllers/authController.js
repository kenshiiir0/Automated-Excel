import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../lib/supabase.js';

const JWT_EXPIRES_IN = '12h';

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        // Fail loudly rather than silently signing tokens with an empty/weak
        // secret -- that would make every session forgeable.
        throw new Error('JWT_SECRET is not set in the environment.');
    }
    return secret;
}

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // Trim + lowercase before the lookup -- usernames are stored
        // lowercase (they're email addresses), but a leading/trailing
        // space from a copy-paste, or a mobile keyboard auto-capitalizing
        // the first letter, would otherwise fail this exact-match lookup
        // and surface as a plain "invalid username or password" with no
        // indication that the account and password were actually fine.
        const normalizedUsername = username.trim().toLowerCase();

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('username', normalizedUsername)
            .single();

        // Same generic error whether the username doesn't exist or the
        // password is wrong -- so a failed login attempt can't be used to
        // discover which usernames are valid accounts.
        if (error || !user || !user.is_active) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            getJwtSecret(),
            { expiresIn: JWT_EXPIRES_IN }
        );

        await supabaseAdmin
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id);

        res.json({
            token,
            user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lets the frontend confirm an existing token is still valid (e.g. on page
// load) without re-sending the password.
const me = async (req, res) => {
    res.json({ user: req.user });
};

export { login, me };
