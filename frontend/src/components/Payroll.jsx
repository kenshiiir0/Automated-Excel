import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../Icon.jsx';
import CustomSelect from '../../CustomSelect.jsx';

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

// Partial mask: reveal only the FIRST DIGIT of the value (for a money
// value like "₱35,000.00" that means keeping the "₱" prefix -- not a
// digit itself -- plus the "3", nothing more), then a fixed, uniform
// 6-character run of dots for everything after it, regardless of how
// long the real value actually is. Fixed-length on purpose: mirroring
// the real length would leak how many digits follow (e.g. a 5-digit vs.
// 7-digit salary), which is exactly what masking is meant to hide.
// Hovering (or keyboard focus, so this is reachable without a mouse)
// swaps in the real full value.
const MASK_TAIL = '••••••';

function maskTail(display) {
    const firstDigitIndex = display.search(/[0-9]/);
    if (firstDigitIndex === -1) return display; // no digit in here at all (e.g. "—") -- nothing to mask
    return display.slice(0, firstDigitIndex + 1) + MASK_TAIL;
}

// Salary, bank account, and the four gov't ID numbers use this: a
// permanent partial mask sitting in the table, revealed only in a small
// popup the user explicitly clicks open -- not on hover. Hover would show
// the real value just by someone's cursor passing over the row (e.g.
// while scrolling past on a shared screen); requiring a deliberate click
// makes each reveal an intentional action, and the popup closes itself
// again on an outside click, Escape, or leaving the page/tab.
//
// The popup is portaled to document.body rather than rendered as a normal
// child, positioned from the trigger's live bounding rect -- same
// reasoning as CustomSelect.jsx's dropdown panel: a normal child would get
// clipped by .table-card's overflow-x: auto the moment it extended past
// the card's edge. z-index: 1200 matches .custom-select-panel-portal, one
// level above .modal-overlay's 1100, so this still renders correctly if
// this page is ever reached from inside a modal.
function MaskedValue({ value, formatter, label }) {
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState(null);
    const triggerRef = useRef(null);
    const popupRef = useRef(null);

    const isEmpty = value === null || value === undefined || value === '';
    const display = isEmpty ? '—' : (formatter ? formatter(value) : String(value));

    const computeRect = useCallback(() => {
        if (!triggerRef.current) return;
        const r = triggerRef.current.getBoundingClientRect();
        setRect({ top: r.bottom + 6, left: r.left });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        computeRect();
    }, [open, computeRect]);

    useEffect(() => {
        if (!open) return;
        const handleOutside = (e) => {
            if (triggerRef.current?.contains(e.target)) return;
            if (popupRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const handleReposition = () => computeRect();
        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('keydown', handleKey);
        window.addEventListener('scroll', handleReposition, true);
        window.addEventListener('resize', handleReposition);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('keydown', handleKey);
            window.removeEventListener('scroll', handleReposition, true);
            window.removeEventListener('resize', handleReposition);
        };
    }, [open, computeRect]);

    if (isEmpty) return <span>—</span>;

    return (
        <>
            <span
                ref={triggerRef}
                role="button"
                tabIndex={0}
                onClick={() => setOpen(o => !o)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
                style={{
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    letterSpacing: '1px',
                    color: open ? '#1D9FDA' : '#a0aec0',
                    outline: 'none',
                    borderBottom: '1px dashed #cbd5e0',
                }}
                title="Click to reveal"
            >
                {maskTail(display)}
            </span>
            {open && rect && createPortal(
                <div
                    ref={popupRef}
                    className="payroll-reveal-popup"
                    style={{ top: rect.top, left: rect.left }}
                >
                    {label && <div className="payroll-reveal-popup-label">{label}</div>}
                    <div className="payroll-reveal-popup-value">{display}</div>
                </div>,
                document.body
            )}
        </>
    );
}

export default function Payroll({ visible } = {}) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('All');
    const [filterPosition, setFilterPosition] = useState('All');
    const [filterBank, setFilterBank] = useState('All');
    const [filterSalary, setFilterSalary] = useState('All');

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

    // Dropdown option lists, derived from whatever's actually on file --
    // same pattern as EmployeeList.jsx's departments/positions useMemo, so
    // a department or bank name that's never been entered doesn't show up
    // as a selectable-but-always-empty option. Not offered as filters:
    // Bank Account / SSS / PhilHealth / HDMF / TIN -- those are unique
    // per-person identifiers, so a dropdown of hundreds of individual
    // numbers isn't a meaningful filter; the search box already covers
    // "find this specific person by an ID" lookups.
    const departments = useMemo(() =>
        [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees]);
    const positions = useMemo(() =>
        [...new Set(employees.map(e => e.position).filter(Boolean))].sort(), [employees]);
    const banks = useMemo(() =>
        [...new Set(employees.map(e => e.bank_name).filter(Boolean))].sort(), [employees]);

    // Only active, non-archived employees come back from GET /api/employees
    // by default (see employeeController.js), so this list is already
    // "current headcount" -- no separate status filter needed here.
    const q = search.trim().toLowerCase();
    const filtered = employees.filter(e => {
        if (q) {
            const hay = [e.emp_id, e.first_name, e.last_name, e.department, e.position, e.bank_name]
                .filter(Boolean).join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        if (filterDept !== 'All' && e.department !== filterDept) return false;
        if (filterPosition !== 'All' && e.position !== filterPosition) return false;
        if (filterBank !== 'All' && e.bank_name !== filterBank) return false;
        if (filterSalary !== 'All') {
            const hasSalary = e.salary !== null && e.salary !== undefined && e.salary !== '' && !Number.isNaN(Number(e.salary));
            if (filterSalary === 'Has' && !hasSalary) return false;
            if (filterSalary === 'Missing' && hasSalary) return false;
        }
        return true;
    });

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
                    {search && (
                        <button className="search-clear" onClick={() => setSearch('')}>✕</button>
                    )}
                </div>
                <CustomSelect
                    className="filter-select"
                    value={filterDept}
                    onChange={setFilterDept}
                    options={[{ value: 'All', label: 'All Departments' }, ...departments.map(d => ({ value: d, label: d }))]}
                />
                <CustomSelect
                    className="filter-select"
                    value={filterPosition}
                    onChange={setFilterPosition}
                    options={[{ value: 'All', label: 'All Positions' }, ...positions.map(p => ({ value: p, label: p }))]}
                />
                <CustomSelect
                    className="filter-select"
                    value={filterBank}
                    onChange={setFilterBank}
                    options={[{ value: 'All', label: 'All Banks' }, ...banks.map(b => ({ value: b, label: b }))]}
                />
                <CustomSelect
                    className="filter-select"
                    value={filterSalary}
                    onChange={setFilterSalary}
                    options={[
                        { value: 'All', label: 'All Records' },
                        { value: 'Has', label: 'Salary on File' },
                        { value: 'Missing', label: 'Missing Salary' },
                    ]}
                />
                <span className="results-count">{filtered.length} of {employees.length}</span>
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
                                <td style={{ fontWeight: 600 }}><MaskedValue value={e.salary} formatter={money} label="Salary" /></td>
                                <td>{dash(e.bank_name)}</td>
                                <td><MaskedValue value={e.bank_account} label="Bank Account" /></td>
                                <td><MaskedValue value={e.sss_number} label="SSS No." /></td>
                                <td><MaskedValue value={e.philhealth_number} label="PhilHealth No." /></td>
                                <td><MaskedValue value={e.hdmf_number} label="HDMF No." /></td>
                                <td><MaskedValue value={e.tin_number} label="TIN" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
