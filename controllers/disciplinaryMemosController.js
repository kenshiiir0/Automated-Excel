import { supabaseAdmin } from '../lib/supabase.js';
import { MEMO_TYPES, COMPANY_RULES, getMemoTypeConfig, renderMemoDocx, TODAY_LONG } from '../lib/disciplinaryMemos.js';
import { sendDisciplinaryMemoEmail } from '../lib/mailer.js';
import { draftIncidentNarrative } from '../lib/narrativeDrafter.js';

function formatEmployeeName(emp) {
    // "Last, First M." to match the source templates' signature style.
    const last = (emp.last_name || '').trim();
    const first = (emp.first_name || '').trim();
    const middleInitial = (emp.middle_name || '').trim().charAt(0);
    let name = last;
    if (first) name += `, ${first}`;
    if (middleInitial) name += ` ${middleInitial}.`;
    return name || emp.full_name || 'Employee';
}

function formatDateForMemo(dateStr) {
    if (!dateStr) return '';
    try {
        // Parse a plain "YYYY-MM-DD" (from a <input type="date">) as a
        // LOCAL date, not via `new Date(dateStr)` -- that treats a
        // date-only string as UTC midnight, which rolls back to the
        // previous day in any timezone ahead of UTC (e.g. Philippines,
        // UTC+8). Anything else (an ISO timestamp, or already-formatted
        // text from an older record) falls through to the plain
        // new Date() parse below, which is fine for those shapes.
        const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
        const parsed = dateOnlyMatch
            ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
            : new Date(dateStr);
        return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    } catch {
        return dateStr;
    }
}

async function getSendingUserContact(userId) {
    // req.user (from the JWT) only carries { id, username, role } -- no
    // email or full_name -- so Reply-To needs an actual lookup here.
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('email, username, full_name')
        .eq('id', userId)
        .single();
    if (error || !data) return { email: null, name: null };
    return { email: data.email || data.username, name: data.full_name };
}

function pickEmployeeEmail(emp) {
    // Preference order matches what's actually populated in this dataset
    // (personal_email is filled for the large majority of records) --
    // falls back through the others rather than assuming one field.
    return emp.personal_email || emp.email || emp.zoho_email || null;
}

// The Send modal lets HR pick which address on file to use (personal,
// work, or Zoho) instead of always taking pickEmployeeEmail's default.
// Never trust a client-supplied email outright for something this
// sensitive -- only accept it if it exactly matches one of the
// employee's own on-file addresses, otherwise fall back to the default
// pick. This blocks a modified request from redirecting a memo to an
// arbitrary address that isn't actually this employee's.
function resolveRequestedEmail(emp, requestedEmail) {
    if (!requestedEmail) return pickEmployeeEmail(emp);
    const onFile = [emp.personal_email, emp.email, emp.zoho_email].filter(Boolean);
    return onFile.includes(requestedEmail) ? requestedEmail : pickEmployeeEmail(emp);
}

// GET /api/disciplinary-memos/types -- the memo type list + labels, so
// the frontend doesn't hardcode them separately from the backend.
const listMemoTypes = (req, res) => {
    const types = Object.entries(MEMO_TYPES).map(([key, cfg]) => ({ key, label: cfg.label }));
    res.json({ types, rules: COMPANY_RULES });
};

