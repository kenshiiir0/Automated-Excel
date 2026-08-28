// lib/mailer.js
//
// Provider-swappable email sending. This module exists so the app can send
// disciplinary memo / welcome / OTP emails through Zoho Mail SMTP and/or
// Gmail SMTP right now, while keeping the door open to switch back to
// Resend later once getmeds.ph's domain verification in Resend is fully
// sorted out and stable.
//
// HOW THE SWITCH WORKS (read this before changing EMAIL_PROVIDER):
//   Set EMAIL_PROVIDER in the environment to one of: 'zoho' | 'gmail' | 'resend'.
//   - 'zoho'   (default if unset) -- sends via Zoho Mail SMTP (smtp.zoho.com).
//   - 'gmail'  -- sends via Gmail SMTP (smtp.gmail.com) using an App Password.
//   - 'resend' -- routes every call in this file straight back to lib/resend.js,
//                 i.e. the original Resend integration, untouched and still intact.
//   Nothing else in the codebase needs to change to flip providers -- every
//   controller imports sendWelcomeEmail / sendOtpEmail / sendDisciplinaryMemoEmail
//   from THIS file (not from lib/resend.js directly anymore), and this file
//   is the only place that decides which provider actually sends the message.
//   lib/resend.js itself has NOT been deleted or modified -- it's left fully
//   working so 'resend' remains a one-line env var change away.
//
// REQUIRED ENV VARS PER PROVIDER:
//   Zoho SMTP:  ZOHO_SMTP_USER (full mailbox address, e.g. noreply@getmeds.ph)
//               ZOHO_SMTP_PASSWORD (Zoho Mail App Password, NOT the account login password)
//               ZOHO_SMTP_HOST (optional, defaults to smtp.zoho.com)
//               ZOHO_SMTP_PORT (optional, defaults to 465)
//   Gmail SMTP: GMAIL_SMTP_USER (full Gmail address)
//               GMAIL_SMTP_PASSWORD (Gmail App Password -- requires 2-Step Verification
//                                    enabled on the Google account first)
//   Resend:     RESEND_API_KEY (already in use today -- see lib/resend.js)
//
// Both Zoho and Gmail app-password credentials are 16-character strings
// generated from that provider's own account security settings -- never the
// normal account login password. Neither provider is contacted or validated
// until the first real send is attempted.

import nodemailer from 'nodemailer';
import * as resendMailer from './resend.js';

const PROVIDER = (process.env.EMAIL_PROVIDER || 'zoho').toLowerCase();

// Display name shown in the recipient's inbox. The actual From address is
// forced to match whichever mailbox is authenticating (Zoho/Gmail won't let
// you send "as" an address you haven't proven ownership of), but the
// friendly name stays consistent regardless of provider.
const FROM_DISPLAY_NAME = 'GetMeds HR';

let cachedTransporter = null;
let cachedTransporterProvider = null;

function buildZohoTransporter() {
    if (!process.env.ZOHO_SMTP_USER || !process.env.ZOHO_SMTP_PASSWORD) {
        throw new Error(
            'ZOHO_SMTP_USER / ZOHO_SMTP_PASSWORD are not set in the environment. ' +
            'These must be a real Zoho Mail mailbox address and an App Password ' +
            'generated from Zoho Mail > Settings > Security > App Passwords.'
        );
    }
    return nodemailer.createTransport({
        host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
        port: Number(process.env.ZOHO_SMTP_PORT) || 465,
        secure: true, // 465 = implicit TLS
        auth: {
            user: process.env.ZOHO_SMTP_USER,
            pass: process.env.ZOHO_SMTP_PASSWORD,
        },
    });
}

function buildGmailTransporter() {
    if (!process.env.GMAIL_SMTP_USER || !process.env.GMAIL_SMTP_PASSWORD) {
        throw new Error(
            'GMAIL_SMTP_USER / GMAIL_SMTP_PASSWORD are not set in the environment. ' +
            'These must be a real Gmail address and an App Password generated from ' +
            'Google Account > Security > 2-Step Verification > App Passwords ' +
            '(2-Step Verification must be turned on first).'
        );
    }
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.GMAIL_SMTP_USER,
            pass: process.env.GMAIL_SMTP_PASSWORD,
        },
    });
}

