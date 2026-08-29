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
// Template layout mirrors 2MG Incorporated's actual payslip format (from
// the uploaded Payslip_ALL_WithoutMaamSuman_August_1125_2026.pdf reference):
// company header, employee info block, Basic Pay, Holiday Pay (repeating
// entries via a docxtemplater loop), Gross Pay, Deductions (SSS/PhilHealth/
// HDMF/Withholding Tax with basis shown), and a Net Pay footer.
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

function money(n) {
    const v = Number(n) || 0;
    return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateLong(dateStr) {
    if (!dateStr) return '';
    try {
        const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
        const parsed = dateOnlyMatch
            ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
            : new Date(dateStr);
        return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

// Builds the full field map docxtemplater needs from a payroll result
// (the object computeSemiMonthlyPayroll() returns) plus employee/cutoff
// context. Kept separate from renderPayslipDocx() so the controller can
// unit-inspect the field map if needed before rendering.
//
// Each entry in payroll.holidayPay.entries (from computeHolidayPayForPeriod
// in lib/payrollCalculator.js) already carries date, holidayName,
// holidayType, wasPresent, amount, rateMultiplier, and a ready-made
// human-readable `explanation` string -- reused directly here rather than
// re-deriving the DOLE rule label, so the payslip text can never drift
// from the actual calculation logic that produced the amount.
function buildPayslipFields({ employee, payroll, cutoffLabel, payDate, preparedBy }) {
    const holidayEntries = (payroll.holidayPay?.entries || []).map((entry) => ({
        date: formatDateLong(entry.date),
        holiday_name: entry.holidayName || 'Holiday',
        rule_applied: entry.explanation || `${Math.round((entry.rateMultiplier || 0) * 100)}% of daily rate`,
        amount: money(entry.amount || 0),
    }));

    return {
        company_name: '2MG Incorporated',
        cutoff_label: cutoffLabel || 'Semi-monthly cutoff',
        employee_name: employee.name,
        emp_id: employee.emp_id || '',
        position: employee.position || '',
        department: employee.department || '',
        employment_status: employee.employment_status || '',
        hire_date: formatDateLong(employee.hire_date),
        pay_date: payDate || formatDateLong(new Date().toISOString().slice(0, 10)),
        prepared_by: preparedBy || 'HR Department',

        monthly_salary: money(payroll.monthlySalary),
        daily_rate: money(payroll.dailyRate),
        basic_pay: money(payroll.baseSemiMonthlyGross),

        has_holiday_pay: holidayEntries.length > 0,
        holiday_entries: holidayEntries,
        total_holiday_pay: money(payroll.holidayPay?.totalHolidayPay || 0),

        gross_pay: money(payroll.semiMonthlyGross),

        sss_basis: payroll.deductions.sss.bracketRange
            ? `MSC ${payroll.deductions.sss.monthlySalaryCredit} (${payroll.deductions.sss.bracketRange})`
            : `MSC ${payroll.deductions.sss.monthlySalaryCredit}`,
        sss_amount: money(payroll.deductions.sss.employeeShare),

        philhealth_basis: `5% of ${money(payroll.deductions.philhealth.premiumBase)}`,
        philhealth_amount: money(payroll.deductions.philhealth.employeeShare),

        hdmf_basis: `on ${money(payroll.deductions.hdmf.contributionBase)}`,
        hdmf_amount: money(payroll.deductions.hdmf.employeeShare),

        withholding_basis: payroll.deductions.withholdingTax.bracketLabel || 'TRAIN monthly bracket',
        withholding_amount: money(payroll.deductions.withholdingTax.amount),

        total_deductions: money(payroll.totalDeductions),
        net_pay: money(payroll.netPay),

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

export { buildPayslipFields, renderPayslipDocx, money, formatDateLong };