// POST /api/disciplinary-memos/preview -- generates the .docx in memory
// and returns it directly as a downloadable/previewable file, WITHOUT
// saving anything to the database yet. This is the "HR reviews before
// anything is final" step -- nothing is recorded as issued until Send.
const previewMemo = async (req, res) => {
    try {
        const { employeeId, memoType, ruleText, incidentDate, incidentTime, incidentNarrative, memoDate, priorWarningNote } = req.body;

        if (!employeeId || !memoType || !ruleText || !incidentNarrative) {
            return res.status(400).json({ error: 'Employee, memo type, rule, and incident narrative are required.' });
        }

        const { data: emp, error } = await supabaseAdmin
            .from('employees')
            .select('id, first_name, last_name, middle_name, position, department, hire_date, personal_email, email, zoho_email')
            .eq('id', employeeId)
            .single();
        if (error || !emp) return res.status(404).json({ error: 'Employee not found.' });

        const fields = {
            employee_name: formatEmployeeName(emp),
            date_hired: formatDateForMemo(emp.hire_date),
            position: emp.position || '',
            department: emp.department || '',
            company: '2MG Incorporated',
            memo_date: memoDate || TODAY_LONG(),
            rule_text: ruleText,
            incident_date: formatDateForMemo(incidentDate) || '',
            incident_time: incidentTime || 'Working hours',
            incident_narrative: incidentNarrative,
        };
        if (memoType === 'FINAL_WRITTEN_WARNING') {
            fields.prior_warning_note = priorWarningNote || '';
        }

        const buffer = renderMemoDocx(memoType, fields);
        const config = getMemoTypeConfig(memoType);
        const filename = `${config.label.replace(/\s+/g, '_')}_${formatEmployeeName(emp).replace(/[,\s]+/g, '_')}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        console.error('Memo preview failed:', err);
        res.status(500).json({ error: 'Could not generate the memo preview.' });
    }
};

// POST /api/disciplinary-memos/send -- regenerates the same document
// (never trusts a client-supplied file), emails it to the employee's
// address on file, and records it in disciplinary_memos. Blocked with a
// clear error if the employee has no email on file, per the "block and
// tell HR to fix the data first" decision.
const sendMemo = async (req, res) => {
    try {
        const { employeeId, memoType, ruleText, incidentDate, incidentTime, incidentNarrative, memoDate, priorWarningNote, toEmail: requestedEmail } = req.body;

        if (!employeeId || !memoType || !ruleText || !incidentNarrative) {
            return res.status(400).json({ error: 'Employee, memo type, rule, and incident narrative are required.' });
        }

        const { data: emp, error } = await supabaseAdmin
            .from('employees')
            .select('id, first_name, last_name, middle_name, position, department, hire_date, personal_email, email, zoho_email')
            .eq('id', employeeId)
            .single();
        if (error || !emp) return res.status(404).json({ error: 'Employee not found.' });

        const toEmail = resolveRequestedEmail(emp, requestedEmail);
        if (!toEmail) {
            return res.status(409).json({ error: 'No email on file for this employee. Add one in Employee Details before sending.' });
        }

        const employeeName = formatEmployeeName(emp);
        const resolvedMemoDate = memoDate || TODAY_LONG();
        const fields = {
            employee_name: employeeName,
            date_hired: formatDateForMemo(emp.hire_date),
            position: emp.position || '',
            department: emp.department || '',
            company: '2MG Incorporated',
            memo_date: resolvedMemoDate,
            rule_text: ruleText,
            incident_date: formatDateForMemo(incidentDate) || '',
            incident_time: incidentTime || 'Working hours',
            incident_narrative: incidentNarrative,
        };
        if (memoType === 'FINAL_WRITTEN_WARNING') {
            fields.prior_warning_note = priorWarningNote || '';
        }

        const buffer = renderMemoDocx(memoType, fields);
        const config = getMemoTypeConfig(memoType);
        const filename = `${config.label.replace(/\s+/g, '_')}_${employeeName.replace(/[,\s]+/g, '_')}.docx`;

        const sendingUser = await getSendingUserContact(req.user.id);
        if (!sendingUser.email) {
            return res.status(409).json({ error: 'Your account has no email on file. Add one in your Profile before sending memos.' });
        }

        await sendDisciplinaryMemoEmail({
            toEmail,
            employeeName,
            memoLabel: config.label,
            replyToEmail: sendingUser.email,
            replyToName: sendingUser.name,
            attachmentBuffer: buffer,
            attachmentFilename: filename,
        });

        const { data: record, error: insertError } = await supabaseAdmin
            .from('disciplinary_memos')
            .insert({
                employee_id: employeeId,
                memo_type: memoType,
                rule_text: ruleText,
                incident_date: incidentDate || null,
                incident_time: incidentTime || null,
                incident_narrative: incidentNarrative,
                memo_date: resolvedMemoDate,
                prior_warning_note: memoType === 'FINAL_WRITTEN_WARNING' ? (priorWarningNote || null) : null,
                status: 'sent',
                sent_at: new Date().toISOString(),
                sent_by: req.user.id,
                sent_to_email: toEmail,
                created_by: req.user.id,
            })
            // Same relational select as listMemos() -- without this, the
            // row returned here has no nested `employees` object, so the
            // Recently Issued table (which reads m.employees.first_name/
            // last_name) fell back to showing '--' for the just-sent memo
            // until the next full page load re-fetched it with the join.
            .select('*, employees(first_name, last_name, middle_name)')
            .single();
        if (insertError) throw insertError;

        res.json({ sent: true, toEmail, memo: record });
    } catch (err) {
        console.error('Memo send failed:', err);
        res.status(500).json({ error: 'Could not send the memo.' });
    }
};

// GET /api/disciplinary-memos?employeeId=... -- issued-memo history,
// optionally filtered to one employee (used both for a per-employee
// compliance view and to auto-suggest prior-warning context when
// building a Final Written Warning).
const listMemos = async (req, res) => {
    try {
        let query = supabaseAdmin
            .from('disciplinary_memos')
            .select('*, employees(first_name, last_name, middle_name)')
            .order('created_at', { ascending: false });
        if (req.query.employeeId) {
            query = query.eq('employee_id', req.query.employeeId);
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('controllers/disciplinaryMemosController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// POST /api/disciplinary-memos/draft-narrative -- takes short bullet
// facts HR typed and returns an AI-expanded paragraph. Only the memo
// type, rule text, and the bullet facts themselves are sent to the AI
// provider -- never the employee's name or any other record data --
// since this step doesn't need them to produce a good draft, and
// keeping the request minimal limits what reaches a third party.
const draftNarrative = async (req, res) => {
    try {
        const { memoType, ruleText, bulletFacts } = req.body;
        if (!memoType || !ruleText || !bulletFacts || !bulletFacts.trim()) {
            return res.status(400).json({ error: 'Memo type, rule, and bullet facts are required.' });
        }
        const narrative = await draftIncidentNarrative({ memoType, ruleText, bulletFacts: bulletFacts.trim() });
        res.json({ narrative });
    } catch (err) {
        if (err.code === 'AI_NOT_CONFIGURED') {
            return res.status(503).json({ error: err.message });
        }
        if (err.code === 'AI_QUOTA_EXCEEDED') {
            // Expected, not broken: the free-tier Gemini key has a small
            // daily request cap, and this is what it looks like once
            // that's used up for the day. 429 (not 500) since this is
            // the caller having made too many requests, not a server
            // fault -- and narrativeDrafter.js has already replaced
            // Google's raw quota-error JSON with a short, human message.
            return res.status(429).json({ error: err.message });
        }
        console.error('AI narrative drafting failed:', err);
        // Surfaces the real underlying reason (which Gemini candidate
        // failed and why -- bad/missing key, retired model, etc.) instead
        // of a generic message, matching the app-wide "show why it
        // errors" requirement. This is an internal HR tool used only by
        // trusted staff, not a public-facing app, so exposing the real
        // error text here is a deliberate, safe tradeoff.
        res.status(500).json({
            error: `Could not draft the narrative: ${err.message || 'unknown error'}. You can type it directly instead.`,
        });
    }
};


// GET /api/disciplinary-memos/:id/download -- regenerates the exact
// .docx for an already-issued memo from its stored fields (never stored
// as a binary blob -- the row's fields are the source of truth, same as
// previewMemo/sendMemo build the document fresh every time). Lets
// "Recently Issued" offer a real Download action, not just a record of
// who/when/where it was sent.
const downloadMemo = async (req, res) => {
    try {
        const { data: memo, error } = await supabaseAdmin
            .from('disciplinary_memos')
            .select('*')
            .eq('id', req.params.id)
            .single();
        if (error || !memo) return res.status(404).json({ error: 'Memo not found.' });

        const { data: emp, error: empError } = await supabaseAdmin
            .from('employees')
            .select('id, first_name, last_name, middle_name, position, department, hire_date')
            .eq('id', memo.employee_id)
            .maybeSingle();
        if (empError) throw empError;

        const employeeName = emp ? formatEmployeeName(emp) : 'Employee';
        const fields = {
            employee_name: employeeName,
            date_hired: emp ? formatDateForMemo(emp.hire_date) : '',
            position: emp?.position || '',
            department: emp?.department || '',
            company: '2MG Incorporated',
            memo_date: memo.memo_date || TODAY_LONG(),
            rule_text: memo.rule_text,
            incident_date: formatDateForMemo(memo.incident_date) || '',
            incident_time: memo.incident_time || 'Working hours',
            incident_narrative: memo.incident_narrative,
        };
        if (memo.memo_type === 'FINAL_WRITTEN_WARNING') {
            fields.prior_warning_note = memo.prior_warning_note || '';
        }

        const buffer = renderMemoDocx(memo.memo_type, fields);
        const config = getMemoTypeConfig(memo.memo_type);
        const filename = `${config.label.replace(/\s+/g, '_')}_${employeeName.replace(/[,\s]+/g, '_')}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        console.error('Memo download failed:', err);
        res.status(500).json({ error: 'Could not generate this memo for download.' });
    }
};

export { listMemoTypes, previewMemo, sendMemo, listMemos, draftNarrative, downloadMemo };
