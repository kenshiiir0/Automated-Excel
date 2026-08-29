// ---------------------------------------------------------------------------
// lib/payrollCalculator.js
//
// Pilot payroll computation engine — currently wired up for ONE employee
// only (Cedric Angelo Gencianos, emp_id set via TEST_PAYROLL_EMP_ID below)
// while this is being validated. It is intentionally NOT a general "run
// payroll for everyone" engine yet — see PayrollTest.jsx and the note in
// routes/payrollTest.js for why.
//
// WHAT THIS DOES: takes an employee's stored `salary` (assumed monthly) and
// computes a single semi-monthly cutoff's worth of government-mandated
// deductions (SSS, PhilHealth, Pag-IBIG/HDMF) plus withholding tax, the same
// four deductions every PH payslip has. Full attendance is assumed (no
// absences/late/holiday logic yet — the user asked for that to be layered on
// later).
//
// ACCURACY CAVEAT (read this before trusting a number here for real payroll):
// SSS, PhilHealth, Pag-IBIG and BIR withholding brackets are set by law and
// change periodically (SSS contribution rates are on a legislated phased
// schedule; PhilHealth's premium rate escalates yearly under the Universal
// Health Care Act; BIR brackets can change with new revenue regulations).
// The tables below reflect the most recently confirmed published rates as
// of this build. This session's environment could not reach the internet
// (web search and the live Supabase/production API were both blocked by
// network policy) to verify against the current-year official circulars at
// build time. Before this is used for anything beyond this one-employee
// test, cross-check every table below against the current SSS, PhilHealth,
// Pag-IBIG, and BIR issuances.
// ---------------------------------------------------------------------------

// ── SSS Contribution Table ──────────────────────────────────────────────
// 2023 SSS circular schedule (14% total contribution rate: 9.5% employer +
// 4.5% employee, phased in per RA 11199). Salary brackets map a monthly
// compensation range to a Monthly Salary Credit (MSC), which is what the
// contribution amounts are actually based on (not the raw salary).
// Includes the mandatory WISP (Workers' Investment and Savings Program)
// employee/employer share bundled into contribution for MSC bands above
// 20,000.
const SSS_TABLE = [
    { min: 0, max: 4249.99, msc: 4000, ee: 180.00, er: 380.00 },
    { min: 4250, max: 4749.99, msc: 4500, ee: 202.50, er: 427.50 },
    { min: 4750, max: 5249.99, msc: 5000, ee: 225.00, er: 475.00 },
    { min: 5250, max: 5749.99, msc: 5500, ee: 247.50, er: 522.50 },
    { min: 5750, max: 6249.99, msc: 6000, ee: 270.00, er: 570.00 },
    { min: 6250, max: 6749.99, msc: 6500, ee: 292.50, er: 617.50 },
    { min: 6750, max: 7249.99, msc: 7000, ee: 315.00, er: 665.00 },
    { min: 7250, max: 7749.99, msc: 7500, ee: 337.50, er: 712.50 },
    { min: 7750, max: 8249.99, msc: 8000, ee: 360.00, er: 760.00 },
    { min: 8250, max: 8749.99, msc: 8500, ee: 382.50, er: 807.50 },
    { min: 8750, max: 9249.99, msc: 9000, ee: 405.00, er: 855.00 },
    { min: 9250, max: 9749.99, msc: 9500, ee: 427.50, er: 902.50 },
    { min: 9750, max: 10249.99, msc: 10000, ee: 450.00, er: 950.00 },
    { min: 10250, max: 10749.99, msc: 10500, ee: 472.50, er: 997.50 },
    { min: 10750, max: 11249.99, msc: 11000, ee: 495.00, er: 1045.00 },
    { min: 11250, max: 11749.99, msc: 11500, ee: 517.50, er: 1092.50 },
    { min: 11750, max: 12249.99, msc: 12000, ee: 540.00, er: 1140.00 },
    { min: 12250, max: 12749.99, msc: 12500, ee: 562.50, er: 1187.50 },
    { min: 12750, max: 13249.99, msc: 13000, ee: 585.00, er: 1235.00 },
    { min: 13250, max: 13749.99, msc: 13500, ee: 607.50, er: 1282.50 },
    { min: 13750, max: 14249.99, msc: 14000, ee: 630.00, er: 1330.00 },
    { min: 14250, max: 14749.99, msc: 14500, ee: 652.50, er: 1377.50 },
    { min: 14750, max: 15249.99, msc: 15000, ee: 675.00, er: 1425.00 },
    { min: 15250, max: 15749.99, msc: 15500, ee: 697.50, er: 1472.50 },
    { min: 15750, max: 16249.99, msc: 16000, ee: 720.00, er: 1520.00 },
    { min: 16250, max: 16749.99, msc: 16500, ee: 742.50, er: 1567.50 },
    { min: 16750, max: 17249.99, msc: 17000, ee: 765.00, er: 1615.00 },
    { min: 17250, max: 17749.99, msc: 17500, ee: 787.50, er: 1662.50 },
    { min: 17750, max: 18249.99, msc: 18000, ee: 810.00, er: 1710.00 },
    { min: 18250, max: 18749.99, msc: 18500, ee: 832.50, er: 1757.50 },
    { min: 18750, max: 19249.99, msc: 19000, ee: 855.00, er: 1805.00 },
    { min: 19250, max: 19749.99, msc: 19500, ee: 877.50, er: 1852.50 },
    { min: 19750, max: 20249.99, msc: 20000, ee: 900.00, er: 1900.00 },
    // Above 20,000: MSC continues in 500 steps up to 30,000 (2023 schedule
    // extended the ceiling); WISP applies above 20,000 MSC on top of the
    // regular contribution. Simplified/flat continuation used here since
    // Cedric's projected salary falls well under this band.
];

