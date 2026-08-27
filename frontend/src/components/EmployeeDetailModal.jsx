import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../../Icon.jsx';

// ---------------------------------------------------------------------------
// useEmployeeDetail — fetches a single employee record by ID.
// ---------------------------------------------------------------------------
function useEmployeeDetail(employeeId) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setEmployee(null);
      try {
        const res = await fetch(`/api/employees/${employeeId}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (!cancelled) setEmployee(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [employeeId]);

  return { employee, loading, error };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function fmt(v) { return v || <span className="emp-detail-value muted">Nothing to show yet</span>; }

function fmtDate(v) {
  if (!v) return <span className="emp-detail-value muted">Nothing to show yet</span>;
  try {
    return new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return v;
  }
}

function Field({ label, value }) {
  return (
    <div className="emp-detail-field">
      <span className="emp-detail-label">{label}</span>
      <span className="emp-detail-value">{value}</span>
    </div>
  );
}

// Clickable contact field: renders a mailto:/tel: link that opens the
// viewer's own email client or phone dialer, pre-addressed to this person.
// This is a real, working action today -- not a stub -- since it relies on
// the browser's own mailto:/tel: handling rather than any in-app sending.
function ContactLink({ label, value, kind }) {
  if (!value) {
    return (
      <div className="emp-detail-field">
        <span className="emp-detail-label">{label}</span>
        <span className="emp-detail-value muted">Nothing to show yet</span>
      </div>
    );
  }
  // A cell can hold more than one address separated by a slash
  // (e.g. "name@getmeds.ph/name@2mginc.com") -- split into separate links.
  const values = kind === 'email' ? value.split('/').map(v => v.trim()).filter(Boolean) : [value];
  return (
    <div className="emp-detail-field">
      <span className="emp-detail-label">{label}</span>
      <span className="emp-detail-value" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {values.map((v, i) => (
          <a
            key={i}
            href={kind === 'email' ? `mailto:${v}` : `tel:${v}`}
            style={{ color: '#1D9FDA', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            <Icon name={kind === 'email' ? 'mail' : 'phone'} size={13} />{v}
          </a>
        ))}
      </span>
    </div>
  );
}

function ContractBadge({ status }) {
  const done = status?.toLowerCase() === 'done';
  return (
    <span className={`emp-contract-badge ${done ? 'done' : 'pending'}`}>
      {done ? '✓ Done' : 'Pending'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// EmployeeDetailModal
// ---------------------------------------------------------------------------
export default function EmployeeDetailModal({ employeeId, onClose }) {
  const { employee: emp, loading, error } = useEmployeeDetail(employeeId);
  const [showSensitive, setShowSensitive] = useState(false);
  const modalRef = useRef(null);
  const closeRef = useRef(null);

  // Escape key closes modal
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus trap: focus the modal panel on open; restore on close
  useEffect(() => {
    const prev = document.activeElement;
    closeRef.current?.focus();
    return () => prev?.focus();
  }, []);

  // Trap Tab inside the modal
  const handleModalKeyDown = useCallback((e) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), details, summary'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault();
      (e.shiftKey ? last : first)?.focus();
    }
  }, []);

  return (
    <div
      className="emp-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Employee full details"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="emp-detail-modal"
        ref={modalRef}
        tabIndex={-1}
        onKeyDown={handleModalKeyDown}
      >
        {/* ── Header (always visible) ─────────────────────────────── */}
        <div className="emp-detail-header">
          <div className="emp-detail-avatar">
            {emp ? `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}` : '…'}
          </div>
          <div className="emp-detail-header-info">
            <h2 className="emp-detail-name">
              {emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—' : '\u00A0'}
            </h2>
            <div className="emp-detail-meta">
              {emp && <span className="emp-id-badge">{emp.emp_id}</span>}
              {emp?.employment_status && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: emp.employment_status === 'Active' ? '#e6f4ea' : '#fce8e6',
                  color: emp.employment_status === 'Active' ? '#137333' : '#c5221f',
                }}>
                  {emp.employment_status}
                </span>
              )}
            </div>
          </div>
          <button
            className="emp-detail-close"
            onClick={onClose}
            ref={closeRef}
            aria-label="Close employee detail"
          >✕</button>
        </div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && <div className="emp-detail-loading">Loading employee details…</div>}

        {/* ── Error ───────────────────────────────────────────────── */}
        {error && (
          <div className="emp-detail-error">
            Could not load employee details: {error}
          </div>
        )}

        {/* ── Body (only when loaded) ──────────────────────────────── */}
        {emp && (
          <div className="emp-detail-body">

            {/* Section 1 — Core Employment Info */}
            <section className="emp-detail-section" aria-label="Employment information">
              <div className="emp-detail-section-title">Employment Information</div>
              <div className="emp-detail-grid">
                <Field label="Department"            value={fmt(emp.department)} />
                <Field label="Position"              value={fmt(emp.position)} />
                <Field label="New Designation"       value={fmt(emp.new_designation)} />
                <Field label="Classification"        value={fmt(emp.employment_classification)} />
                <Field label="Work Arrangement"      value={fmt(emp.work_arrangement)} />
                <Field label="Date Hired"            value={fmtDate(emp.hire_date)} />
                <Field label="Regularization Date"   value={fmtDate(emp.regularization_date)} />
                <ContactLink label="Work Email"      value={emp.email} kind="email" />
                <ContactLink label="Personal Email"  value={emp.personal_email} kind="email" />
                <ContactLink label="Zoho Email"      value={emp.zoho_email} kind="email" />
                <ContactLink label="Contact Number"  value={emp.phone} kind="tel" />
                <div className="emp-detail-field">
                  <span className="emp-detail-label">Contract Status</span>
                  <span className="emp-detail-value">
                    <ContractBadge status={emp.employment_contract_status} />
                  </span>
                </div>
              </div>
            </section>

            {/* Section 3 — Sensitive info (collapsed by default) */}
            {/* Collapsed by default purely as a privacy-conscious UI choice --
                salary, bank, government ID, and emergency-contact data is
                already included in the API response for any authenticated
                request (see NOTE in employeeController.js). This toggle just
                keeps it out of view until someone deliberately expands it. */}
            <button
              className={`emp-sensitive-toggle${showSensitive ? ' open' : ''}`}
              onClick={() => setShowSensitive(s => !s)}
              aria-expanded={showSensitive}
              aria-controls="emp-sensitive-section"
            >
              <span className="toggle-icon">▶</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="lock" size={13} /> {showSensitive ? 'Hide' : 'Show'} Sensitive Information</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#a0aec0' }}>
                Salary · Bank · Gov IDs · Address · Emergency Contact
              </span>
            </button>

            <div
              id="emp-sensitive-section"
              className={`emp-sensitive-section${showSensitive ? ' open' : ''}`}
              aria-hidden={!showSensitive}
            >
              <section className="emp-detail-section" aria-label="Sensitive employee information">
                <div className="emp-detail-section-title">Compensation</div>
                <div className="emp-detail-grid">
                  <Field label="Salary"      value={emp.salary != null ? `₱${Number(emp.salary).toLocaleString('en-PH')}` : fmt(null)} />
                  <Field label="Bank Name"   value={fmt(emp.bank_name)} />
                  <Field label="Bank Account" value={fmt(emp.bank_account)} />
                </div>

                <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Government IDs</div>
                <div className="emp-detail-grid">
                  <Field label="SSS Number"       value={fmt(emp.sss_number)} />
                  <Field label="PhilHealth"        value={fmt(emp.philhealth_number)} />
                  <Field label="Pag-IBIG (HDMF)"  value={fmt(emp.hdmf_number)} />
                  <Field label="TIN"              value={fmt(emp.tin_number)} />
                </div>

                <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Personal</div>
                <div className="emp-detail-grid">
                  <Field label="Birthdate"        value={fmtDate(emp.date_of_birth)} />
                  <Field label="Gender"           value={fmt(emp.gender)} />
                  <Field label="Marital Status"   value={fmt(emp.marital_status)} />
                  <Field label="Citizenship"      value={fmt(emp.citizenship)} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Field label="Home / Complete Address" value={fmt(emp.complete_address)} />
                </div>

                <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Emergency Contact</div>
                <div className="emp-detail-grid">
                  <Field label="Contact Person"   value={fmt(emp.emergency_contact_person)} />
                  <Field label="Relationship"     value={fmt(emp.relationship)} />
                  <Field label="Contact Details"  value={fmt(emp.emergency_contact_details)} />
                </div>

                <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Company Assets</div>
                <div className="emp-detail-grid">
                  <Field label="Company Issued No." value={fmt(emp.company_issued_no)} />
                  <Field label="Issued Equipment"   value={fmt(emp.issued_equipment)} />
                </div>
              </section>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
