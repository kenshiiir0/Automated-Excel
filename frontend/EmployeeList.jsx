import React, { useState, useEffect, useMemo, useRef } from 'react';
import EmployeeDetailModal from './src/components/EmployeeDetailModal.jsx';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { useAuth } from './authContext.jsx';
import { exportRowsToExcel, todayStamp } from './exportToExcel.js';
import ExportConfirmModal from './ExportConfirmModal.jsx';

// Column order/labels for the exported file -- mirrors the on-screen
// table columns (see the <thead> below) plus a couple of fields that
// don't fit in the table itself (phone, full hire date) but are useful
// in a spreadsheet. format() lets a column combine fields (name) or
// reformat a raw value (date) without reshaping the row data first.
const EMPLOYEE_EXPORT_COLUMNS = [
  { header: 'Employee ID', key: 'emp_id' },
  { header: 'First Name', key: 'first_name' },
  { header: 'Last Name', key: 'last_name' },
  { header: 'Department', key: 'department' },
  { header: 'Position', key: 'position' },
  { header: 'Classification', key: 'employment_classification' },
  { header: 'Status', key: 'employment_status' },
  {
    header: 'Hire Date',
    key: 'hire_date',
    format: (row) => row.hire_date ? new Date(row.hire_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
  },
  { header: 'Email', key: 'email' },
  { header: 'Phone', key: 'phone' },
];

const STATUS_COLORS = {
  Active: { bg: '#e6f4ea', color: '#137333', dot: '#34a853' },
  Inactive: { bg: '#fce8e6', color: '#c5221f', dot: '#ea4335' },
  Probationary: { bg: '#fff3e0', color: '#e65100', dot: '#fb8c00' },
  Resigned: { bg: '#f3e5f5', color: '#6a1b9a', dot: '#9c27b0' },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: '#edf2f7', color: '#4a5568', dot: '#a0aec0' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, padding: '3px 10px',
      borderRadius: 12, letterSpacing: 0.3, whiteSpace: 'nowrap'
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {status || 'Unknown'}
    </span>
  );
}

// Small red flag badge shown next to a name when the record is missing a
// core field (department, position, hire date, etc.). Hovering shows
// exactly which fields are missing, so HR can go fix the source record
// instead of the person just silently having gaps.
function IncompleteBadge({ missingFields }) {
  return (
    <span
      className="incomplete-badge"
      title={missingFields ? `Missing: ${missingFields}` : 'Missing some details'}
    >
      <Icon name="alertTriangle" size={12} /> Incomplete
    </span>
  );
}

function ClassBadge({ cls }) {
  const isRegular = cls === 'Regular';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 10, letterSpacing: 0.3,
      background: isRegular ? '#e3f2fd' : '#fff8e1',
      color: isRegular ? '#1565c0' : '#f57f17',
    }}>
      {cls || '—'}
    </span>
  );
}

// Three-dot row-actions menu: currently just 'View Details'. Delete was
// removed from the interface (kept as a dropdown, not a plain button, so
// any future row actions have a place to live without a redesign) --
// closes itself on an outside click or Escape so it never lingers open
// when the user clicks elsewhere.
function RowActionsMenu({ onView }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  // The table card clips overflow (for its rounded corners), so a plain
  // absolutely-positioned dropdown would get cut off on rows near the
  // bottom of the table. Instead we position it as position:fixed using
  // the trigger button's own screen coordinates, anchored to the button's
  // bottom-right corner, so it always renders on top of everything.
  const toggleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', () => setOpen(false), true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', () => setOpen(false), true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="row-actions-trigger"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
      >
        ⋮
      </button>
      {open && (
        <div
          ref={dropdownRef}
          className="row-actions-dropdown"
          role="menu"
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
        >
          <button
            className="row-actions-item"
            role="menuitem"
            onClick={() => { setOpen(false); onView(); }}
          >
            <Icon name="eye" size={14} /> View Details
          </button>
        </div>
      )}
    </>
  );
}

