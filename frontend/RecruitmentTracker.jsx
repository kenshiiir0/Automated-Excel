import React, { useState, useEffect, useMemo } from 'react';
import Icon from './Icon.jsx';

const STATUS_META = {
  Open:       { bg: '#fff3e0', color: '#e65100', dot: '#fb8c00' },
  Screening:  { bg: '#e3f2fd', color: '#1565c0', dot: '#1e88e5' },
  Interview:  { bg: '#ede7f6', color: '#4527a0', dot: '#7c4dff' },
  Offer:      { bg: '#e8f5e9', color: '#1b5e20', dot: '#43a047' },
  Hired:      { bg: '#e6f4ea', color: '#137333', dot: '#34a853' },
  Closed:     { bg: '#e6f4ea', color: '#137333', dot: '#34a853' },
  Applied:    { bg: '#e3f2fd', color: '#1565c0', dot: '#1e88e5' },
  Rejected:   { bg: '#fce8e6', color: '#c5221f', dot: '#ea4335' },
  Withdrawn:  { bg: '#f5f5f5', color: '#757575', dot: '#bdbdbd' },
  'For Interview': { bg: '#ede7f6', color: '#4527a0', dot: '#7c4dff' },
};

function getStatusMeta(status = '') {
  // Try exact match first
  if (STATUS_META[status]) return STATUS_META[status];
  const s = status.toLowerCase();
  if (s.includes('closed') || s.includes('hired') || s.includes('onboard')) return STATUS_META.Hired;
  if (s.includes('open')) return STATUS_META.Open;
  if (s.includes('screen')) return STATUS_META.Screening;
  if (s.includes('interview') || s.includes('endorse')) return STATUS_META.Interview;
  if (s.includes('offer')) return STATUS_META.Offer;
  if (s.includes('reject') || s.includes('decline') || s.includes('withdrew')) return STATUS_META.Rejected;
  return { bg: '#f5f5f5', color: '#757575', dot: '#bdbdbd' };
}

function StatusBadge({ status }) {
  const m = getStatusMeta(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: m.bg, color: m.color,
      fontSize: 11, fontWeight: 700, padding: '3px 10px',
      borderRadius: 12, letterSpacing: 0.3, whiteSpace: 'nowrap',
      maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis'
    }} title={status}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, flexShrink: 0, display: 'inline-block' }} />
      {status?.length > 20 ? status.substring(0, 20) + '…' : (status || 'Unknown')}
    </span>
  );
}

const EMPTY_FORM = {
  candidate_name: '', position: '', department: '',
  status: 'Applied', email: '', phone: '', recruiter: '',
  previous_company: '', resume_url: '', remarks: ''
};

