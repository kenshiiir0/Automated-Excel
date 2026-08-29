import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../Icon.jsx';

// PayrollTest is a PILOT view for exactly one employee (Cedric Angelo
// Gencianos) while the government-deduction math (SSS/PhilHealth/HDMF/BIR
// withholding) is being validated against real Filipay-style payroll
// processing. It calls GET /api/payroll-test/cedric-test, which is
// deliberately hardcoded to that one employee on the server side too --
// see routes/payrollTest.js and lib/payrollCalculator.js for why this
// isn't opened up to everyone yet.
//
// Gated the same way Payroll.jsx is (admin/super_admin only, via
// Navigation.jsx's canSeeUserManagement check) since this shows the exact
// same class of sensitive data (salary, government ID numbers) plus a
// computed net-pay figure on top.

function money(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return '—';
    return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dash(v) {
    return v === null || v === undefined || v === '' ? '—' : v;
}

function Row({ label, value, strong, indent }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '7px 0', borderBottom: '1px solid #eef1f4',
            paddingLeft: indent ? 16 : 0,
        }}>
            <span style={{ fontSize: 13.5, color: strong ? '#1a202c' : '#4a5568', fontWeight: strong ? 700 : 400 }}>{label}</span>
            <span style={{ fontSize: 13.5, fontFamily: 'monospace', fontWeight: strong ? 700 : 600, color: strong ? '#1a202c' : '#2d3748' }}>{value}</span>
        </div>
    );
}

function SectionCard({ title, subtitle, children }) {
    return (
        <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '18px 20px', marginBottom: 16,
        }}>
            <div style={{ marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a202c' }}>{title}</h3>
                {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#718096' }}>{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}

export default function PayrollTest({ visible }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/payroll-test/cedric-test');
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Could not compute test payroll.');
            setData(json);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="page-content" style={{ maxWidth: 760 }}>
            <div className="page-header">
                <div>
                    <h2 style={{ margin: 0 }}>Payroll Calculation Test</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#718096' }}>
                        Pilot run for one employee only — shows how government deductions and net pay
                        would be computed from data already in the system.
                    </p>
                </div>
                <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
                    <Icon name="refresh" size={14} /> Refresh
                </button>
            </div>

            <div style={{
                background: '#fffbea', border: '1px solid #f6e05e', borderRadius: 10,
                padding: '12px 16px', marginBottom: 20, fontSize: 12.5, color: '#744210', lineHeight: 1.5,
            }}>
                <strong>This is a pilot, not production payroll.</strong> It computes real SSS, PhilHealth,
                Pag-IBIG (HDMF), and BIR withholding tax deductions using the employee's stored salary — but
                assumes full attendance for one semi-monthly cutoff (no absences, late, holidays, or paid
                leave factored in yet), and the government contribution tables were not verified against
                current-year official circulars at build time. Treat the numbers below as a demonstration of
                the calculation method, not a final payslip.
            </div>

            {loading && <div style={{ padding: 24, textAlign: 'center', color: '#718096' }}>Loading…</div>}

            {!loading && error && (
                <div style={{
                    background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 10,
                    padding: '14px 16px', color: '#c53030', fontSize: 13.5,
                }}>
                    {error}
                </div>
            )}

            {!loading && !error && data && (
                <>
                    <SectionCard title="Employee">
                        <Row label="Name" value={dash(data.employee.name)} />
                        <Row label="Employee ID" value={dash(data.employee.emp_id)} />
                        <Row label="Department" value={dash(data.employee.department)} />
                        <Row label="Position" value={dash(data.employee.position)} />
                        <Row label="Employment Status" value={dash(data.employee.employment_status)} />
                        <Row label="SSS No." value={dash(data.employee.sss_number)} />
                        <Row label="PhilHealth No." value={dash(data.employee.philhealth_number)} />
                        <Row label="Pag-IBIG (HDMF) No." value={dash(data.employee.hdmf_number)} />
                        <Row label="TIN" value={dash(data.employee.tin_number)} />
                    </SectionCard>

                    <SectionCard title="Pay Period" subtitle={data.assumptions?.cutoff}>
                        <Row label="Monthly Salary (on file)" value={money(data.payroll.monthlySalary)} />
                        <Row label="Semi-Monthly Gross" value={money(data.payroll.semiMonthlyGross)} strong />
                    </SectionCard>

                    <SectionCard title="Government Deductions (employee share, this cutoff)">
                        <Row label="SSS" value={money(data.payroll.deductions.sss.employeeShare)} />
                        <Row label="Monthly Salary Credit used" value={dash(data.payroll.deductions.sss.monthlySalaryCredit)} indent />
                        <Row label="Bracket" value={dash(data.payroll.deductions.sss.bracketRange)} indent />

                        <Row label="PhilHealth" value={money(data.payroll.deductions.philhealth.employeeShare)} />
                        <Row label="Premium base used" value={money(data.payroll.deductions.philhealth.premiumBase)} indent />

                        <Row label="Pag-IBIG (HDMF)" value={money(data.payroll.deductions.hdmf.employeeShare)} />
                        <Row label="Contribution base used" value={money(data.payroll.deductions.hdmf.contributionBase)} indent />

                        <Row label="Withholding Tax (BIR)" value={money(data.payroll.deductions.withholdingTax.amount)} />
                        <Row label="Bracket applied" value={dash(data.payroll.deductions.withholdingTax.bracketLabel)} indent />
                    </SectionCard>

                    <SectionCard title="Result">
                        <Row label="Total Deductions" value={money(data.payroll.totalDeductions)} />
                        <Row label="Net Pay (this cutoff)" value={money(data.payroll.netPay)} strong />
                    </SectionCard>
                </>
            )}
        </div>
    );
}
