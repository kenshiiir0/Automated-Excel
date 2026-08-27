import { supabaseAdmin } from '../lib/supabase.js';
import { MEMO_TYPES, getMemoTypeConfig, renderMemoDocx, TODAY_LONG } from '../lib/disciplinaryMemos.js';
import { sendDisciplinaryMemoEmail } from '../lib/resend.js';
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
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
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

// GET /api/disciplinary-memos/types -- the memo type list + labels, so
// the frontend doesn't hardcode them separately from the backend.
const listMemoTypes = (req, res) => {
    const types = Object.entries(MEMO_TYPES).map(([key, cfg]) => ({ key, label: cfg.label }));
    res.json({ types });
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
            incident_date: incidentDate || '',
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
        res.status(500).json({ error: err.message || 'Could not generate the memo preview.' });
    }
};

// POST /api/disciplinary-memos/send -- regenerates the same document
// (never trusts a client-supplied file), emails it to the employee's
// address on file, and records it in disciplinary_memos. Blocked with a
// clear error if the employee has no email on file, per the "block and
// tell HR to fix the data first" decision.
const sendMemo = async (req, res) => {
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

        const toEmail = pickEmployeeEmail(emp);
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
            incident_date: incidentDate || '',
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
                status: 'sent',
                sent_at: new Date().toISOString(),
                sent_by: req.user.id,
                sent_to_email: toEmail,
                created_by: req.user.id,
            })
            .select()
            .single();
        if (insertError) throw insertError;

        res.json({ sent: true, toEmail, memo: record });
    } catch (err) {
        console.error('Memo send failed:', err);
        res.status(500).json({ error: err.message || 'Could not send the memo.' });
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
        res.status(500).json({ error: err.message });
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
        console.error('AI narrative drafting failed:', err);
        res.status(500).json({ error: 'Could not draft the narrative. You can type it directly instead.' });
    }
};

export { listMemoTypes, previewMemo, sendMemo, listMemos, draftNarrative };
