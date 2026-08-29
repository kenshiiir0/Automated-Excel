// ---------------------------------------------------------------------------
// lib/payslipGenerator.js
//
// Renders a payslip .docx from a computeSemiMonthlyPayroll() result, using
// the exact same docxtemplater + PizZip pattern as lib/disciplinaryMemos.js
// (see that file's comments for why DOCXTEMPLATER_OPTIONS must explicitly
// set delimiters: {{ }} -- the installed docxtemplater version defaults to
// single-brace tags, and {{tag}} without this override throws a confusing
// "duplicate open tag" lexer error).
//
// PILOT SCOPE: like routes/payrollTest.js, this is deliberately usable only
// for the Cedric Angelo Gencianos pilot right now (enforced by the calling
// route, not here) -- see that file's comment block for why. This module
// itself has no employee-specific logic, so it will work for anyone once
// the pilot is opened up; nothing here needs to change for that later step.
//
// TEMPLATE (2026-08-29, v2): templates/payroll/Payslip_template.docx was
// rebuilt to match 2MG Incorporated's REAL payslip layout exactly, per the
// uploaded reference (Payslip_ALL_WithoutMaamSuman_August_1125_2026.pdf) --
// the earlier v1 template (company header / Basic Pay / generic Holiday
// Pay / Deductions sections) looked nothing like the actual company
// payslip and has been replaced. The real layout is:
//   2MG INCORPORATED
//   Employee Name / CONFIDENTIAL, Name, Emp ID, Cluster (department)
//   Payroll Period, Pay Date
//   EARNINGS table (Basic Rate, Basic, Allowance Tax/N-Tax, Oth. Earnings
//     Tax/N-Tax, VL/SL/OL, Reg Night Diff, Unpaid Leave)
//   OVERTIME BREAKDOWN table (Regular OT, Regular Hol, Special Hol, Day
//     Off, DO/Reg. Hol., DO/Spc. Hol. -- each with OT/OT>8/ND/ND>8/Total)
//   TAXABLE INCOME
//   DEDUCTIONS table (SSS, SSS MPF, Philhealth, Pagibig, WTAX, Absent,
//     Lates, Undertime -- each with a YTD column)
//   EARNINGS BREAKDOWN / DEDUCTIONS BREAKDOWN (optional extra line items,
//     e.g. Medical Allowances, Cash Advances -- rendered via a
//     docxtemplater loop, zero rows when there are none)
//   TOTAL GROSS / TOTAL DEDUCTIONS / NET PAY
//
// Our own calculator (lib/payrollCalculator.js) doesn't compute several of
// these line items yet (SSS MPF, allowances, absences/lates/undertime
// deductions, YTD running totals) -- those fields are mapped to blank/zero
// here rather than omitted, so the template's table shape always matches
// the real payslip even before those calculations exist. Holiday pay from
// computeHolidayPayForPeriod() is folded into the OVERTIME BREAKDOWN's
// "REGULAR HOL" / "SPECIAL HOL" rows (splitting by holiday.type), which is
// where the real payslips also put it -- see the REGULAR HOL / SPECIAL HOL
// rows in the reference PDF's Overtime Breakdown table.
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'payroll', 'Payslip_template.docx');

const DOCXTEMPLATER_OPTIONS = {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
};

