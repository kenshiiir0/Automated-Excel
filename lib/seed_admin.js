// One-time setup script: creates the first admin account.
// Run this ONCE from the project root: node lib/seed_admin.js
//
// Usage:  node lib/seed_admin.js <username> <password> ["Full Name"]
// Example: node lib/seed_admin.js javed "a-strong-password-here" "Javed"
//
// The password is hashed with bcrypt before it ever touches the database --
// only the hash is stored. Re-running this for a username that already
// exists updates that account's password instead of creating a duplicate,
// so it also doubles as a "reset my password" tool if needed later.
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from './supabase.js';

async function main() {
    const [, , username, password, fullName] = process.argv;

    if (!username || !password) {
        console.error('Usage: node lib/seed_admin.js <username> <password> ["Full Name"]');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Password must be at least 8 characters.');
        process.exit(1);
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { data, error } = await supabaseAdmin
        .from('users')
        .upsert(
            { username, password_hash, full_name: fullName || username, role: 'admin', is_active: true },
            { onConflict: 'username' }
        )
        .select();

    if (error) {
        console.error('Failed to create/update user:', error.message);
        process.exit(1);
    }

    console.log(`User '${username}' is ready (role: admin). You can now log in with this username and the password you just set.`);
}

main();