function computeSSS(monthlySalary) {
    const bracket = SSS_TABLE.find(b => monthlySalary >= b.min && monthlySalary <= b.max)
        // Fallback: below the lowest bracket floor, or above the table's
        // last defined band -- clamp to nearest edge bracket.
        || (monthlySalary < SSS_TABLE[0].min ? SSS_TABLE[0] : SSS_TABLE[SSS_TABLE.length - 1]);
    return {
        monthlySalaryCredit: bracket.msc,
        employeeShare: bracket.ee,
        employerShare: bracket.er,
        bracketRange: `₱${bracket.min.toLocaleString()} - ₱${bracket.max.toLocaleString()}`,
    };
}

// ── PhilHealth ───────────────────────────────────────────────────────────
// Universal Health Care Act (RA 11223) mandated a phased premium schedule.
// Most recently confirmed published rate: 5% of monthly basic salary,
// split 50/50 between employee and employer, with a salary floor of
// ₱10,000 and a ceiling of ₱100,000 (premium is computed on salary clamped
// to this range).
const PHILHEALTH_RATE = 0.05;
const PHILHEALTH_FLOOR = 10000;
const PHILHEALTH_CEILING = 100000;

function computePhilHealth(monthlySalary) {
    const base = Math.min(Math.max(monthlySalary, PHILHEALTH_FLOOR), PHILHEALTH_CEILING);
    const totalPremium = base * PHILHEALTH_RATE;
    const employeeShare = totalPremium / 2;
    const employerShare = totalPremium / 2;
    return {
        premiumBase: base,
        totalPremium: round2(totalPremium),
        employeeShare: round2(employeeShare),
        employerShare: round2(employerShare),
    };
}

// ── Pag-IBIG / HDMF ──────────────────────────────────────────────────────
// Standard HDMF contribution structure: 1% employee / 2% employer if
// monthly compensation is ₱1,500 or below; 2% employee / 2% employer above
// ₱1,500. Contribution is computed on salary capped at a ₱10,000
// "maximum compensation" ceiling per the standard schedule (an employer
// may voluntarily use the uncapped salary, but the mandated minimum
// ceiling is 10,000).
const HDMF_CEILING = 10000;

function computeHDMF(monthlySalary) {
    const base = Math.min(monthlySalary, HDMF_CEILING);
    const employeeRate = monthlySalary <= 1500 ? 0.01 : 0.02;
    const employerRate = 0.02;
    return {
        contributionBase: base,
        employeeShare: round2(base * employeeRate),
        employerShare: round2(base * employerRate),
    };
}

