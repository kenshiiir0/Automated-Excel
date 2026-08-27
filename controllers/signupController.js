import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabase.js';
import { sendOtpEmail } from '../lib/resend.js';
import { isAllowedSignupEmail, ALLOWED_SIGNUP_DOMAINS } from '../lib/allowedDomains.js';

const OTP_TTL_MINUTES = 10;

function generateOtp() {
    // 6-digit numeric code, zero-padded.
    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

// Step 1: person submits their company email + full name + a password they
// want. We create (or refresh) an inactive, unverified row holding the OTP,
// and email the code. No account is usable until step 2 succeeds.
const requestOtp = async (req, res) => {
    try {
        const { email, fullName, password } = req.body;
        if (!email || !fullName || !password) {
            return res.status(400).json({ error: 'Email, full name, and password are required.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters.' });
        }
        if (!isAllowedSignupEmail(email)) {
            return res.status(403).json({
                error: `Sign-up is limited to ${ALLOWED_SIGNUP_DOMAINS.map(d => '@' + d).join(' and ')} email addresses.`,
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const { data: existing } = await supabaseAdmin
            .from('users')
            .select('id, email_verified')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existing && existing.email_verified) {
            return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
        }

        const otpCode = generateOtp();
        const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
        const passwordHash = await bcrypt.hash(password, 10);

        // Upsert on email: lets someone re-request a code (e.g. it expired)
        // without erroring on a duplicate-email conflict.
        const { error: upsertError } = await supabaseAdmin
            .from('users')
            .upsert(
                {
                    email: normalizedEmail,
                    username: normalizedEmail,
                    full_name: fullName.trim(),
                    password_hash: passwordHash,
                    // Self-signup grants read-only access by default now that
                    // real role tiers exist -- a super_admin promotes an
                    // account to 'admin' afterward via Manage Users, rather
                    // than every new signup getting full write access.
                    role: 'user',
                    is_active: false,
                    email_verified: false,
                    otp_code: otpCode,
                    otp_expires_at: otpExpiresAt,
                },
                { onConflict: 'email' }
            );

        if (upsertError) throw upsertError;

        await sendOtpEmail(normalizedEmail, otpCode);

        res.json({ message: 'Verification code sent. Check your email.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Step 2: person types back the code from their inbox. On match, the
// account is activated and marked verified -- otp fields are cleared so
// the code can't be reused or left lying around in the row.
const verifyOtp = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required.' });
        }
        const normalizedEmail = email.trim().toLowerCase();

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (error || !user) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }
        if (user.email_verified) {
            return res.status(409).json({ error: 'This account is already verified. Try logging in.' });
        }
        if (!user.otp_code || !user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) {
            return res.status(400).json({ error: 'This code has expired. Request a new one.' });
        }
        if (user.otp_code !== code.trim()) {
            return res.status(400).json({ error: 'Incorrect code.' });
        }

        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                is_active: true,
                email_verified: true,
                otp_code: null,
                otp_expires_at: null,
            })
            .eq('id', user.id);

        if (updateError) throw updateError;

        res.json({ message: 'Account verified. You can now log in.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { requestOtp, verifyOtp };
