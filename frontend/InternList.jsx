import React, { useState, useEffect, useMemo } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { useAuth } from './authContext.jsx';
import { exportRowsToExcel, todayStamp } from './exportToExcel.js';
import ExportConfirmModal from './ExportConfirmModal.jsx';

// Mirrors the on-screen table columns -- see the <thead> further down.
const INTERN_EXPORT_COLUMNS = [
  { header: 'First Name', key: 'first_name' },
  { header: 'Last Name', key: 'last_name' },
  { header: 'Department', key: 'department' },
  { header: 'School', key: 'school' },
  { header: 'Contact No.', key: 'contact_no' },
  { header: 'Email', key: 'email' },
  {
    header: 'Birthday',
    key: 'birthday',
    format: (row) => row.birthday ? new Date(row.birthday).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
  },
  {
    header: 'Hire Date',
    key: 'hire_date',
    format: (row) => row.hire_date ? new Date(row.hire_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
  },
  { header: 'Address', key: 'address' },
];

const EMPTY_FORM = {
  last_name: '', first_name: '', middle_name: '', middle_initial: '',
  hire_date: '', birthday: '', address: '', contact_no: '', email: '',
  school: '', department: ''
};

export default function InternList() {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'super_admin';

  const [showForm, setShowForm] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [otherFields, setOtherFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterSchool, setFilterSchool] = useState('All');

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => { fetchInterns(); }, []);

  const fetchInterns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/interns');
      const data = await res.json();
      setInterns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching interns:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);

  // "Delete" in this system always archives -- nothing is ever hard-deleted.
  // The record disappears from this list but stays fully intact and can be
  // brought back from History.
  const handleArchive = async (intern) => {
    setArchivingId(intern.id);
    try {
      const res = await fetch(`/api/interns/${intern.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not archive this intern.');
      setInterns(prev => prev.filter(i => i.id !== intern.id));
      showToast(`${intern.first_name} ${intern.last_name} archived. Restore anytime from History.`);
    } catch (err) {
      showToast(err.message || 'Failed to archive intern.', 'error');
    } finally {
      setArchivingId(null);
      setConfirmArchiveId(null);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...formData, complete_name: `${formData.last_name}, ${formData.first_name}` };
      for (const key of Object.keys(payload)) {
        if (payload[key] === '') payload[key] = null;
      }

      const res = await fetch('/api/interns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const newIntern = await res.json();
      if (!res.ok) {
        throw new Error(newIntern?.error || 'Could not add this intern.');
      }
      setInterns([newIntern, ...interns]);
      setFormData(EMPTY_FORM);
      setOtherFields({});
      setShowForm(false);
      showToast(`${formData.first_name} ${formData.last_name} added.`);
    } catch (err) {
      showToast(err.message || 'Failed to add intern.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const departments = useMemo(() =>
    [...new Set(interns.map(i => i.department).filter(Boolean))].sort()
  , [interns]);

  const schools = useMemo(() =>
    [...new Set(interns.map(i => i.school).filter(Boolean))].sort()
  , [interns]);

  const filtered = useMemo(() => {
    return interns.filter(i => {
      const name = `${i.first_name || ''} ${i.last_name || ''}`.toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || name.includes(q) ||
        (i.school || '').toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q);
      const matchDept = filterDept === 'All' || i.department === filterDept;
      const matchSchool = filterSchool === 'All' || i.school === filterSchool;
      return matchSearch && matchDept && matchSchool;
    });
  }, [interns, search, filterDept, filterSchool]);

  useEffect(() => { setCurrentPage(1); }, [search, filterDept, filterSchool]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

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

    return (
      <div className="emp-form-group">
        <label className="emp-form-label">{label}{opts.required && <span style={{ color: '#e53e3e' }}> *</span>}</label>
        <input
          className="emp-form-input"
          type={type}
          placeholder={opts.placeholder || label}
          value={formData[key]}
          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          required={opts.required}
        />
      </div>
    );
  };

  return (
    <div className="page-container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">Intern Masterfile</h1>
          <p className="page-subtitle">All intern records on file, across every school and department</p>
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
              + Add Intern
            </button>
          )}
        </div>
      </div>

      <div className="page-kpi-row">
        <div className="page-kpi-card navy">
          <div className="page-kpi-val">{interns.length}</div>
          <div className="page-kpi-lbl">Total Interns</div>
        </div>
        <div className="page-kpi-card teal">
          <div className="page-kpi-val">{departments.length}</div>
          <div className="page-kpi-lbl">Departments</div>
        </div>
        <div className="page-kpi-card orange">
          <div className="page-kpi-val">{schools.length}</div>
          <div className="page-kpi-lbl">Schools</div>
        </div>
      </div>

      {showForm && canWrite && (
        <Modal title="New Intern Record" onClose={() => setShowForm(false)}>
          <form onSubmit={handleAdd}>
            <div className="emp-form-grid">
              {field('Last Name', 'last_name', 'text', { required: true })}
              {field('First Name', 'first_name', 'text', { required: true })}
              {field('Middle Name', 'middle_name')}
              {field('Middle Initial', 'middle_initial')}
              {field('Hire Date', 'hire_date', 'date')}
              {field('Birthday', 'birthday', 'date')}
              {field('Address', 'address')}
              {field('Contact No.', 'contact_no', 'tel')}
              {field('Email', 'email', 'email')}
              {field('School', 'school', 'text', { dropdownOr: schools })}
              {field('Department', 'department', 'text', { dropdownOr: departments })}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add Intern'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showExportConfirm && (
        <ExportConfirmModal
          itemLabel="intern"
          filteredCount={filtered.length}
          totalCount={interns.length}
          onClose={() => setShowExportConfirm(false)}
          onConfirm={() => {
            exportRowsToExcel(
              filtered,
              INTERN_EXPORT_COLUMNS,
              { fileName: `interns_${todayStamp()}.xlsx`, sheetName: 'Interns' }
            );
            setShowExportConfirm(false);
          }}
        />
      )}

      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <span className="search-icon"><Icon name="search" size={15} /></span>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, school, or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <select className="filter-select" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="filter-select" value={filterSchool} onChange={e => setFilterSchool(e.target.value)}>
          <option value="All">All Schools</option>
          {schools.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="results-count">{filtered.length} of {interns.length}</span>
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>School</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Birthday</th>
              {canWrite && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={canWrite ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0', fontStyle: 'italic' }}>
                  No intern records match your search.
                </td>
              </tr>
            ) : paginated.map(i => (
              <tr key={i.id} className="table-row">
                <td style={{ fontWeight: 600, fontSize: 13, color: '#1a202c' }}>
                  {i.first_name} {i.last_name}
                </td>
                <td style={{ fontSize: 13, color: '#4a5568' }}>{i.department || 'Nothing to show yet'}</td>
                <td style={{ fontSize: 12, color: '#718096' }}>{i.school || 'Nothing to show yet'}</td>
                <td style={{ fontSize: 12 }}>
                  {i.contact_no
                    ? <a href={`tel:${i.contact_no}`} style={{ color: '#1D9FDA', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="phone" size={12} /> {i.contact_no}</a>
                    : <span style={{ color: '#a0aec0' }}>Nothing to show yet</span>}
                </td>
                <td style={{ fontSize: 12 }}>
                  {i.email
                    ? <a href={`mailto:${i.email}`} style={{ color: '#1D9FDA', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="mail" size={12} /> {i.email}</a>
                    : <span style={{ color: '#a0aec0' }}>Nothing to show yet</span>}
                </td>
                <td style={{ fontSize: 12, color: '#718096' }}>
                  {i.birthday ? new Date(i.birthday).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Nothing to show yet'}
                </td>
                {canWrite && (
                  <td>
                    {confirmArchiveId === i.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn-danger-sm"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          disabled={archivingId === i.id}
                          onClick={() => handleArchive(i)}
                        >
                          {archivingId === i.id ? 'Archiving…' : 'Confirm'}
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          disabled={archivingId === i.id}
                          onClick={() => setConfirmArchiveId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="emp-detail-action-btn delete"
                        title="Archive this intern record"
                        onClick={() => setConfirmArchiveId(i.id)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="pagination-bar">
          <span className="pagination-summary">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="pagination-controls">
            <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹ Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('ellipsis-' + p);
                acc.push(p);
                return acc;
              }, [])
              .map(p => typeof p === 'string'
                ? <span key={p} className="pagination-ellipsis">…</span>
                : <button key={p} className={`pagination-btn${p === currentPage ? ' active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
              )}
            <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