const EMPTY_FORM = {
  emp_id: '', first_name: '', last_name: '', middle_name: '',
  email: '', personal_email: '', zoho_email: '', phone: '',
  date_of_birth: '', gender: '', marital_status: '', citizenship: '',
  complete_address: '',
  department: '', position: '', new_designation: '', position_category: '',
  employment_status: 'Active', employment_classification: 'Probationary',
  employment_contract_status: '', work_arrangement: '', territory: '',
  reporting_to: '', hire_date: '', regularization_date: '', exit_date: '',
  job_description: '', company_rules: '',
  salary: '', bank_name: '', bank_account: '',
  sss_number: '', philhealth_number: '', hdmf_number: '', tin_number: '',
  company_issued_no: '', issued_equipment: '',
  emergency_contact_person: '', relationship: '', emergency_contact_details: '',
};

export default function EmployeeList({ visible } = {}) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'super_admin';

  const [showForm, setShowForm] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [otherFields, setOtherFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedEmpId, setSelectedEmpId] = useState(null);

  // Search & filter state
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [filterClass, setFilterClass] = useState('All');
  const [filterCompleteness, setFilterCompleteness] = useState('All');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => { fetchEmployees(); }, []);

  // Kept-alive pages only mount once per session (see App.jsx), so this
  // page would otherwise never see data changed elsewhere while you were
  // on another tab. Quietly re-fetch whenever this page becomes visible
  // again -- skips the very first mount (already covered above) and
  // never touches any in-progress form state (Add Employee modal, typed
  // fields, etc.), which all lives in this component untouched by a
  // background refetch.
  const isFirstVisible = useRef(true);
  useEffect(() => {
    if (visible === undefined) return; // not running under the keep-alive wrapper
    if (isFirstVisible.current) { isFirstVisible.current = false; return; }
    if (visible) fetchEmployees();
  }, [visible]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {};
      for (const [key, value] of Object.entries(formData)) {
        payload[key] = value === '' ? null : value;
      }

      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const newEmp = await res.json();
      if (!res.ok) {
        throw new Error(newEmp?.error || 'Could not add this employee.');
      }
      setEmployees([newEmp, ...employees]);
      setFormData(EMPTY_FORM);
      setOtherFields({});
      setShowForm(false);
      showToast(`${formData.first_name} ${formData.last_name} added successfully!`);
    } catch (err) {
      showToast(err.message || 'Failed to add employee.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Derive unique departments for filter dropdown
  const departments = useMemo(() => {
    const depts = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();
    return depts;
  }, [employees]);

  const positions = useMemo(() =>
    [...new Set(employees.map(e => e.position).filter(Boolean))].sort()
  , [employees]);
  const positionCategories = useMemo(() =>
    [...new Set(employees.map(e => e.position_category).filter(Boolean))].sort()
  , [employees]);

  // Filtered + searched list. Incomplete records (missing a core field like
  // department or hire date) are always sorted to the top of whatever the
  // current filter/search turns up, so gaps in the data stay visible
  // instead of getting buried among 300+ complete records.
  const filtered = useMemo(() => {
    const matched = employees.filter(emp => {
      const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || name.includes(q) ||
        (emp.emp_id || '').toLowerCase().includes(q) ||
        (emp.position || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q);
      const matchStatus = filterStatus === 'All' || emp.employment_status === filterStatus;
      const matchDept = filterDept === 'All' || emp.department === filterDept;
      const matchClass = filterClass === 'All' || emp.employment_classification === filterClass;
      const isIncomplete = emp.is_incomplete === true || emp.is_incomplete === 'TRUE' || emp.is_incomplete === 'true';
      const matchCompleteness =
        filterCompleteness === 'All' ||
        (filterCompleteness === 'Incomplete' && isIncomplete) ||
        (filterCompleteness === 'Complete' && !isIncomplete);
      return matchSearch && matchStatus && matchDept && matchClass && matchCompleteness;
    });

    return [...matched].sort((a, b) => {
      const aIncomplete = a.is_incomplete === true || a.is_incomplete === 'TRUE' || a.is_incomplete === 'true';
      const bIncomplete = b.is_incomplete === true || b.is_incomplete === 'TRUE' || b.is_incomplete === 'true';
      if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
      return (a.last_name || '').localeCompare(b.last_name || '');
    });
  }, [employees, search, filterStatus, filterDept, filterClass, filterCompleteness]);

  // Whenever the search/filter criteria change, jump back to page 1 so the
  // user never lands on a now-empty page after narrowing the results.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, filterDept, filterClass, filterCompleteness]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const activeCount = employees.filter(e => e.employment_status === 'Active').length;
  const regularCount = employees.filter(e => e.employment_classification === 'Regular').length;
  const probCount = employees.filter(e => e.employment_classification === 'Probationary').length;
  const incompleteCount = employees.filter(e => e.is_incomplete === true || e.is_incomplete === 'TRUE' || e.is_incomplete === 'true').length;

  const field = (label, key, type = 'text', opts = {}) => {
    if (opts.dropdownOr) {
      const isOther = otherFields[key];
      const knownOptions = opts.dropdownOr;
      const currentValueIsKnown = knownOptions.includes(formData[key]);
      return (
        <div className="emp-form-group">
          <label className="emp-form-label">{label}{opts.required && <span style={{ color: '#e53e3e' }}> *</span>}</label>
          <select
            className="emp-form-input"
            value={isOther ? 'OTHER' : (currentValueIsKnown ? formData[key] : '')}
            onChange={e => {
              if (e.target.value === 'OTHER') {
                setOtherFields({ ...otherFields, [key]: true });
                setFormData({ ...formData, [key]: '' });
              } else {
                setOtherFields({ ...otherFields, [key]: false });
                setFormData({ ...formData, [key]: e.target.value });
              }
            }}
            required={opts.required && !isOther}
          >
            <option value="" disabled>Select {label.toLowerCase()}…</option>
            {knownOptions.map(o => <option key={o} value={o}>{o}</option>)}
            <option value="OTHER">Other (type manually)</option>
          </select>
          {isOther && (
            <input
              className="emp-form-input"
              style={{ marginTop: 8 }}
              type="text"
              placeholder={`Type the ${label.toLowerCase()}…`}
              value={formData[key]}
              onChange={e => setFormData({ ...formData, [key]: e.target.value })}
              required={opts.required}
              autoFocus
            />
          )}
        </div>
      );
    }

    if (opts.textarea) {
      return (
        <div className="emp-form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="emp-form-label">{label}{opts.required && <span style={{ color: '#e53e3e' }}> *</span>}</label>
          <textarea
            className="emp-form-input"
            style={{ minHeight: '70px' }}
            placeholder={opts.placeholder || label}
            value={formData[key]}
            onChange={e => setFormData({ ...formData, [key]: e.target.value })}
            required={opts.required}
          />
        </div>
      );
    }

    return (
      <div className="emp-form-group">
        <label className="emp-form-label">{label}{opts.required && <span style={{ color: '#e53e3e' }}> *</span>}</label>
        {opts.select ? (
          <select
            className="emp-form-input"
            value={formData[key]}
            onChange={e => setFormData({ ...formData, [key]: e.target.value })}
            required={opts.required}
          >
            {opts.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            className="emp-form-input"
            type={type}
            placeholder={opts.placeholder || label}
            value={formData[key]}
            onChange={e => setFormData({ ...formData, [key]: e.target.value })}
            required={opts.required}
          />
        )}
      </div>
    );
  };

  return (
    <div className="page-container">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Directory</h1>
          <p className="page-subtitle">Manage and view all employee records</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowExportConfirm(true)}
            disabled={filtered.length === 0}
            title="Exports exactly what's currently shown -- your search and filters apply"
          >
            <Icon name="download" size={14} /> Export to Excel
          </button>
          {canWrite && (
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Add Employee
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="page-kpi-row">
        <div className="page-kpi-card navy">
          <div className="page-kpi-val">{employees.length}</div>
          <div className="page-kpi-lbl">Total Records</div>
        </div>
        <div className="page-kpi-card teal">
          <div className="page-kpi-val">{activeCount}</div>
          <div className="page-kpi-lbl">Active</div>
        </div>
        <div className="page-kpi-card orange">
          <div className="page-kpi-val">{regularCount}</div>
          <div className="page-kpi-lbl">Regular</div>
        </div>
        <div className="page-kpi-card green">
          <div className="page-kpi-val">{probCount}</div>
          <div className="page-kpi-lbl">Probationary</div>
        </div>
        <div
          className="page-kpi-card red"
          style={{ cursor: incompleteCount > 0 ? 'pointer' : 'default' }}
          onClick={() => incompleteCount > 0 && setFilterCompleteness('Incomplete')}
          title={incompleteCount > 0 ? 'Click to show only incomplete records' : undefined}
        >
          <div className="page-kpi-val">{incompleteCount}</div>
          <div className="page-kpi-lbl">Incomplete Records</div>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showForm && canWrite && (
        <Modal title="New Employee Record" onClose={() => setShowForm(false)}>
          <form onSubmit={handleAddEmployee}>
            <div className="emp-detail-section-title">Basic Info</div>
            <div className="emp-form-grid">
              {field('Employee ID', 'emp_id', 'text', { required: true })}
              {field('First Name', 'first_name', 'text', { required: true })}
              {field('Last Name', 'last_name', 'text', { required: true })}
              {field('Middle Name', 'middle_name', 'text')}
              {field('Work Email', 'email', 'email')}
              {field('Personal Email', 'personal_email', 'email')}
              {field('Zoho Email', 'zoho_email', 'email')}
              {field('Phone', 'phone', 'tel')}
              {field('Date of Birth', 'date_of_birth', 'date')}
              {field('Gender', 'gender', 'text', {
                select: true, options: ['', 'Male', 'Female', 'Other']
              })}
              {field('Marital Status', 'marital_status', 'text', {
                select: true, options: ['', 'Single', 'Married', 'Widowed', 'Separated']
              })}
              {field('Citizenship', 'citizenship', 'text', { placeholder: 'e.g. Filipino' })}
            </div>
            {field('Complete Address', 'complete_address', 'text', { textarea: true })}

            <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Work Info</div>
            <div className="emp-form-grid">
              {field('Department', 'department', 'text', { required: true, dropdownOr: departments })}
              {field('Position', 'position', 'text', { required: true, dropdownOr: positions })}
              {field('New Designation', 'new_designation', 'text')}
              {field('Position Category', 'position_category', 'text', { dropdownOr: positionCategories })}
              {field('Employment Status', 'employment_status', 'text', {
                select: true, options: ['Active', 'Inactive', 'Resigned']
              })}
              {field('Classification', 'employment_classification', 'text', {
                select: true, options: ['Probationary', 'Regular']
              })}
              {field('Contract Status', 'employment_contract_status', 'text')}
              {field('Work Arrangement', 'work_arrangement', 'text', {
                select: true, options: ['', 'Onsite', 'Hybrid', 'Remote']
              })}
              {field('Territory', 'territory', 'text')}
              {field('Reporting To', 'reporting_to', 'text', { placeholder: 'Manager / supervisor name' })}
              {field('Hire Date', 'hire_date', 'date', { required: true })}
              {field('Regularization Date', 'regularization_date', 'date')}
              {field('Exit Date', 'exit_date', 'date')}
            </div>
            {field('Job Description', 'job_description', 'text', { textarea: true })}
            {field('Company Rules Acknowledged', 'company_rules', 'text', { textarea: true })}

            <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Compensation</div>
            <div className="emp-form-grid">
              {field('Salary', 'salary', 'number')}
              {field('Bank Name', 'bank_name', 'text')}
              {field('Bank Account', 'bank_account', 'text')}
            </div>

            <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Government IDs</div>
            <div className="emp-form-grid">
              {field('SSS Number', 'sss_number', 'text')}
              {field('PhilHealth', 'philhealth_number', 'text')}
              {field('Pag-IBIG (HDMF)', 'hdmf_number', 'text')}
              {field('TIN', 'tin_number', 'text')}
            </div>

            <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Company Property</div>
            <div className="emp-form-grid">
              {field('Company-Issued No.', 'company_issued_no', 'text')}
              {field('Issued Equipment', 'issued_equipment', 'text')}
            </div>

            <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Emergency Contact</div>
            <div className="emp-form-grid">
              {field('Contact Person', 'emergency_contact_person', 'text')}
              {field('Relationship', 'relationship', 'text')}
              {field('Contact Details', 'emergency_contact_details', 'text')}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add Employee'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showExportConfirm && (
        <ExportConfirmModal
          itemLabel="employee"
          filteredCount={filtered.length}
          totalCount={employees.length}
          onClose={() => setShowExportConfirm(false)}
          onConfirm={() => {
            exportRowsToExcel(
              filtered,
              EMPLOYEE_EXPORT_COLUMNS,
              { fileName: `employees_${todayStamp()}.xlsx`, sheetName: 'Employees' }
            );
            setShowExportConfirm(false);
          }}
        />
      )}

      {/* Search & Filters */}
      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <span className="search-icon"><Icon name="search" size={15} /></span>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, ID, position, department, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Resigned">Resigned</option>
        </select>
        <select className="filter-select" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="All">All Classification</option>
          <option value="Regular">Regular</option>
          <option value="Probationary">Probationary</option>
        </select>
        <select className="filter-select" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="filter-select" value={filterCompleteness} onChange={e => setFilterCompleteness(e.target.value)}>
          <option value="All">All Records</option>
          <option value="Incomplete">Incomplete Only</option>
          <option value="Complete">Complete Only</option>
        </select>
        <span className="results-count">{filtered.length} of {employees.length}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Position</th>
                <th>Classification</th>
                <th>Status</th>
                <th>Hire Date</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(7)].map((_, i) => (
                <tr key={i} className="table-row skeleton-tr">
                  <td><div className="skeleton" style={{ width: '55px', height: '18px', borderRadius: '4px' }}></div></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="skeleton skeleton-circle" style={{ width: 34, height: 34 }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="skeleton skeleton-text" style={{ width: '130px', height: '14px', marginBottom: '4px' }}></div>
                        <div className="skeleton skeleton-text" style={{ width: '80px', height: '10px' }}></div>
                      </div>
                    </div>
                  </td>
                  <td><div className="skeleton skeleton-text" style={{ width: '110px', height: '13px' }}></div></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '140px', height: '13px' }}></div></td>
                  <td><div className="skeleton" style={{ width: '70px', height: '18px', borderRadius: '10px' }}></div></td>
                  <td><div className="skeleton" style={{ width: '65px', height: '18px', borderRadius: '12px' }}></div></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '80px', height: '12px' }}></div></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '130px', height: '12px' }}></div></td>
                  <td><div style={{ display: 'flex', gap: 6 }}><div className="skeleton" style={{ width: '40px', height: '22px', borderRadius: '6px' }}></div><div className="skeleton" style={{ width: '45px', height: '22px', borderRadius: '6px' }}></div></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Position</th>
                <th>Classification</th>
                <th>Status</th>
                <th>Hire Date</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0', fontStyle: 'italic' }}>
                    No employees match your search.
                  </td>
                </tr>
              ) : paginated.map(emp => (
                <tr key={emp.id || emp.emp_id} className="table-row">
                  <td><span className="emp-id-badge">{emp.emp_id}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar">
                        {(emp.first_name?.[0] || '?')}{(emp.last_name?.[0] || '')}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1a202c', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {emp.first_name} {emp.last_name}
                          {(emp.is_incomplete === true || emp.is_incomplete === 'TRUE' || emp.is_incomplete === 'true') && (
                            <IncompleteBadge missingFields={emp.missing_fields} />
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: '#4a5568' }}>{emp.department || '—'}</td>
                  <td style={{ fontSize: 12, color: '#718096' }}>{emp.position || '—'}</td>
                  <td><ClassBadge cls={emp.employment_classification} /></td>
                  <td><StatusBadge status={emp.employment_status} /></td>
                  <td style={{ fontSize: 12, color: '#718096' }}>
                    {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: '#718096' }}>{emp.email || '—'}</td>
                  <td>
                    <RowActionsMenu
                      onView={() => setSelectedEmpId(emp.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {!loading && filtered.length > 0 && (
        <div className="pagination-bar">
          <span className="pagination-summary">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}
            {'-'}
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ‹ Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('ellipsis-' + p);
                acc.push(p);
                return acc;
              }, [])
              .map(p =>
                typeof p === 'string' ? (
                  <span key={p} className="pagination-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    className={`pagination-btn${p === currentPage ? ' active' : ''}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next ›
            </button>
          </div>
        </div>
      )}

      {/* Employee Detail Modal */}
      {selectedEmpId !== null && (
        <EmployeeDetailModal
          employeeId={selectedEmpId}
          onClose={() => setSelectedEmpId(null)}
          onUpdated={(updated) => {
            setEmployees(prev => prev.map(e => (e.id === updated.id ? { ...e, ...updated } : e)));
          }}
          onDeleted={(deletedId) => {
            setEmployees(prev => prev.filter(e => e.id !== deletedId));
          }}
        />
      )}
    </div>
  );
}