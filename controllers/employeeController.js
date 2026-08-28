import { supabaseAdmin } from '../lib/supabase.js';

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

const getAllEmployees = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(withRoleFilter(req, data));
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
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
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateEmployee = async (req, res) => {
    try {
        const updates = stripSensitiveFieldsFromWrite(req, req.body);

        const { data, error } = await supabaseAdmin
            .from('employees')
            .update(updates)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteEmployee = async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('employees')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Employee deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee };
