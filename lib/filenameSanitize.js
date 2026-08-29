// req.file.originalname is fully attacker-controlled (it's just a form
// field the uploader's client sets) and, in fileShareController.js,
// flows unescaped into: (1) the outgoing email's HTML body via
// mailer.js's attachmentFilename interpolation, (2) the file_shares.file_name
// column, which the History/Recently-Sent page later renders. It is
// never used as a filesystem path, so this isn't a traversal risk -- but
// an attacker-chosen string like `<img src=x onerror=alert(1)>.pdf`
// reaching an HTML-rendering context unescaped is a plausible stored-XSS
// attempt. Strip it down to a conservative, safe character set before it
// touches either destination.
export function sanitizeFilename(name) {
    const base = String(name ?? '').trim();
    // Keep letters, numbers, spaces, dots, hyphens, underscores, and
    // parentheses (covers the vast majority of real-world filenames like
    // "Q3 Report (Final).pdf") -- replace everything else, including
    // angle brackets, quotes, slashes, and other HTML/path-special
    // characters, with an underscore.
    const cleaned = base.replace(/[^\w.\- ()]/g, '_').slice(0, 200);
    return cleaned || 'file';
}
