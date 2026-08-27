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
