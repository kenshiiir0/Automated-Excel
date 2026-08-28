import { supabaseAdmin } from './supabase.js';

// Fields never recorded in the audit log even though they were changed --
// this mirrors employeeController.js's own SENSITIVE_FIELDS list. The log
// still records THAT one of these fields changed, just not the actual old/
// new values, so History stays useful without leaking salary or a
// government ID number into a page more people can see than the record
// itself. (Passwords are handled separately below -- password_hash is
// never in any entity's editable field list to begin with, but is called
// out explicitly in case that ever changes.)
const REDACTED_FIELDS = new Set([
    'salary', 'sss_number', 'philhealth_number', 'hdmf_number', 'tin_number',
    'bank_name', 'bank_account', 'password_hash', 'password',
]);

function redactValue(field, value) {
    if (!REDACTED_FIELDS.has(field)) return value;
    if (value === null || value === undefined || value === '') return value;
    return '••• (redacted)';
}

// Compares two field maps and returns only the fields that actually
// changed, in the { field, old_value, new_value } shape the audit_log
// table's `changes` column expects. Fields not present in `after` are
// ignored (a partial update shouldn't look like every other field was
// cleared) -- this matches how updateEmployee/updateIntern/etc. already
// only apply the fields actually sent in the request body.
function diffFields(before, after) {
    const changes = [];
    for (const key of Object.keys(after)) {
        const oldVal = before ? before[key] : undefined;
        const newVal = after[key];
        // Treat '' and null as equivalent (both "empty") so clearing a
        // field via '' doesn't get logged as a change from null -- '' every
        // time a form round-trips a field it didn't actually touch.
        const oldNorm = oldVal === '' ? null : oldVal;
        const newNorm = newVal === '' ? null : newVal;
        if (oldNorm === newNorm) continue;
        if (oldNorm === undefined && newNorm === undefined) continue;
        changes.push({
            field: key,
            old_value: redactValue(key, oldVal ?? null),
            new_value: redactValue(key, newVal ?? null),
        });
    }
    return changes;
}

// Writes one row to audit_log. Never throws -- a logging failure should
// never block or roll back the actual create/update/archive it's
// describing; it's reported to the console instead so it's visible in
// Vercel logs without breaking the user-facing request.
async function writeAuditEntry({ entityType, entityId, entityLabel, action, changes, actorId, actorName }) {
    try {
        const { error } = await supabaseAdmin.from('audit_log').insert([{
            entity_type: entityType,
            entity_id: entityId,
            entity_label: entityLabel || null,
            action,
            changes: changes && changes.length ? changes : null,
            performed_by: actorId || null,
            performed_by_name: actorName || null,
        }]);
        if (error) console.error('audit_log insert failed:', error.message);
    } catch (err) {
        console.error('audit_log insert threw:', err.message);
    }
}

// req.user only carries { id, username, role } from the JWT -- no
// full_name -- so this does one lookup to get a real display name for the
// log entry rather than showing a bare username everywhere in History.
async function getActorName(userId) {
    if (!userId) return null;
    try {
        const { data } = await supabaseAdmin
            .from('users')
            .select('full_name, username')
            .eq('id', userId)
            .maybeSingle();
        return data?.full_name || data?.username || null;
    } catch {
        return null;
    }
}

async function logCreate({ entityType, entityId, entityLabel, req }) {
    const actorName = await getActorName(req.user?.id);
    await writeAuditEntry({ entityType, entityId, entityLabel, action: 'create', changes: null, actorId: req.user?.id, actorName });
}

async function logUpdate({ entityType, entityId, entityLabel, before, after, req }) {
    const changes = diffFields(before || {}, after || {});
    if (changes.length === 0) return; // nothing actually changed -- don't log a no-op
    const actorName = await getActorName(req.user?.id);
    await writeAuditEntry({ entityType, entityId, entityLabel, action: 'update', changes, actorId: req.user?.id, actorName });
}

async function logArchive({ entityType, entityId, entityLabel, req }) {
    const actorName = await getActorName(req.user?.id);
    await writeAuditEntry({ entityType, entityId, entityLabel, action: 'archive', changes: null, actorId: req.user?.id, actorName });
}

async function logRestore({ entityType, entityId, entityLabel, req }) {
    const actorName = await getActorName(req.user?.id);
    await writeAuditEntry({ entityType, entityId, entityLabel, action: 'restore', changes: null, actorId: req.user?.id, actorName });
}

export { logCreate, logUpdate, logArchive, logRestore };
