import { Resend } from 'resend';

let client = null;

function getClient() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not set in the environment.');
    }
    if (!client) client = new Resend(process.env.RESEND_API_KEY);
    return client;
}

// Sender address: Resend's shared onboarding@resend.dev works without any
// domain setup, so OTP emails work immediately. Once a real domain (e.g.
// getmeds.ph) is verified in the Resend dashboard, change this to something
// like "GetMeds HR <noreply@getmeds.ph>" -- nothing else needs to change.
const FROM_ADDRESS = 'GetMeds HR <onboarding@resend.dev>';

// Sent once, when a super_admin creates an account directly from Manage
// Users (as opposed to someone self-signing-up). Carries the temporary
// password in plain text since there's no OTP round-trip here -- the
// person is expected to log in and can change their password from their
// Profile page afterward.
export async function sendWelcomeEmail(toEmail, fullName, tempPassword) {
    const resend = getClient();
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: toEmail,
        subject: 'Your GetMeds HR account has been created',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto;">
                <h2 style="color:#0F5777;">GetMeds HR</h2>
                <p>Hi ${fullName}, an account has been created for you on GetMeds HR.</p>
                <p>Sign in with the details below, then update your profile and password whenever you like:</p>
                <table style="margin: 20px 0; font-size: 14px;">
                    <tr><td style="color:#718096; padding-right: 12px;">Username</td><td style="font-weight:700;">${toEmail}</td></tr>
                    <tr><td style="color:#718096; padding-right: 12px;">Temporary password</td><td style="font-weight:700; letter-spacing: 1px;">${tempPassword}</td></tr>
                </table>
                <p style="color:#718096; font-size: 13px;">
                    For security, we recommend changing this password after you log in.
                </p>
            </div>
        `,
    });
    if (error) {
        throw new Error(error.message || 'Failed to send welcome email.');
    }
}

export async function sendOtpEmail(toEmail, otpCode) {
    const resend = getClient();
    const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: toEmail,
        subject: `${otpCode} is your GetMeds HR verification code`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto;">
                <h2 style="color:#0F5777;">GetMeds HR</h2>
                <p>Use this code to verify your email and finish creating your account:</p>
                <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1D9FDA; margin: 20px 0;">
                    ${otpCode}
                </div>
                <p style="color:#718096; font-size: 13px;">
                    This code expires in 10 minutes. If you didn't request this, you can ignore this email.
                </p>
            </div>
        `,
    });
    if (error) {
        throw new Error(error.message || 'Failed to send verification email.');
    }
}