function getTransporter() {
    if (PROVIDER === 'resend') return null; // resend path doesn't use nodemailer at all
    if (cachedTransporter && cachedTransporterProvider === PROVIDER) return cachedTransporter;

    if (PROVIDER === 'gmail') {
        cachedTransporter = buildGmailTransporter();
    } else if (PROVIDER === 'zoho') {
        cachedTransporter = buildZohoTransporter();
    } else {
        throw new Error(
            `Unknown EMAIL_PROVIDER "${PROVIDER}". Expected 'zoho', 'gmail', or 'resend'.`
        );
    }
    cachedTransporterProvider = PROVIDER;
    return cachedTransporter;
}

function fromAddressForCurrentProvider() {
    const mailbox = PROVIDER === 'gmail'
        ? process.env.GMAIL_SMTP_USER
        : process.env.ZOHO_SMTP_USER;
    return `${FROM_DISPLAY_NAME} <${mailbox}>`;
}

async function sendViaSmtp({ to, replyTo, subject, html, attachments }) {
    const transporter = getTransporter();
    try {
        await transporter.sendMail({
            from: fromAddressForCurrentProvider(),
            to,
            replyTo,
            subject,
            html,
            attachments: attachments && attachments.map(a => ({
                filename: a.filename,
                content: a.content, // Buffer -- nodemailer accepts a raw Buffer directly
            })),
        });
    } catch (err) {
        // Surface the real SMTP failure reason (bad credentials, provider
        // rejecting the message, connection refused, etc.) rather than a
        // generic "failed to send" -- matches the app-wide "show why it
        // errors" requirement.
        throw new Error(`${PROVIDER === 'gmail' ? 'Gmail' : 'Zoho'} SMTP send failed: ${err.message || err}`);
    }
}

// ---------------------------------------------------------------------
// Public API -- identical function names/signatures to lib/resend.js so
// every existing controller call site needs zero changes beyond the
// import path.
// ---------------------------------------------------------------------

export async function sendWelcomeEmail(toEmail, fullName, tempPassword) {
    if (PROVIDER === 'resend') return resendMailer.sendWelcomeEmail(toEmail, fullName, tempPassword);

    await sendViaSmtp({
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
}

export async function sendOtpEmail(toEmail, otpCode) {
    if (PROVIDER === 'resend') return resendMailer.sendOtpEmail(toEmail, otpCode);

    await sendViaSmtp({
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
}

export async function sendDisciplinaryMemoEmail({ toEmail, employeeName, memoLabel, replyToEmail, replyToName, attachmentBuffer, attachmentFilename }) {
    if (PROVIDER === 'resend') {
        return resendMailer.sendDisciplinaryMemoEmail({ toEmail, employeeName, memoLabel, replyToEmail, replyToName, attachmentBuffer, attachmentFilename });
    }

    await sendViaSmtp({
        to: toEmail,
        replyTo: replyToName ? `${replyToName} <${replyToEmail}>` : replyToEmail,
        subject: `${memoLabel} -- ${employeeName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color:#0F5777;">GetMeds HR</h2>
                <p>Hi ${employeeName},</p>
                <p>Please see the attached <strong>${memoLabel}</strong> issued by the HR Department. If you have any questions, you can reply directly to this email.</p>
                <p style="color:#718096; font-size: 13px;">
                    This is an official HR communication. Please review the attached document carefully.
                </p>
            </div>
        `,
        attachments: [
            { filename: attachmentFilename, content: attachmentBuffer },
        ],
    });
}

// Sends an arbitrary file (chosen by HR on the Send Files page) to an
// employee's own email address on file, as a plain attachment with a
// short cover note -- no Resend fallback here, since Resend was never
// used for this kind of ad-hoc attachment; this always goes through
// whichever SMTP provider (Zoho or Gmail) is currently configured via
// EMAIL_PROVIDER, same as the other functions above.
export async function sendFileEmail({ toEmail, employeeName, senderName, note, attachmentBuffer, attachmentFilename }) {
    if (PROVIDER === 'resend') {
        throw new Error(
            "File sharing isn't available while EMAIL_PROVIDER is set to 'resend' -- switch it to 'zoho' or 'gmail' to send files."
        );
    }

    await sendViaSmtp({
        to: toEmail,
        subject: `A file has been shared with you -- ${attachmentFilename}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color:#0F5777;">GetMeds HR</h2>
                <p>Hi ${employeeName},</p>
                <p>${senderName ? `${senderName} from` : 'The'} GetMeds HR Department has shared a file with you: <strong>${attachmentFilename}</strong>.${note ? ` ${note}` : ''}</p>
                <p style="color:#718096; font-size: 13px;">
                    This file was sent directly through the GetMeds HR system. If you weren't expecting this, please contact HR.
                </p>
            </div>
        `,
        attachments: [
            { filename: attachmentFilename, content: attachmentBuffer },
        ],
    });
}
