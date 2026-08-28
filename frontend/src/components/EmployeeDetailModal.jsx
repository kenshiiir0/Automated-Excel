import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../../Icon.jsx';
import CustomSelect from '../../CustomSelect.jsx';
import { useAuth } from '../../authContext.jsx';

// ---------------------------------------------------------------------------
// useEmployeeDetail — fetches a single employee record by ID.
// ---------------------------------------------------------------------------
function useEmployeeDetail(employeeId, refreshKey) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
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
  }, [employeeId, refreshKey]);

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

// Supabase date columns want YYYY-MM-DD; an ISO timestamp needs trimming
// down to that before it can seed a native <input type="date">.
function toDateInputValue(v) {
  if (!v) return '';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function Field({ label, value }) {
  return (
    <div className="emp-detail-field">
      <span className="emp-detail-label">{label}</span>
      <span className="emp-detail-value">{value}</span>
    </div>
  );
}

// Renders either a read-only Field or a matching input/select, depending on
// whether the modal is in edit mode. One component covers every field so
// display and edit stay visually and structurally in sync.
function EditableField({ label, name, value, editing, onChange, type = 'text', options, display }) {
  if (!editing) {
    return <Field label={label} value={display !== undefined ? display : fmt(value)} />;
  }
  return (
    <div className="emp-form-group emp-detail-edit-field">
      <label className="emp-form-label">{label}</label>
      {type === 'select' ? (
        <CustomSelect
          className="emp-form-input"
          value={value ?? ''}
          onChange={v => onChange(name, v)}
          options={[{ value: '', label: '—' }, ...options.map(o => ({ value: o, label: o }))]}
        />
      ) : (
        <input
          className="emp-form-input"
          type={type}
          value={type === 'date' ? toDateInputValue(value) : (value ?? '')}
          onChange={e => onChange(name, e.target.value)}
        />
      )}
    </div>
  );
}

// Reason-for-leaving field: a preset dropdown (built from what's actually
// used in real records, see SEPARATION_REASONS above) that falls through
// to a free-text input when "Other" is picked, or when the stored value
// doesn't match any preset (e.g. old free-text data from before this
// dropdown existed). Only rendered at all when employment status isn't
// Active -- see the call site -- since a reason for leaving doesn't make
// sense for someone still employed.
function SeparationReasonField({ value, editing, onChange }) {
  // Hook called unconditionally, before any early return -- React requires
  // hooks to run in the same order on every render, so this can't sit
  // after the `if (!editing)` branch below even though its value is only
  // ever used in the editing branch.
  const [usingOther, setUsingOther] = useState(false);

  // Re-derive whenever a fresh editing session starts (not on every
  // keystroke -- only on the editing:false -> true transition), so
  // cancelling and re-entering edit mode on the same employee shows the
  // dropdown/free-text choice that actually matches the current value,
  // instead of remembering whatever was left over from a previous
  // editing session in this same modal instance.
  useEffect(() => {
    if (editing) {
      const isPreset = value === '' || SEPARATION_REASONS.slice(0, -1).includes(value);
      setUsingOther(!isPreset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!editing) {
    return <Field label="Reason for Leaving" value={fmt(value)} />;
  }

  return (
    <div className="emp-form-group emp-detail-edit-field">
      <label className="emp-form-label">Reason for Leaving</label>
      {usingOther ? (
        <input
          className="emp-form-input"
          type="text"
          placeholder="Enter reason"
          value={value ?? ''}
          onChange={e => onChange('separation_reason', e.target.value)}
        />
      ) : (
        <CustomSelect
          className="emp-form-input"
          value={value ?? ''}
          onChange={v => {
            if (v === 'Other') {
              setUsingOther(true);
              onChange('separation_reason', '');
            } else {
              onChange('separation_reason', v);
            }
          }}
          options={[{ value: '', label: '—' }, ...SEPARATION_REASONS.map(o => ({ value: o, label: o }))]}
        />
      )}
      {usingOther && (
        <button
          type="button"
          className="emp-detail-inline-link-btn"
          onClick={() => { setUsingOther(false); onChange('separation_reason', ''); }}
        >
          Choose from list instead
        </button>
      )}
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

const EDITABLE_FIELDS = [
  'department', 'position', 'new_designation', 'position_category', 'employment_classification',
  'work_arrangement', 'territory', 'reporting_to', 'employment_status', 'hire_date',
  'regularization_date', 'email', 'personal_email', 'zoho_email', 'phone',
  'employment_contract_status', 'salary', 'bank_name', 'bank_account', 'sss_number',
  'philhealth_number', 'hdmf_number', 'tin_number', 'date_of_birth', 'gender',
  'marital_status', 'citizenship', 'complete_address', 'emergency_contact_person',
  'relationship', 'emergency_contact_details', 'company_issued_no', 'issued_equipment',
  'separation_reason', 'exit_date',
];

// Preset reason options, drawn from what's actually used across existing
// records (see import_data/employees_import.csv) so the dropdown matches
// real historical data rather than an invented category list. "Other"
// falls through to a free-text input for anything that doesn't fit.
const SEPARATION_REASONS = ['Resigned', 'Immediate Resignation', 'AWOL', 'End of Contract', 'Terminated', 'Other'];

function buildFormData(emp) {
  const data = {};
  EDITABLE_FIELDS.forEach(k => { data[k] = emp[k] ?? ''; });
  return data;
}

// ---------------------------------------------------------------------------
// EmployeeDetailModal
// ---------------------------------------------------------------------------
export default function EmployeeDetailModal({ employeeId, onClose, onDeleted, onUpdated }) {
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'super_admin';

  const [refreshKey, setRefreshKey] = useState(0);
  const { employee: emp, loading, error } = useEmployeeDetail(employeeId, refreshKey);
  const [showSensitive, setShowSensitive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const modalRef = useRef(null);
  const closeRef = useRef(null);

  // Escape key closes modal (or steps out of edit/delete-confirm first)
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (confirmingDelete) { setConfirmingDelete(false); return; }
      if (editing) { setEditing(false); return; }
      onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, editing, confirmingDelete]);

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

  const startEditing = () => {
    setFormData(buildFormData(emp));
    setSaveError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFormData(null);
    setSaveError(null);
  };

  const handleFieldChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...formData };
      // Empty-string dates/numbers should clear the column, not be sent as "".
      if (payload.hire_date === '') payload.hire_date = null;
      if (payload.regularization_date === '') payload.regularization_date = null;
      if (payload.date_of_birth === '') payload.date_of_birth = null;
      if (payload.salary === '') payload.salary = null;
      if (payload.exit_date === '') payload.exit_date = null;
      // A reason for leaving only makes sense once someone is actually
      // inactive/resigned -- if the status gets changed back to Active
      // (or was already Active), clear out any stale reason/exit date
      // rather than leaving old separation data attached to an active
      // employee.
      if (payload.employment_status === 'Active') {
        payload.separation_reason = null;
        payload.exit_date = null;
      }

      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save changes.');
      setEditing(false);
      setFormData(null);
      setRefreshKey(k => k + 1);
      if (onUpdated) onUpdated(data);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not archive this record.');
      if (onDeleted) onDeleted(employeeId);
      onClose();
    } catch (err) {
      setSaveError(err.message);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const fullName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—' : '';
  const f = (name) => (editing ? formData?.[name] : emp?.[name]);

  return (
    <div
      className="emp-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Employee full details"
      onClick={(e) => { if (e.target === e.currentTarget && !editing) onClose(); }}
    >
      <div
        className={`emp-detail-modal${editing ? ' editing' : ''}`}
        ref={modalRef}
        tabIndex={-1}
        onKeyDown={handleModalKeyDown}
      >
        {editing && <div className="emp-detail-edit-banner"><Icon name="userPlus" size={13} /> Editing record — remember to save</div>}

        {/* ── Header (always visible) ─────────────────────────────── */}
        <div className="emp-detail-header">
          <div className="emp-detail-avatar">
            {emp ? `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}` : '…'}
          </div>
          <div className="emp-detail-header-info">
            <h2 className="emp-detail-name">{emp ? fullName : ' '}</h2>
            <div className="emp-detail-meta">
              {emp && <span className="emp-id-badge">{emp.emp_id}</span>}
              {emp?.employment_status && !editing && (
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

          <div className="emp-detail-header-actions">
            {emp && canWrite && !editing && !confirmingDelete && (
              <>
                <button className="emp-detail-action-btn edit" onClick={startEditing} title="Edit record">
                  <Icon name="edit" size={15} />
                  <span>Edit</span>
                </button>
                <button className="emp-detail-action-btn delete" onClick={() => setConfirmingDelete(true)} title="Archive record">
                  <Icon name="trash" size={15} />
                </button>
              </>
            )}
            {editing && (
              <>
                <button className="btn-ghost" onClick={cancelEditing} disabled={saving}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {saving && <span className="btn-spinner" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
            {!editing && (
              <button className="emp-detail-close" onClick={onClose} ref={closeRef} aria-label="Close employee detail">✕</button>
            )}
          </div>
        </div>

        {/* ── Delete confirmation banner ───────────────────────────── */}
        {confirmingDelete && (
          <div className="emp-detail-delete-banner">
            <Icon name="alertTriangle" size={18} />
            <div className="emp-detail-delete-text">
              <strong>Archive {fullName}'s record?</strong>
              <span>This moves the employee into Archived. Nothing is deleted -- you (or another admin) can restore it anytime from History.</span>
            </div>
            <div className="emp-detail-delete-actions">
              <button className="btn-ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancel</button>
              <button className="btn-danger-sm" onClick={handleDelete} disabled={deleting} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {deleting && <span className="btn-spinner" />}
                {deleting ? 'Archiving…' : 'Yes, Archive'}
              </button>
            </div>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && <div className="emp-detail-loading">Loading employee details…</div>}

        {/* ── Error ───────────────────────────────────────────────── */}
        {error && (
          <div className="emp-detail-error">
            Could not load employee details: {error}
          </div>
        )}
        {saveError && (
          <div className="emp-detail-error">{saveError}</div>
        )}

        {/* ── Body (only when loaded) ──────────────────────────────── */}
        {emp && (
          <div className="emp-detail-body">

            {/* Section 1 — Core Employment Info */}
            <section className="emp-detail-section" aria-label="Employment information">
              <div className="emp-detail-section-title">Employment Information</div>
              <div className={`emp-detail-grid${editing ? ' editing' : ''}`}>
                <EditableField label="Department" name="department" value={f('department')} editing={editing} onChange={handleFieldChange} />
                <EditableField label="Position" name="position" value={f('position')} editing={editing} onChange={handleFieldChange} />
                <EditableField label="New Designation" name="new_designation" value={f('new_designation')} editing={editing} onChange={handleFieldChange} />
                <EditableField label="Position Category" name="position_category" value={f('position_category')} editing={editing} onChange={handleFieldChange} />
                <EditableField
                  label="Classification" name="employment_classification" value={f('employment_classification')}
                  editing={editing} onChange={handleFieldChange} type="select" options={['Probationary', 'Regular']}
                />
                <EditableField label="Work Arrangement" name="work_arrangement" value={f('work_arrangement')} editing={editing} onChange={handleFieldChange} />
                <EditableField label="Territory" name="territory" value={f('territory')} editing={editing} onChange={handleFieldChange} />
                <EditableField label="Reports To" name="reporting_to" value={f('reporting_to')} editing={editing} onChange={handleFieldChange} />
                <EditableField
                  label="Employment Status" name="employment_status" value={f('employment_status')}
                  editing={editing} onChange={handleFieldChange} type="select" options={['Active', 'Inactive', 'Resigned']}
                />
                {/* Only relevant once someone is actually leaving -- hidden
                    entirely for Active employees rather than shown-but-empty,
                    since a reason/date for leaving doesn't apply yet. Checks
                    the live formData while editing so picking a non-Active
                    status reveals these fields immediately, without needing
                    to save first. */}
                {(editing ? formData.employment_status : emp.employment_status) !== 'Active' && (
                  <>
                    <SeparationReasonField value={f('separation_reason')} editing={editing} onChange={handleFieldChange} />
                    <EditableField label="Exit Date" name="exit_date" value={f('exit_date')} editing={editing} onChange={handleFieldChange} type="date" display={fmtDate(emp.exit_date)} />
                  </>
                )}
                <EditableField label="Date Hired" name="hire_date" value={f('hire_date')} editing={editing} onChange={handleFieldChange} type="date" display={fmtDate(emp.hire_date)} />
                <EditableField label="Regularization Date" name="regularization_date" value={f('regularization_date')} editing={editing} onChange={handleFieldChange} type="date" display={fmtDate(emp.regularization_date)} />
                <EditableField
                  label="Contract Status" name="employment_contract_status" value={f('employment_contract_status')}
                  editing={editing} onChange={handleFieldChange} type="select" options={['Done', 'Pending']}
                  display={<ContractBadge status={emp.employment_contract_status} />}
                />
                {editing ? (
                  <>
                    <EditableField label="Work Email" name="email" value={f('email')} editing type="email" onChange={handleFieldChange} />
                    <EditableField label="Personal Email" name="personal_email" value={f('personal_email')} editing type="email" onChange={handleFieldChange} />
                    <EditableField label="Zoho Email" name="zoho_email" value={f('zoho_email')} editing type="email" onChange={handleFieldChange} />
                    <EditableField label="Contact Number" name="phone" value={f('phone')} editing type="tel" onChange={handleFieldChange} />
                  </>
                ) : (
                  <>
                    <ContactLink label="Work Email" value={emp.email} kind="email" />
                    <ContactLink label="Personal Email" value={emp.personal_email} kind="email" />
                    <ContactLink label="Zoho Email" value={emp.zoho_email} kind="email" />
                    <ContactLink label="Contact Number" value={emp.phone} kind="tel" />
                  </>
                )}
              </div>
            </section>

            {/* Section 3 — Sensitive info (collapsed by default) */}
            {/* Collapsed by default purely as a privacy-conscious UI choice --
                salary, bank, government ID, and emergency-contact data is
                already included in the API response for admin/super_admin
                (see employeeController.js for the 'user'-role redaction).
                This toggle just keeps it out of view until someone
                deliberately expands it. */}
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
                <div className={`emp-detail-grid${editing ? ' editing' : ''}`}>
                  <EditableField
                    label="Salary" name="salary" value={f('salary')} editing={editing} onChange={handleFieldChange} type="number"
                    display={emp.salary != null ? `₱${Number(emp.salary).toLocaleString('en-PH')}` : fmt(null)}
                  />
                  <EditableField label="Bank Name" name="bank_name" value={f('bank_name')} editing={editing} onChange={handleFieldChange} />
                  <EditableField label="Bank Account" name="bank_account" value={f('bank_account')} editing={editing} onChange={handleFieldChange} />
                </div>

                <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Government IDs</div>
                <div className={`emp-detail-grid${editing ? ' editing' : ''}`}>
                  <EditableField label="SSS Number" name="sss_number" value={f('sss_number')} editing={editing} onChange={handleFieldChange} />
                  <EditableField label="PhilHealth" name="philhealth_number" value={f('philhealth_number')} editing={editing} onChange={handleFieldChange} />
                  <EditableField label="Pag-IBIG (HDMF)" name="hdmf_number" value={f('hdmf_number')} editing={editing} onChange={handleFieldChange} />
                  <EditableField label="TIN" name="tin_number" value={f('tin_number')} editing={editing} onChange={handleFieldChange} />
                </div>

                <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Personal</div>
                <div className={`emp-detail-grid${editing ? ' editing' : ''}`}>
                  <EditableField label="Birthdate" name="date_of_birth" value={f('date_of_birth')} editing={editing} onChange={handleFieldChange} type="date" display={fmtDate(emp.date_of_birth)} />
                  <EditableField
                    label="Gender" name="gender" value={f('gender')} editing={editing} onChange={handleFieldChange}
                    type="select" options={['Male', 'Female', 'Other']}
                  />
                  <EditableField
                    label="Marital Status" name="marital_status" value={f('marital_status')} editing={editing} onChange={handleFieldChange}
                    type="select" options={['Single', 'Married', 'Widowed', 'Separated']}
                  />
                  <EditableField label="Citizenship" name="citizenship" value={f('citizenship')} editing={editing} onChange={handleFieldChange} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <EditableField label="Home / Complete Address" name="complete_address" value={f('complete_address')} editing={editing} onChange={handleFieldChange} />
                </div>

                <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Emergency Contact</div>
                <div className={`emp-detail-grid${editing ? ' editing' : ''}`}>
                  <EditableField label="Contact Person" name="emergency_contact_person" value={f('emergency_contact_person')} editing={editing} onChange={handleFieldChange} />
                  <EditableField label="Relationship" name="relationship" value={f('relationship')} editing={editing} onChange={handleFieldChange} />
                  <EditableField label="Contact Details" name="emergency_contact_details" value={f('emergency_contact_details')} editing={editing} onChange={handleFieldChange} />
                </div>

                <div className="emp-detail-section-title" style={{ marginTop: 16 }}>Company Assets</div>
                <div className={`emp-detail-grid${editing ? ' editing' : ''}`}>
                  <EditableField label="Company Issued No." name="company_issued_no" value={f('company_issued_no')} editing={editing} onChange={handleFieldChange} />
                  <EditableField label="Issued Equipment" name="issued_equipment" value={f('issued_equipment')} editing={editing} onChange={handleFieldChange} />
                </div>
              </section>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
