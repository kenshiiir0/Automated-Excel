import { supabaseAdmin } from '../lib/supabase.js';
import { logCreate, logUpdate, logArchive, logRestore } from '../lib/auditLog.js';

// Fields hidden from 'user'-role accounts (read-only accounts). Everyone
// else (admin, super_admin) sees the full record -- this only trims the
// response for the lowest tier, same set called out on the profile page's
// own Work Information card (salary, government IDs, bank account).
const SENSITIVE_FIELDS = ['salary', 'sss_number', 'philhealth_number', 'hdmf_number', 'tin_number', 'bank_name', 'bank_account'];

function stripSensitiveFields(record) {
    if (!record) return record;
    const clean = { ...record };
    for (const field of SENSITIVE_FIELDS) delete clean[field];
    return clean;
}

// TEMPORARY as of 2026-08-27, per HR request: sensitive fields (salary,
// SSS/PhilHealth/HDMF/TIN, bank name/account) are hidden from EVERY role
// right now, including admin/super_admin -- not just 'user' as originally
// designed below. This is a deliberate, reversible stop-gap ("we will
// bring it back later"), not a permanent policy change.
//
// To restore the original behavior (strip only for 'user', full visibility
// for admin/super_admin), delete the line below this comment block and
// uncomment the original condition underneath it.
const HIDE_SENSITIVE_FROM_ALL_ROLES_TEMPORARY = true;

function withRoleFilter(req, data) {
    if (HIDE_SENSITIVE_FROM_ALL_ROLES_TEMPORARY) {
        return Array.isArray(data) ? data.map(stripSensitiveFields) : stripSensitiveFields(data);
    }
    // Original rule, to restore later: only 'user' role has these fields stripped.
    // if (req.user?.role !== 'user') return data;
    return Array.isArray(data) ? data.map(stripSensitiveFields) : stripSensitiveFields(data);
}

// Only super_admin may set/change salary, government IDs, or bank details.
// admin keeps full write access to everything else (name, contact info,
// department, position, dates, status, etc.) -- this mirrors the same
// SENSITIVE_FIELDS list used to hide these fields on reads, but one tier
// stricter on writes, since a bad/malicious write to salary or bank_account
// is more damaging than merely being able to view it.
function stripSensitiveFieldsFromWrite(req, body) {
    if (req.user?.role === 'super_admin') return { ...body };
    const clean = { ...body };
    for (const field of SENSITIVE_FIELDS) delete clean[field];
    return clean;
}

function employeeLabel(emp) {
    if (!emp) return null;
    const name = [emp.last_name, emp.first_name].filter(Boolean).join(', ');
    return emp.emp_id ? `${emp.emp_id} — ${name}` : name || null;
}

// Archived employees are hidden from the default list -- pass
// ?includeArchived=1 to see only archived ones (used by the History page).
const getAllEmployees = async (req, res) => {
    try {
        const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';

        let query = supabaseAdmin
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });

        query = includeArchived ? query.eq('is_archived', true) : query.eq('is_archived', false);

        const { data, error } = await query;

        if (error) throw error;
        res.json(withRoleFilter(req, data));
    } catch (err) {
        console.error('controllers/employeeController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

const getEmployeeById = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(withRoleFilter(req, data));
    } catch (err) {
        console.error('controllers/employeeController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

const EMPLOYEE_WRITABLE_FIELDS = [
    'emp_id', 'first_name', 'last_name', 'middle_name',
    'email', 'personal_email', 'zoho_email', 'phone',
    'date_of_birth', 'gender', 'marital_status', 'citizenship', 'complete_address',
    'department', 'position', 'new_designation', 'position_category',
    'employment_status', 'employment_classification', 'employment_contract_status',
    'work_arrangement', 'territory', 'reporting_to',
    'hire_date', 'regularization_date', 'exit_date',
    'job_description', 'company_rules',
    'salary', 'bank_name', 'bank_account',
    'sss_number', 'philhealth_number', 'hdmf_number', 'tin_number',
    'company_issued_no', 'issued_equipment',
    'emergency_contact_person', 'relationship', 'emergency_contact_details',
];

const createEmployee = async (req, res) => {
    try {
        const rawPayload = {};
        for (const key of EMPLOYEE_WRITABLE_FIELDS) {
            if (req.body[key] !== undefined) rawPayload[key] = req.body[key];
        }
        if (!rawPayload.emp_id || !rawPayload.first_name || !rawPayload.last_name) {
            return res.status(400).json({ error: 'Employee ID, first name, and last name are required.' });
        }

        const payload = stripSensitiveFieldsFromWrite(req, rawPayload);

        const { data, error } = await supabaseAdmin
            .from('employees')
            .insert([payload])
            .select();

        if (error) throw error;
        const created = data[0];
        await logCreate({ entityType: 'employee', entityId: created.id, entityLabel: employeeLabel(created), req });
        res.status(201).json(created);
    } catch (err) {
        console.error('controllers/employeeController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

const updateEmployee = async (req, res) => {
    try {
        const { data: before, error: findErr } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!before) return res.status(404).json({ error: 'Employee not found.' });

        const updates = stripSensitiveFieldsFromWrite(req, req.body);

        const { data, error } = await supabaseAdmin
            .from('employees')
            .update(updates)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        const updated = data[0];
        await logUpdate({ entityType: 'employee', entityId: updated.id, entityLabel: employeeLabel(updated), before, after: updates, req });
        res.json(updated);
    } catch (err) {
        console.error('controllers/employeeController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

// "Delete" in the UI archives the employee record instead of removing the
// row -- nothing in this system is ever hard-deleted. Disciplinary memos
// and any other record referencing this employee stay intact and readable.
const deleteEmployee = async (req, res) => {
    try {
        const { data: existing, error: findErr } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) return res.status(404).json({ error: 'Employee not found.' });
        if (existing.is_archived) return res.status(400).json({ error: 'This employee record is already archived.' });

        const { error } = await supabaseAdmin
            .from('employees')
            .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: req.user?.id || null })
            .eq('id', req.params.id);

        if (error) throw error;
        await logArchive({ entityType: 'employee', entityId: Number(req.params.id), entityLabel: employeeLabel(existing), req });
        res.json({ message: 'Employee archived' });
    } catch (err) {
        console.error('controllers/employeeController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

// Undo for deleteEmployee -- brings an archived record back into the
// default Employee Directory view.
const restoreEmployee = async (req, res) => {
    try {
        const { data: existing, error: findErr } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) return res.status(404).json({ error: 'Employee not found.' });
        if (!existing.is_archived) return res.status(400).json({ error: 'This employee record is not archived.' });

        const { error } = await supabaseAdmin
            .from('employees')
            .update({ is_archived: false, archived_at: null, archived_by: null })
            .eq('id', req.params.id);

        if (error) throw error;
        await logRestore({ entityType: 'employee', entityId: Number(req.params.id), entityLabel: employeeLabel(existing), req });
        res.json({ message: 'Employee restored' });
    } catch (err) {
        console.error('controllers/employeeController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

export { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee, restoreEmployee };
