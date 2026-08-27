// Email domains allowed to self-signup for an admin account.
//
// To allow another company domain later, just add it to this array --
// nothing else needs to change. Comparison is case-insensitive and only
// checks what comes after the "@".
export const ALLOWED_SIGNUP_DOMAINS = [
    'getmeds.ph',
    '2mginc.com',
];

export function isAllowedSignupEmail(email) {
    if (!email || typeof email !== 'string' || !email.includes('@')) return false;
    const domain = email.split('@').pop().trim().toLowerCase();
    return ALLOWED_SIGNUP_DOMAINS.includes(domain);
}
