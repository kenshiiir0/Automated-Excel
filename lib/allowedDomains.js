// Email domains allowed to self-signup for an admin account.
//
// To allow another company domain later, just add it to this array --
// nothing else needs to change. Comparison is case-insensitive and only
// checks what comes after the "@".
export const ALLOWED_SIGNUP_DOMAINS = [
    'getmeds.ph',
    '2mginc.com',
];

// TEMPORARY as of 2026-08-28, per request: getmeds.ph's DNS/domain access
// wasn't sorted out yet, blocking sign-ups entirely. This flag skips the
// domain check so ANY email address can self-signup while that's being
// resolved -- self-signup still only ever creates a plain 'user' (never
// admin/super_admin) role account, and still requires receiving a real
// OTP code at whatever address is entered, so this isn't a fully open
// door, but it does mean the domain restriction is off.
//
// To restore the original restriction, set this back to false (or
// delete it and the two lines below it in isAllowedSignupEmail).
const DISABLE_DOMAIN_CHECK_TEMPORARY = true;

export function isAllowedSignupEmail(email) {
    if (!email || typeof email !== 'string' || !email.includes('@')) return false;
    if (DISABLE_DOMAIN_CHECK_TEMPORARY) return true;
    const domain = email.split('@').pop().trim().toLowerCase();
    return ALLOWED_SIGNUP_DOMAINS.includes(domain);
}
