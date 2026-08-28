import { supabaseAdmin } from '../lib/supabase.js';
import { sendFileEmail } from '../lib/mailer.js';

// Only common document/image types are accepted -- this is the same
// allowlist enforced by the multer fileFilter in routes/fileShare.js,
// duplicated here so a direct check is possible if this file is ever
// used outside that upload path. Executables, scripts, and other
// potentially unsafe file types are deliberately never accepted: this
// tool emails whatever is uploaded straight to an employee's inbox, so
// accepting arbitrary file types would make it a way to deliver
// malicious attachments, and most email providers silently strip or
// reject risky attachment types anyway.
export const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
]);

// 20MB -- comfortably under Zoho/Gmail's own attachment limits (both cap
// around 25MB per message once base64-encoding overhead is factored in),
// so an oversized file is rejected here immediately with a clear reason
// rather than failing later at the SMTP provider after a slow upload.
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function pickEmployeeEmail(emp) {
    return emp.personal_email || emp.email || emp.zoho_email || null;
}

// Same trust model as disciplinary memos' resolveRequestedEmail: only
// accept a client-supplied destination email if it exactly matches one
// of this employee's own on-file addresses. Blocks a modified request
// from redirecting a file to an address that isn't actually theirs.
function resolveRequestedEmail(emp, requestedEmail) {
    if (!requestedEmail) return pickEmployeeEmail(emp);
    const onFile = [emp.personal_email, emp.email, emp.zoho_email].filter(Boolean);
    return onFile.includes(requestedEmail) ? requestedEmail : pickEmployeeEmail(emp);
}

async function getSendingUserName(userId) {
    const { data } = await supabaseAdmin
        .from('users')
        .select('full_name, username')
        .eq('id', userId)
        .single();
    return data ? (data.full_name || data.username) : null;
}

// POST /api/file-share/send -- multipart form data (multer parses the
// file into req.file; other fields land in req.body as strings). Emails
// the uploaded file to the chosen employee's address on file and logs
// the send in file_shares. The file itself is never written to disk or
// to Supabase Storage -- multer's memory storage keeps it in a Buffer
// for exactly as long as this request is in flight, then it's gone,
// matching the same "don't retain the binary, just log the send"
// approach used for disciplinary memos.
export const sendFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file was uploaded.' });
        }
        const { employeeId, toEmail: requestedEmail, note } = req.body;
        if (!employeeId) {
            return res.status(400).json({ error: 'Choose an employee to send this file to.' });
        }

        const { data: emp, error } = await supabaseAdmin
            .from('employees')
            .select('id, first_name, last_name, personal_email, email, zoho_email')
            .eq('id', employeeId)
            .eq('is_archived', false)
            .single();
        if (error || !emp) return res.status(404).json({ error: 'Employee not found.' });

        const toEmail = resolveRequestedEmail(emp, requestedEmail);
        if (!toEmail) {
            return res.status(409).json({ error: 'No email on file for this employee. Add one in Employee Details before sending.' });
        }

        const employeeName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee';
        const senderName = await getSendingUserName(req.user.id);

        await sendFileEmail({
            toEmail,
            employeeName,
            senderName,
            note: (note || '').trim(),
            attachmentBuffer: req.file.buffer,
            attachmentFilename: req.file.originalname,
        });

        const { data: record, error: insertError } = await supabaseAdmin
            .from('file_shares')
            .insert({
                employee_id: employeeId,
                file_name: req.file.originalname,
                file_size_bytes: req.file.size,
                file_mime_type: req.file.mimetype,
                sent_to_email: toEmail,
                status: 'sent',
                sent_at: new Date().toISOString(),
                sent_by: req.user.id,
            })
            .select('*, employees(first_name, last_name)')
            .single();
        if (insertError) throw insertError;

        res.json({ sent: true, toEmail, share: record });
    } catch (err) {
        console.error('File share send failed:', err);
        res.status(500).json({ error: err.message || 'Could not send the file.' });
    }
};

// GET /api/file-share -- send history, newest first (matches
// listMemos' shape/pattern for the Recently Sent table).
export const listFileShares = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('file_shares')
            .select('*, employees(first_name, last_name)')
            .order('sent_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
