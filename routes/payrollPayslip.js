// ---------------------------------------------------------------------------
// routes/payrollPayslip.js
//
// PILOT payslip-generation route -- scoped to the same one employee as
// routes/payrollTest.js (Cedric Angelo Gencianos), for the same reason:
// the underlying SSS/PhilHealth/HDMF/BIR tables in lib/payrollCalculator.js
// haven't been verified against current official circulars yet, so this
// isn't opened up to the rest of the company until that's done.
//
// This intentionally reuses TEST_PAYROLL_NAME_MATCH-style scoping rather
// than importing anything from payrollTest.js, since payrollTest.js has a
// comment warning not to widen its own scope without also removing this
// note -- keeping payslip generation as its own small, separately-scoped
// route means removing the pilot restriction later is a one-line change
// in exactly one place per feature, not a shared flag that's easy to
// half-remove.
// ---------------------------------------------------------------------------
import express from 'express';
import { requireRole } from '../lib/requireRole.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { computeSemiMonthlyPayroll, PH_HOLIDAYS_2026 } from '../lib/payrollCalculator.js';
import { buildPayslipFields, renderPayslipDocx } from '../lib/payslipGenerator.js';

const router = express.Router();

const PILOT_NAME_MATCH = { first: 'cedric', last: 'gencianos' };
const MONTHLY_TO_DAILY_FACTOR = 313 / 12; // see routes/payrollTest.js for the verification behind this factor

function deriveDailyRate(monthlySalary) {
    return Math.round((monthlySalary / MONTHLY_TO_DAILY_FACTOR) * 100) / 100;
}

async function fetchPilotEmployee() {
    return supabaseAdmin
        .from('employees')
        .select('emp_id, first_name, middle_name, last_name, department, position, employment_status, salary, hire_date')
        .ilike('first_name', `%${PILOT_NAME_MATCH.first}%`)
        .ilike('last_name', `%${PILOT_NAME_MATCH.last}%`)
        .eq('is_archived', false)
        .limit(1)
        .maybeSingle();
}

// POST /api/payroll-payslip/generate
// Body: { payrollPeriodLabel?: string, payDate?: string, holidays?: [{date, wasPresent, isRestDay?, presentDayBefore?}] }
// Returns the rendered .docx directly (same "generate fresh every time,
// never store a binary blob" approach as disciplinaryMemosController.js).
router.post('/generate', requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const { data: emp, error } = await fetchPilotEmployee();
        if (error) {
            return res.status(500).json({ error: 'Could not read employee record.', detail: error.message });
        }
        if (!emp) {
            return res.status(404).json({ error: 'Test employee (Cedric Angelo Gencianos) not found. Add him via Add Employee first, then retry.' });
        }

        const monthlySalary = Number(emp.salary);
        if (!monthlySalary || Number.isNaN(monthlySalary) || monthlySalary <= 0) {
            return res.status(422).json({ error: 'This employee has no valid salary on file yet -- cannot generate a payslip.' });
        }

        const dailyRate = deriveDailyRate(monthlySalary);

        let holidayAttendance = [];
        const rawHolidays = req.body?.holidays;
        if (Array.isArray(rawHolidays)) {
            holidayAttendance = rawHolidays
                .filter(h => h && h.date)
                .map(h => ({
                    date: String(h.date),
                    wasPresent: h.wasPresent === true || h.wasPresent === 'true',
                    isRestDay: h.isRestDay === true || h.isRestDay === 'true',
                    presentDayBefore: h.presentDayBefore !== false && h.presentDayBefore !== 'false',
                }));
        }

        const payroll = computeSemiMonthlyPayroll(monthlySalary, dailyRate, holidayAttendance);

        const employee = {
            emp_id: emp.emp_id,
            name: [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' '),
            department: emp.department,
            position: emp.position,
            employment_status: emp.employment_status,
            hire_date: emp.hire_date,
        };

        const fields = buildPayslipFields({
            employee,
            payroll,
            payrollPeriodLabel: req.body?.payrollPeriodLabel,
            payDate: req.body?.payDate,
        });

        const buffer = renderPayslipDocx(fields);
        const filename = `Payslip_${employee.name.replace(/[,\s]+/g, '_')}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        console.error('Payslip generation failed:', err);
        res.status(500).json({ error: 'Could not generate the payslip.', detail: err.message });
    }
});

// GET /api/payroll-payslip/holidays -- same data as GET /api/payroll-test/holidays,
// exposed here too so the Payslip modal doesn't need to depend on the
// separate payroll-test route just to populate its holiday picker.
router.get('/holidays', requireRole('admin', 'super_admin'), (req, res) => {
    res.json({ year: 2026, holidays: PH_HOLIDAYS_2026 });
});

export default router;