export default function RecruitmentTracker() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Search & filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [filterRecruiter, setFilterRecruiter] = useState('All');

  useEffect(() => { fetchCandidates(); }, []);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/candidates');
      const data = await res.json();
      setCandidates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/recruitment/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const newC = await res.json();
      setCandidates([newC, ...candidates]);
      setFormData(EMPTY_FORM);
      setShowForm(false);
      showToast(`${formData.candidate_name} added to pipeline!`);
    } catch (err) {
      showToast('Failed to add candidate.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await fetch(`/api/recruitment/candidates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      setCandidates(candidates.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      showToast('Failed to update status.', 'error');
    }
  };

  // Derive status groups and departments
  const uniqueStatuses = useMemo(() => {
    return [...new Set(candidates.map(c => c.status).filter(Boolean))].sort();
  }, [candidates]);

  const departments = useMemo(() => {
    return [...new Set(candidates.map(c => c.department).filter(Boolean))].sort();
  }, [candidates]);

  const recruiters = useMemo(() => {
    return [...new Set(candidates.map(c => c.recruiter).filter(Boolean))].sort();
  }, [candidates]);

  const recruiterSummary = useMemo(() => {
    const counts = {};
    candidates.forEach(c => {
      const key = c.recruiter || 'Unassigned';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [candidates]);

  // Pipeline summary
  const pipelineSummary = useMemo(() => {
    const counts = {};
    candidates.forEach(c => {
      const key = c.status || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [candidates]);

  const closedCount = candidates.filter(c => {
    const s = (c.status || '').toLowerCase();
    return s.includes('closed') || s.includes('hired') || s.includes('onboard');
  }).length;
  const openCount = candidates.filter(c => (c.status || '').toLowerCase().includes('open')).length;
  const inProcessCount = candidates.filter(c => {
    const s = (c.status || '').toLowerCase();
    return s.includes('interview') || s.includes('screen') || s.includes('endorse');
  }).length;

  // Filtered list
  const filtered = useMemo(() => {
    return candidates.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (c.candidate_name || '').toLowerCase().includes(q) ||
        (c.position || '').toLowerCase().includes(q) ||
        (c.department || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.previous_company || '').toLowerCase().includes(q) ||
        (c.status || '').toLowerCase().includes(q);
      const matchStatus = filterStatus === 'All' || c.status === filterStatus;
      const matchDept = filterDept === 'All' || c.department === filterDept;
      const matchRecruiter = filterRecruiter === 'All' ||
        (filterRecruiter === 'Unassigned' ? !c.recruiter : c.recruiter === filterRecruiter);
      return matchSearch && matchStatus && matchDept && matchRecruiter;
    });
  }, [candidates, search, filterStatus, filterDept, filterRecruiter]);

  const field = (label, key, type = 'text', opts = {}) => (
    <div className="emp-form-group">
      <label className="emp-form-label">{label}{opts.required && <span style={{ color: '#e53e3e' }}> *</span>}</label>
      {opts.select ? (
        <select className="emp-form-input" value={formData[key]}
          onChange={e => setFormData({ ...formData, [key]: e.target.value })}>
          {opts.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input className="emp-form-input" type={type}
          placeholder={opts.placeholder || label}
          value={formData[key]}
          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          required={opts.required}
        />
      )}
    </div>
  );

  return (
    <div className="page-container">
      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Recruitment Pipeline</h1>
          <p className="page-subtitle">Track and manage all active candidates</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Candidate'}
        </button>
      </div>

      {/* KPI Row */}
      <div className="page-kpi-row">
        <div className="page-kpi-card navy">
          <div className="page-kpi-val">{candidates.length}</div>
          <div className="page-kpi-lbl">Total Candidates</div>
        </div>
        <div className="page-kpi-card green">
          <div className="page-kpi-val">{closedCount}</div>
          <div className="page-kpi-lbl">Filled / Closed</div>
        </div>
        <div className="page-kpi-card teal">
          <div className="page-kpi-val">{inProcessCount}</div>
          <div className="page-kpi-lbl">In Process</div>
        </div>
        <div className="page-kpi-card orange">
          <div className="page-kpi-val">{openCount}</div>
          <div className="page-kpi-lbl">Open</div>
        </div>
      </div>

      {/* Pipeline Status Summary */}
      {pipelineSummary.length > 0 && (
        <div className="pipeline-summary-bar">
          {pipelineSummary.map(([status, count]) => {
            const m = getStatusMeta(status);
            return (
              <button
                key={status}
                className={`pipeline-status-pill ${filterStatus === status ? 'active' : ''}`}
                style={{ '--dot': m.dot, '--bg': m.bg, '--clr': m.color }}
                onClick={() => setFilterStatus(filterStatus === status ? 'All' : status)}
                title={`Filter: ${status}`}
              >
                <span className="pipeline-pill-dot" />
                <span className="pipeline-pill-label">{status.length > 18 ? status.substring(0, 18) + '…' : status}</span>
                <span className="pipeline-pill-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* By Recruiter Summary */}
      {recruiterSummary.length > 0 && (
        <div className="pipeline-summary-bar recruiter-summary-bar">
          <span className="recruiter-summary-label">By Recruiter:</span>
          {recruiterSummary.map(([name, count]) => (
            <button
              key={name}
              className={`pipeline-status-pill recruiter-pill ${filterRecruiter === name ? 'active' : ''}`}
              onClick={() => setFilterRecruiter(filterRecruiter === name ? 'All' : name)}
              title={`Filter: ${name}`}
            >
              <span className="pipeline-pill-label">{name}</span>
              <span className="pipeline-pill-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Add Candidate Form */}
      {showForm && (
        <div className="form-card">
          <h2 className="form-card-title">New Candidate</h2>
          <form onSubmit={handleAddCandidate}>
            <div className="emp-form-grid">
              {field('Candidate Name', 'candidate_name', 'text', { required: true })}
              {field('Position Applied', 'position', 'text', { required: true })}
              {field('Department', 'department', 'text')}
              {field('Recruiter', 'recruiter', 'text', { placeholder: 'e.g. Sherwin Villarosa' })}
              {field('Email', 'email', 'email')}
              {field('Phone', 'phone', 'tel')}
              {field('Previous Company', 'previous_company', 'text')}
              {field('Status', 'status', 'text', {
                select: true, options: ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected', 'Withdrawn']
              })}
              {field('Remarks', 'remarks', 'text')}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add Candidate'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filters */}
      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <span className="search-icon"><Icon name="search" size={15} /></span>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, position, department, company, status…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Status</option>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="filter-select" value={filterRecruiter} onChange={e => setFilterRecruiter(e.target.value)}>
          <option value="All">All Recruiters</option>
          {recruiters.map(r => <option key={r} value={r}>{r}</option>)}
          <option value="Unassigned">Unassigned</option>
        </select>
        <span className="results-count">{filtered.length} of {candidates.length}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Candidate</th>
                <th>Position</th>
                <th>Department</th>
                <th>Recruiter</th>
                <th>Previous Company</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Date Added</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(7)].map((_, i) => (
                <tr key={i} className="table-row skeleton-tr">
                  <td><div className="skeleton skeleton-text" style={{ width: '16px', height: '12px' }}></div></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="skeleton skeleton-circle" style={{ width: 34, height: 34 }}></div>
                      <div style={{ flex: 1 }}>
                        <div className="skeleton skeleton-text" style={{ width: '140px', height: '14px', marginBottom: '4px' }}></div>
                        <div className="skeleton skeleton-text" style={{ width: '90px', height: '10px' }}></div>
                      </div>
                    </div>
                  </td>
                  <td><div className="skeleton skeleton-text" style={{ width: '130px', height: '13px' }}></div></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '100px', height: '13px' }}></div></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '100px', height: '13px' }}></div></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '110px', height: '13px' }}></div></td>
                  <td><div className="skeleton" style={{ width: '110px', height: '26px', borderRadius: '8px' }}></div></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '150px', height: '12px' }}></div></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '75px', height: '11px' }}></div></td>
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
                <th>#</th>
                <th>Candidate</th>
                <th>Position</th>
                <th>Department</th>
                <th>Recruiter</th>
                <th>Previous Company</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Date Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0', fontStyle: 'italic' }}>
                    No candidates match your search.
                  </td>
                </tr>
              ) : filtered.map((c, idx) => (
                <tr key={c.id || idx} className="table-row">
                  <td style={{ color: '#a0aec0', fontSize: 12 }}>{idx + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar teal-avatar">
                        {(c.candidate_name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1a202c' }}>{c.candidate_name}</div>
                        {c.email && <div style={{ fontSize: 11, color: '#a0aec0' }}>{c.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: '#4a5568', fontWeight: 500 }}>{c.position || '—'}</td>
                  <td style={{ fontSize: 12, color: '#718096' }}>{c.department || '—'}</td>
                  <td style={{ fontSize: 12, color: '#4a5568', fontWeight: 500 }}>{c.recruiter || <span style={{ color: '#cbd5e0', fontStyle: 'italic' }}>Unassigned</span>}</td>
                  <td style={{ fontSize: 12, color: '#718096' }}>{c.previous_company || '—'}</td>
                  <td>
                    <select
                      className="status-select"
                      value={c.status || ''}
                      onChange={e => handleUpdateStatus(c.id, e.target.value)}
                      style={{ '--dot-color': getStatusMeta(c.status).dot }}
                    >
                      <option value={c.status}>{c.status}</option>
                      <option value="Applied">Applied</option>
                      <option value="Screening">Screening</option>
                      <option value="Interview">Interview</option>
                      <option value="Offer">Offer</option>
                      <option value="Hired">Hired</option>
                      <option value="Closed">Closed</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Withdrawn">Withdrawn</option>
                    </select>
                  </td>
                  <td style={{ fontSize: 12, color: '#718096', maxWidth: 200 }}>
                    <span title={c.remarks}>{c.remarks?.length > 40 ? c.remarks.substring(0, 40) + '…' : (c.remarks || '—')}</span>
                  </td>
                  <td style={{ fontSize: 11, color: '#a0aec0', whiteSpace: 'nowrap' }}>
                    {c.requested_date ? new Date(c.requested_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}