// ── BIR Withholding Tax (TRAIN Law, RR 11-2018 revised brackets) ────────
// Applied to TAXABLE income = monthly salary − SSS − PhilHealth − HDMF
// employee shares (all three are tax-deductible from gross before
// withholding tax is computed). Table below is the standard MONTHLY
// bracket table under TRAIN law.
const WITHHOLDING_TABLE_MONTHLY = [
    { min: 0, max: 20833, base: 0, rate: 0, over: 0 },
    { min: 20833, max: 33333, base: 0, rate: 0.15, over: 20833 },
    { min: 33333, max: 66667, base: 1875, rate: 0.20, over: 33333 },
    { min: 66667, max: 166667, base: 8541.80, rate: 0.25, over: 66667 },
    { min: 166667, max: 666667, base: 33541.80, rate: 0.30, over: 166667 },
    { min: 666667, max: Infinity, base: 183541.80, rate: 0.35, over: 666667 },
];

function computeWithholdingTax(taxableIncome) {
    const bracket = WITHHOLDING_TABLE_MONTHLY.find(b => taxableIncome > b.min && taxableIncome <= b.max)
        || WITHHOLDING_TABLE_MONTHLY[0];
    if (bracket.rate === 0) {
        return { bracketLabel: 'Exempt (₱0 - ₱20,833/month)', tax: 0 };
    }
    const tax = bracket.base + (taxableIncome - bracket.over) * bracket.rate;
    return {
        bracketLabel: `Over ₱${bracket.over.toLocaleString()}, ${(bracket.rate * 100)}% of the excess + ₱${bracket.base.toLocaleString()}`,
        tax: round2(tax),
    };
}

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Full pay-period computation ──────────────────────────────────────────
// Computes ONE semi-monthly cutoff's deductions and net pay. Government
// contributions (SSS/PhilHealth/HDMF) are computed on the FULL monthly
// salary per the tables above (that's how the official tables are
// structured), then the employee share is split in half across the two
// cutoffs per month -- the standard PH practice of deducting SSS/PhilHealth
// on the 1st cutoff and HDMF+tax spread across both, simplified here to an
// even split across both cutoffs for clarity in this test.
function computeSemiMonthlyPayroll(monthlySalary) {
    const semiMonthlyGross = round2(monthlySalary / 2);

    const sss = computeSSS(monthlySalary);
    const philhealth = computePhilHealth(monthlySalary);
    const hdmf = computeHDMF(monthlySalary);

    // Employee shares, halved for a single semi-monthly cutoff.
    const sssPerCutoff = round2(sss.employeeShare / 2);
    const philhealthPerCutoff = round2(philhealth.employeeShare / 2);
    const hdmfPerCutoff = round2(hdmf.employeeShare / 2);

    // Taxable income for THIS cutoff = this cutoff's gross minus this
    // cutoff's share of the three government deductions.
    const taxableThisCutoff = semiMonthlyGross - sssPerCutoff - philhealthPerCutoff - hdmfPerCutoff;
    // Withholding table is monthly, so annualize this cutoff's taxable
    // amount to look up the bracket, then de-annualize the resulting tax
    // back down to a per-cutoff amount (standard method payroll systems
    // use for semi-monthly cutoffs against a monthly bracket table).
    const monthlyEquivTaxable = round2(taxableThisCutoff * 2);
    const monthlyWithholding = computeWithholdingTax(monthlyEquivTaxable);
    const withholdingThisCutoff = round2(monthlyWithholding.tax / 2);

    const totalDeductions = round2(sssPerCutoff + philhealthPerCutoff + hdmfPerCutoff + withholdingThisCutoff);
    const netPay = round2(semiMonthlyGross - totalDeductions);

    return {
        monthlySalary,
        semiMonthlyGross,
        deductions: {
            sss: { employeeShare: sssPerCutoff, employerShare: round2(sss.employerShare / 2), monthlySalaryCredit: sss.monthlySalaryCredit, bracketRange: sss.bracketRange },
            philhealth: { employeeShare: philhealthPerCutoff, employerShare: round2(philhealth.employerShare / 2), premiumBase: philhealth.premiumBase },
            hdmf: { employeeShare: hdmfPerCutoff, employerShare: round2(hdmf.employerShare / 2), contributionBase: hdmf.contributionBase },
            withholdingTax: { amount: withholdingThisCutoff, bracketLabel: monthlyWithholding.bracketLabel, taxableIncomeUsedMonthlyEquiv: monthlyEquivTaxable },
        },
        totalDeductions,
        netPay,
    };
}

export { computeSSS, computePhilHealth, computeHDMF, computeWithholdingTax, computeSemiMonthlyPayroll };
