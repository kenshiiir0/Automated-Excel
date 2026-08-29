import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../Icon.jsx';

// Payroll is our own in-app view built from data we already store on the
// employee record (salary, bank details, government ID numbers) -- it is
// NOT a connection to any outside payroll vendor. Nothing here calls out
// to a third party; it's the same /api/employees data EmployeeList.jsx
// uses, just read-only and re-shaped around payroll-relevant columns.
//
// Gated to admin/super_admin only (see Navigation.jsx's canSeeUserManagement
// check, which this reuses) since salary/bank/gov-ID fields are sensitive --
// GET /api/employees already strips these fields server-side for the
// 'user' role (controllers/employeeController.js's withRoleFilter), so a
// 'user' account hitting this page directly would just see blanks/dashes,
// but the nav item itself is hidden from that role too, same as
// Disciplinary Memos and Manage Users.

function money(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return '—';
    return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dash(v) {
    return v === null || v === undefined || v === '' ? '—' : v;
}

export default function Payroll({ visible } = {}) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    const loadEmployees = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/employees');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load payroll data.');
            setEmployees(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadEmployees(); }, [loadEmployees]);

    // Keep-alive page (see App.jsx's PAGES list): quietly re-fetch on
    // returning to the tab, same pattern as EmployeeList/UserManagement,
    // skipping the very first mount (which the effect above already covers).
    const isFirstVisible = useRef(true);
    useEffect(() => {
        if (visible === undefined) return;
        if (isFirstVisible.current) { isFirstVisible.current = false; return; }
        if (visible) loadEmployees();
    }, [visible, loadEmployees]);

    // Only active, non-archived employees come back from GET /api/employees
    // by default (see employeeController.js), so this list is already
    // "current headcount" -- no separate status filter needed here.
    const q = search.trim().toLowerCase();
    const filtered = q
        ? employees.filter(e => {
            const hay = [e.emp_id, e.first_name, e.last_name, e.department, e.position, e.bank_name]
                .filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        })
        : employees;

    // Salary is stored as a flat number/string per employee (see
    // lib/schemas.js) -- there's no pay-period, earnings/deductions, or
    // payslip data in this system, so these are the only real numbers we
    // can summarize: total of everyone's stored salary figure, and how
    // many of those figures are actually filled in vs. blank.
    const withSalary = employees.filter(e => e.salary !== null && e.salary !== undefined && e.salary !== '' && !Number.isNaN(Number(e.salary)));
    const totalMonthlyPayroll = withSalary.reduce((sum, e) => sum + Number(e.salary), 0);
    const avgSalary = withSalary.length ? totalMonthlyPayroll / withSalary.length : 0;
    const missingSalaryCount = employees.length - withSalary.length;

    const deptTotals = {};
    withSalary.forEach(e => {
        const dept = e.department || 'Unassigned';
        deptTotals[dept] = (deptTotals[dept] || 0) + Number(e.salary);
    });
    const deptCount = Object.keys(deptTotals).length;

    if (loading) {
        return <div className="page-loading">Loading payroll data…</div>;
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Payroll</h1>
                    <p className="page-subtitle">
                        Salary, bank, and government ID records already on file — read-only, for transparency. Not connected to any outside payroll processor.
                    </p>
                </div>
            </div>

            {error && <div className="login-error">Could not load payroll data: {error}</div>}

            <div className="page-kpi-row">
                <div className="page-kpi-card navy">
                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Headcount</div>
                    <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{employees.length}</div>
                </div>
                <div className="page-kpi-card teal">
                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Total Monthly Payroll</div>
                    <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{money(totalMonthlyPayroll)}</div>
                </div>
                <div className="page-kpi-card orange">
                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Average Salary</div>
                    <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{money(avgSalary)}</div>
                </div>
                <div className="page-kpi-card green">
                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Departments</div>
                    <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{deptCount}</div>
                </div>
            </div>

            {missingSalaryCount > 0 && (
                <p style={{ fontSize: 12.5, color: '#a0aec0', fontStyle: 'italic', marginTop: -14, marginBottom: 18 }}>
                    {missingSalaryCount} of {employees.length} employees have no salary on file — excluded from the totals above.
                </p>
            )}

            <div className="search-filter-bar">
                <div className="search-input-wrap">
                    <span className="search-icon"><Icon name="search" size={15} /></span>
                    <input
                        className="search-input"
                        type="text"
                        placeholder="Search by name, ID, department, position, bank…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="table-card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Employee ID</th>
                            <th>Name</th>
                            <th>Department</th>
                            <th>Position</th>
                            <th>Salary</th>
                            <th>Bank</th>
                            <th>Bank Account</th>
                            <th>SSS No.</th>
                            <th>PhilHealth No.</th>
                            <th>HDMF No.</th>
                            <th>TIN</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0', fontStyle: 'italic' }}>
                                    {employees.length === 0 ? 'No employee records found.' : 'No records match your search.'}
                                </td>
                            </tr>
                        ) : filtered.map(e => (
                            <tr key={e.id || e.emp_id} className="table-row">
                                <td style={{ fontWeight: 600, color: '#1a202c' }}>{dash(e.emp_id)}</td>
                                <td>{[e.last_name, e.first_name].filter(Boolean).join(', ') || '—'}</td>
                                <td>{dash(e.department)}</td>
                                <td>{dash(e.position)}</td>
                                <td style={{ fontWeight: 600 }}>{money(e.salary)}</td>
                                <td>{dash(e.bank_name)}</td>
                                <td>{dash(e.bank_account)}</td>
                                <td>{dash(e.sss_number)}</td>
                                <td>{dash(e.philhealth_number)}</td>
                                <td>{dash(e.hdmf_number)}</td>
                                <td>{dash(e.tin_number)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
