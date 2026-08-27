import { supabaseAdmin } from '../lib/supabase.js';

// Deliberately returns only a safe, work-directory-style subset of fields --
// NOT the full employee record. Salary, bank account, SSS/PHIC/HDMF/TIN
// numbers, and other sensitive fields are excluded on purpose, since this
// endpoint exists to be called by an external system (Zoho) over a shared
// API key, not a logged-in HR user. If a future use case genuinely needs
// more fields sent to Zoho, add them here deliberately rather than
// switching this to select('*').
const SAFE_FIELDS = [
    'emp_id', 'first_name', 'last_name', 'middle_name',
    'email', 'phone', 'department', 'position',
    'employment_status', 'employment_classification',
    'hire_date', 'is_incomplete',
].join(', ');

const getEmployeesForZoho = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select(SAFE_FIELDS)
            .order('last_name', { ascending: true });

        if (error) throw error;
        res.json({ count: data.length, employees: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { getEmployeesForZoho };
