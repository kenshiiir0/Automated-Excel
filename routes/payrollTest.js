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
import { computeSemiMonthlyPayroll, PH_HOLIDAYS_2026 } from '../lib/payrollCalculator.js';

const router = express.Router();

// Pilot scope: only this employee's emp_id may be computed through this
// route right now. Matched case-insensitively against emp_id OR against
// first+last name, since we don't know for certain which emp_id format
// was used when this record was created via the Add Employee form.
const TEST_PAYROLL_NAME_MATCH = { first: 'cedric', last: 'gencianos' };

// Standard DOLE monthly-equivalent factor for a 6-day workweek with an
// unpaid rest day (261 working days/year): monthlySalary = dailyRate * 261
// / 12. Cedric's stored `salary` was originally SET by applying this
// factor forward (₱695/day -> ₱15,116.25/month, per the Mon-Sat schedule
// confirmed for him) -- there is no separate daily_rate column in the
// employees table, so this reverses the same factor to recover a daily
// rate for holiday-pay math. This assumption (6-day week, factor 261) is
// specific to how Cedric's record was set up; it is NOT a safe assumption
// to reuse for any other employee without confirming their own schedule.
const MONTHLY_TO_DAILY_FACTOR = 261 / 12;

function deriveDailyRate(monthlySalary) {
    return Math.round((monthlySalary / MONTHLY_TO_DAILY_FACTOR) * 100) / 100;
}

// GET /api/payroll-test/holidays -- returns the 2026 holiday calendar so
// the frontend can offer a "test against this date" picker instead of the
// UI hardcoding its own copy of the list.
router.get('/holidays', requireRole('admin', 'super_admin'), (req, res) => {
    res.json({ year: 2026, holidays: PH_HOLIDAYS_2026 });
});

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

        // Optional holiday-pay test: ?holidays=<JSON array>, e.g.
        // ?holidays=[{"date":"2026-04-02","wasPresent":true},{"date":"2026-04-03","wasPresent":false}]
        // Supports any number of holiday dates within the same cutoff --
        // several 2026 holidays do land close together (Apr 2-3: Maundy
        // Thursday + Good Friday; Nov 1-2: All Saints' + All Souls'), so a
        // real semi-monthly cutoff can easily contain more than one.
        // Falls back to the older single-date form (?holidayDate=...) for
        // backwards compatibility, in case anything still calls it that way.
        const dailyRate = deriveDailyRate(monthlySalary);
        let holidayAttendance = [];
        if (req.query.holidays) {
            try {
                const parsed = JSON.parse(String(req.query.holidays));
                if (Array.isArray(parsed)) {
                    holidayAttendance = parsed
                        .filter(h => h && h.date)
                        .map(h => ({
                            date: String(h.date),
                            wasPresent: h.wasPresent === true || h.wasPresent === 'true',
                            isRestDay: h.isRestDay === true || h.isRestDay === 'true',
                            presentDayBefore: h.presentDayBefore !== false && h.presentDayBefore !== 'false',
                        }));
                }
            } catch {
                return res.status(400).json({ error: 'Invalid "holidays" parameter -- must be a JSON array.' });
            }
        } else if (req.query.holidayDate) {
            holidayAttendance.push({
                date: String(req.query.holidayDate),
                wasPresent: req.query.wasPresent === 'true',
                isRestDay: req.query.isRestDay === 'true',
                presentDayBefore: req.query.presentDayBefore !== 'false',
            });
        }

        const payroll = computeSemiMonthlyPayroll(monthlySalary, dailyRate, holidayAttendance);

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
                cutoff: 'Semi-monthly, full attendance assumed except for any holiday date tested above',
                dailyRateNote: `Daily rate (₱${dailyRate}/day) reverse-derived from monthly salary using the 6-day-workweek factor (261 days/yr ÷ 12) confirmed for this employee -- not necessarily valid for other employees.`,
                note: 'Pilot calculation for one employee only. Government contribution tables used here should be verified against current official SSS/PhilHealth/Pag-IBIG/BIR circulars before relying on this for real payroll.',
            },
        });
    } catch (err) {
        res.status(500).json({ error: 'Unexpected error computing test payroll.', detail: err.message });
    }
});

export default router;
