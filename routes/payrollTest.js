// ---------------------------------------------------------------------------
// routes/payrollTest.js
//
// PILOT payroll computation route -- deliberately scoped to ONE employee
// (Cedric Angelo Gencianos) while the deduction math is being validated.
// This is NOT a general "compute payroll for anyone" endpoint on purpose:
// see the accuracy caveat in lib/payrollCalculator.js -- the SSS/PhilHealth/
// HDMF/BIR tables in there need to be checked against current official
// circulars before this is trusted for the rest of the company, so keeping
// it locked to a single named test subject avoids anyone mistaking this for
// production-ready payroll output.
//
// To extend to another employee for testing, change TEST_PAYROLL_EMP_ID
// below. To open this up to all employees, that hardcoded check needs to be
// removed AFTER the calculation tables are verified -- don't just delete
// this comment and ship it wider without doing that.
// ---------------------------------------------------------------------------
import express from 'express';
import { requireRole } from '../lib/requireRole.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { computeSemiMonthlyPayroll } from '../lib/payrollCalculator.js';

const router = express.Router();

// Pilot scope: only this employee's emp_id may be computed through this
// route right now. Matched case-insensitively against emp_id OR against
// first+last name, since we don't know for certain which emp_id format
// was used when this record was created via the Add Employee form.
const TEST_PAYROLL_NAME_MATCH = { first: 'cedric', last: 'gencianos' };

router.get('/cedric-test', requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('emp_id, first_name, middle_name, last_name, department, position, employment_status, salary, sss_number, philhealth_number, hdmf_number, tin_number, hire_date')
            .ilike('first_name', `%${TEST_PAYROLL_NAME_MATCH.first}%`)
            .ilike('last_name', `%${TEST_PAYROLL_NAME_MATCH.last}%`)
            .eq('is_archived', false)
            .limit(1)
            .maybeSingle();

        if (error) {
            return res.status(500).json({ error: 'Could not read employee record.', detail: error.message });
        }
        if (!data) {
            return res.status(404).json({ error: 'Test employee (Cedric Angelo Gencianos) not found. Add him via Add Employee first, then retry.' });
        }

        const monthlySalary = Number(data.salary);
        if (!monthlySalary || Number.isNaN(monthlySalary) || monthlySalary <= 0) {
            return res.status(422).json({ error: 'This employee has no valid salary on file yet -- cannot compute payroll.', employee: data });
        }

        const payroll = computeSemiMonthlyPayroll(monthlySalary);

        res.json({
            employee: {
                emp_id: data.emp_id,
                name: [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(' '),
                department: data.department,
                position: data.position,
                employment_status: data.employment_status,
                sss_number: data.sss_number,
                philhealth_number: data.philhealth_number,
                hdmf_number: data.hdmf_number,
                tin_number: data.tin_number,
                hire_date: data.hire_date,
            },
            payroll,
            assumptions: {
                cutoff: 'Semi-monthly, full attendance assumed (no absences/late/holidays factored in yet)',
                note: 'Pilot calculation for one employee only. Government contribution tables used here should be verified against current official SSS/PhilHealth/Pag-IBIG/BIR circulars before relying on this for real payroll.',
            },
        });
    } catch (err) {
        res.status(500).json({ error: 'Unexpected error computing test payroll.', detail: err.message });
    }
});

export default router;