// Plain "1,234.56" formatting (no currency symbol) -- matches the real
// payslip's number columns exactly, which never show a ₱ sign.
function num(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
        const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
        const parsed = dateOnlyMatch
            ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
            : new Date(dateStr);
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

function formatDateSlashes(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${d.getFullYear()}`;
}

// Splits computeHolidayPayForPeriod()'s entries into the two OVERTIME
// BREAKDOWN rows the real payslip uses for holiday pay: REGULAR HOL for
// entries against a regular holiday, SPECIAL HOL for special non-working
// days. Sums to a single TOTAL per row (the real payslips don't itemize
// individual dates within a row -- see the reference PDF, e.g. Adion's
// "SPECIAL HOL ... 1146.33" is one combined figure, not itemized per date).
function splitHolidayPayByType(entries = []) {
    let regularHolTotal = 0;
    let specialHolTotal = 0;
    for (const entry of entries) {
        if (entry.holidayType === 'regular') regularHolTotal += entry.amount || 0;
        else specialHolTotal += entry.amount || 0;
    }
    return { regularHolTotal, specialHolTotal };
}

// Builds the full field map docxtemplater needs from a payroll result
// (the object computeSemiMonthlyPayroll() returns) plus employee/cutoff
// context. Kept separate from renderPayslipDocx() so the controller can
// unit-inspect the field map if needed before rendering.
function buildPayslipFields({ employee, payroll, payrollPeriodLabel, payDate, earningsExtra = [], deductionsExtra = [] }) {
    const { regularHolTotal, specialHolTotal } = splitHolidayPayByType(payroll.holidayPay?.entries);
    const totalOt = regularHolTotal + specialHolTotal;

    const totalEarningsBreakdown = earningsExtra.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalDeductionsBreakdown = deductionsExtra.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const sss = payroll.deductions.sss;
    const philhealth = payroll.deductions.philhealth;
    const hdmf = payroll.deductions.hdmf;
    const wtax = payroll.deductions.withholdingTax;

    return {
        employee_name: (employee.name || '').toUpperCase(),
        emp_id: employee.emp_id || '',
        cluster: [employee.department, '2MG INCORPORATED'].filter(Boolean).join(', '),
        payroll_period: payrollPeriodLabel || '',
        pay_date: payDate ? formatDateSlashes(payDate) : formatDateSlashes(new Date().toISOString().slice(0, 10)),

        // EARNINGS table
        basic_rate_label: 'Monthly',
        basic_rate_amount: num(payroll.monthlySalary),
        basic_dayhr: '104.00', // fixed hours-per-cutoff, matches every real payslip in the reference set
        basic_amount: num(payroll.baseSemiMonthlyGross),
        allowance_tax: '0.00',
        allowance_ntax: '0.00',
        oth_earnings_tax: '0.00',
        oth_earnings_ntax: '0.00',
        vl_sl_ol_dayhr: '0.00 / 0.00 / 0.00',
        vl_sl_ol_amount: '0.00',
        reg_night_diff_dayhr: '0.00',
        reg_night_diff_amount: '0.00',
        unpaid_leave_dayhr: '0.00',
        unpaid_leave_amount: '0.00',

        // OVERTIME BREAKDOWN table -- our calculator only produces holiday
        // pay right now, so Regular OT/Day Off/DO rows are always zero;
        // holiday pay from computeHolidayPayForPeriod() lands in Regular
        // Hol / Special Hol, same as the real payslips.
        regular_ot_ot: '', regular_ot_ot8: '', regular_ot_nd: '', regular_ot_nd8: '', regular_ot_total: '0.00',
        regular_hol_ot: '', regular_hol_ot8: '', regular_hol_nd: '', regular_hol_nd8: '',
        regular_hol_total: regularHolTotal ? num(regularHolTotal) : '0.00',
        special_hol_ot: '', special_hol_ot8: '', special_hol_nd: '', special_hol_nd8: '',
        special_hol_total: specialHolTotal ? num(specialHolTotal) : '0.00',
        day_off_ot: '', day_off_ot8: '', day_off_nd: '', day_off_nd8: '', day_off_total: '0.00',
        do_reg_hol_ot: '', do_reg_hol_ot8: '', do_reg_hol_nd: '', do_reg_hol_nd8: '', do_reg_hol_total: '0.00',
        do_spc_hol_ot: '', do_spc_hol_ot8: '', do_spc_hol_nd: '', do_spc_hol_nd8: '', do_spc_hol_total: '0.00',
        total_ot_ot: '0.00', total_ot_ot8: '0.00', total_ot_nd: '0.00', total_ot_nd8: '0.00',
        total_ot_total: num(totalOt),

        taxable_income: num(payroll.semiMonthlyGross - sss.employeeShare - philhealth.employeeShare - hdmf.employeeShare),

        // DEDUCTIONS table (with YTD -- our calculator doesn't track a
        // running year-to-date total yet, so YTD mirrors this cutoff's
        // amount rather than a true cumulative figure until that exists).
        sss_dayhr: '', sss_amount: num(sss.employeeShare), sss_ytd: num(sss.employeeShare),
        sss_mpf_dayhr: '', sss_mpf_amount: '', sss_mpf_ytd: '',
        philhealth_dayhr: '', philhealth_amount: num(philhealth.employeeShare), philhealth_ytd: num(philhealth.employeeShare),
        pagibig_dayhr: '', pagibig_amount: num(hdmf.employeeShare), pagibig_ytd: num(hdmf.employeeShare),
        wtax_status: 'S',
        wtax_dayhr: '', wtax_amount: num(wtax.amount), wtax_ytd: num(wtax.amount),
        absent_days: '', absent_amount: '', absent_ytd: '',
        lates_hrs: '', lates_amount: '', lates_ytd: '',
        undertime_hrs: '', undertime_amount: '', undertime_ytd: '',

        // EARNINGS BREAKDOWN / DEDUCTIONS BREAKDOWN -- optional extra line
        // items (e.g. Medical Allowances, Cash Advances), empty by default
        // since the calculator doesn't produce these; a caller can pass
        // earningsExtra/deductionsExtra explicitly if ever needed.
        earnings_extra: earningsExtra.map(e => ({ label: (e.label || '').toUpperCase(), amount: num(e.amount) })),
        total_earnings_breakdown: num(totalEarningsBreakdown),
        deductions_extra: deductionsExtra.map(e => ({ label: (e.label || '').toUpperCase(), amount: num(e.amount) })),
        total_deductions_breakdown: num(totalDeductionsBreakdown),

        total_gross: num(payroll.semiMonthlyGross + totalEarningsBreakdown),
        total_deductions: num(payroll.totalDeductions + totalDeductionsBreakdown),
        net_pay: num(payroll.netPay - totalDeductionsBreakdown + totalEarningsBreakdown),

        note: 'PILOT payslip -- generated for one test employee only while the government-deduction tables are being validated against real payroll references. Treat as a demonstration, not an official pay document, until this is confirmed for wider use.',
    };
}

// Renders the payslip and returns the finished .docx as a Buffer. Throws
// if any template placeholder is missing a value (fail loudly rather than
// ship a payslip with a literal "{{tag}}" left in it), same policy as
// renderMemoDocx() in lib/disciplinaryMemos.js.
function renderPayslipDocx(fields) {
    const content = fs.readFileSync(TEMPLATE_PATH, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, DOCXTEMPLATER_OPTIONS);
    doc.render(fields);
    return doc.getZip().generate({ type: 'nodebuffer' });
}

export { buildPayslipFields, renderPayslipDocx, num, formatDateShort, formatDateSlashes };
