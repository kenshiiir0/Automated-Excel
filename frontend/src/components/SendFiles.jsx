import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../Icon.jsx';
import Modal from '../../Modal.jsx';

// Kept in sync with controllers/fileShareController.js's ALLOWED_MIME_TYPES
// and MAX_FILE_SIZE_BYTES -- this is only a fast, friendly client-side
// check so a bad file is rejected instantly instead of after an upload;
// the server enforces the same limits again regardless, since a client
// check alone is never a real guarantee.
const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.zip';
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function fmtBytes(bytes) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDateTime(v) {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
        return v;
    }
}

export default function SendFiles({ visible } = {}) {
    const [employees, setEmployees] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    const [employeeSearch, setEmployeeSearch] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [file, setFile] = useState(null);
    const [note, setNote] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const [sending, setSending] = useState(false);
    const [showSendOptions, setShowSendOptions] = useState(false);
    const [lastSentConfirmation, setLastSentConfirmation] = useState(null);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), type === 'error' ? 8000 : 4500);
    }, []);

    // Loaded independently (Promise.allSettled) so one endpoint failing
    // doesn't blank out the other -- same reasoning as Disciplinary
    // Memos: employees and history are unrelated data, one 500ing
    // shouldn't hide the other that succeeded.
    const loadAll = useCallback(async ({ showSpinner } = { showSpinner: true }) => {
        async function loadOne(url) {
            const res = await fetch(url);
            let body = null;
            try { body = await res.json(); } catch { /* not JSON */ }
            if (!res.ok) throw new Error(body?.error || `${url} failed: HTTP ${res.status}`);
            return body;
        }

        if (showSpinner) setLoading(true);
        const [empResult, historyResult] = await Promise.allSettled([
            loadOne('/api/employees'),
            loadOne('/api/file-share'),
        ]);

        const failures = [];
        if (empResult.status === 'fulfilled') {
            setEmployees(Array.isArray(empResult.value) ? empResult.value : []);
        } else {
            failures.push(empResult.reason?.message || 'Could not load employees.');
        }
        if (historyResult.status === 'fulfilled') {
            setHistory(Array.isArray(historyResult.value) ? historyResult.value : []);
        } else {
            failures.push(historyResult.reason?.message || 'Could not load send history.');
        }
        if (failures.length > 0) showToast('error', failures.join(' — '));
        if (showSpinner) setLoading(false);
    }, [showToast]);

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-fetch history quietly on returning to this page (this is a
    // keep-alive page -- see App.jsx) so a send made, then a nav away and
    // back, shows any records another tab/session may have added, without
    // losing the in-progress file/employee/note selection which lives in
    // this component's own state and isn't touched by this.
    useEffect(() => {
        if (visible) loadAll({ showSpinner: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const filteredEmployees = employeeSearch.trim()
        ? employees.filter(e => `${e.first_name} ${e.last_name}`.toLowerCase().includes(employeeSearch.toLowerCase()))
        : [];

    function validateAndSetFile(f) {
        if (!f) return;
        if (f.size > MAX_FILE_SIZE_BYTES) {
            showToast('error', `"${f.name}" is larger than the 20MB limit for Send Files.`);
            return;
        }
        setFile(f);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragActive(false);
        const f = e.dataTransfer.files?.[0];
        validateAndSetFile(f);
    }

    const canSend = !!selectedEmployee && !!file;

    const handleSendTo = async (toEmail) => {
        setSending(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('employeeId', selectedEmployee.id);
            formData.append('toEmail', toEmail);
            if (note.trim()) formData.append('note', note.trim());

            const res = await fetch('/api/file-share/send', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not send the file.');

            showToast('success', `Sent to ${data.toEmail}.`);
            setLastSentConfirmation({
                employeeName: `${selectedEmployee.first_name} ${selectedEmployee.last_name}`,
                fileName: file.name,
                toEmail: data.toEmail,
                sentAt: data.share?.sent_at || new Date().toISOString(),
            });
            setHistory(prev => [data.share, ...prev]);
            setShowSendOptions(false);

            // Reset for the next send.
            setSelectedEmployee(null);
            setEmployeeSearch('');
            setFile(null);
            setNote('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            showToast('error', err.message);
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="page-loading">Loading…</div>;

    return (
        <div className="page-container">
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            <div className="page-header">
                <div>
                    <h1 className="page-title">Send Files</h1>
                    <p className="page-subtitle">
                        Drag and drop a file to send it straight to an employee's email on file.
                    </p>
                </div>
            </div>

            <div className="table-card" style={{ padding: 20, marginBottom: 20 }}>
                <div className="emp-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="emp-form-group" style={{ position: 'relative' }}>
                        <label className="emp-form-label">Employee</label>
                        {selectedEmployee ? (
                            <div className="emp-form-input" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{selectedEmployee.first_name} {selectedEmployee.last_name} — {selectedEmployee.position}</span>
                                <button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setSelectedEmployee(null)}>Change</button>
                            </div>
                        ) : (
                            <>
                                <input
                                    className="emp-form-input"
                                    type="text"
                                    placeholder="Search employee by name…"
                                    value={employeeSearch}
                                    onChange={e => setEmployeeSearch(e.target.value)}
                                />
                                {filteredEmployees.length > 0 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                                        {filteredEmployees.slice(0, 20).map(emp => (
                                            <div
                                                key={emp.id}
                                                onClick={() => { setSelectedEmployee(emp); setEmployeeSearch(''); }}
                                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}
                                                onMouseDown={e => e.preventDefault()}
                                            >
                                                <div style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</div>
                                                <div style={{ color: '#a0aec0', fontSize: 11.5 }}>{emp.position} — {emp.department}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="emp-form-group">
                        <label className="emp-form-label">Note (optional)</label>
                        <input
                            className="emp-form-input"
                            type="text"
                            placeholder="A short line to include in the email…"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>

                    <div className="emp-form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="emp-form-label">File</label>
                        <div
                            className={`file-drop-zone${dragActive ? ' file-drop-zone-active' : ''}`}
                            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ALLOWED_EXTENSIONS}
                                style={{ display: 'none' }}
                                onChange={e => validateAndSetFile(e.target.files?.[0])}
                            />
                            {file ? (
                                <div className="file-drop-chip">
                                    <Icon name="file" size={18} />
                                    <span className="file-drop-chip-name">{file.name}</span>
                                    <span className="file-drop-chip-size">{fmtBytes(file.size)}</span>
                                    <button
                                        type="button"
                                        className="btn-ghost"
                                        style={{ padding: '2px 8px', fontSize: 12 }}
                                        onClick={e => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Icon name="upload" size={22} />
                                    <p className="file-drop-zone-text">
                                        <strong>Drag a file here</strong>, or click to browse
                                    </p>
                                    <p className="file-drop-zone-hint">
                                        Documents, spreadsheets, presentations, images, or a zip — up to 20MB
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn-primary"
                        disabled={!canSend || sending}
                        onClick={() => setShowSendOptions(true)}
                        title={!canSend ? 'Choose an employee and a file first' : undefined}
                    >
                        {sending ? 'Sending…' : 'Send…'}
                    </button>
                </div>

                {lastSentConfirmation && (
                    <div className="sent-confirmation-banner">
                        <Icon name="check" size={16} className="sent-confirmation-icon" />
                        <span className="sent-confirmation-text">
                            Sent <strong>{lastSentConfirmation.fileName}</strong> to <strong>{lastSentConfirmation.employeeName}</strong> ({lastSentConfirmation.toEmail}).
                        </span>
                        <button type="button" className="sent-confirmation-dismiss" onClick={() => setLastSentConfirmation(null)}>×</button>
                    </div>
                )}
            </div>

            <div className="table-card">
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Recently Sent</h3>
                {history.length === 0 ? (
                    <p style={{ color: '#a0aec0', fontSize: 13 }}>No files have been sent yet.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>File</th>
                                <th>Sent To</th>
                                <th>Size</th>
                                <th>Sent At</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(row => (
                                <tr key={row.id}>
                                    <td>{row.employees ? `${row.employees.first_name} ${row.employees.last_name}` : '—'}</td>
                                    <td>{row.file_name}</td>
                                    <td>{row.sent_to_email}</td>
                                    <td>{fmtBytes(row.file_size_bytes)}</td>
                                    <td>{fmtDateTime(row.sent_at)}</td>
                                    <td><span className="memo-sent-status-pill"><Icon name="check" size={11} /> Sent</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showSendOptions && selectedEmployee && (
                <SendFileOptionsModal
                    employee={selectedEmployee}
                    fileName={file?.name}
                    sending={sending}
                    onClose={() => setShowSendOptions(false)}
                    onSendTo={handleSendTo}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Lets HR pick which of the employee's on-file addresses (personal, work,
// or Zoho) the file goes to -- same pattern as Disciplinary Memos'
// SendOptionsModal, so choosing a destination works identically across
// both features.
// ---------------------------------------------------------------------------
function SendFileOptionsModal({ employee, fileName, sending, onClose, onSendTo }) {
    const emailOptions = [
        { key: 'personal_email', label: 'Personal Email', value: employee.personal_email },
        { key: 'email', label: 'Work Email', value: employee.email },
        { key: 'zoho_email', label: 'Zoho Email', value: employee.zoho_email },
    ].filter(opt => opt.value);

    const [selected, setSelected] = useState(emailOptions[0]?.value || '');
    const busy = sending;

    return (
        <Modal title="Send File" onClose={onClose} maxWidth={480}>
            <p style={{ fontSize: 13.5, color: '#4a5568', marginTop: 0 }}>
                Choose where to send <strong>{fileName}</strong> for <strong>{employee.first_name} {employee.last_name}</strong>.
            </p>

            {emailOptions.length === 0 ? (
                <div className="login-error" style={{ marginBottom: 16 }}>
                    No email on file for this employee (personal, work, or Zoho). Add one in
                    Employee Details before sending.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    {emailOptions.map(opt => (
                        <label
                            key={opt.key}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                border: `1px solid ${selected === opt.value ? '#1D9FDA' : '#e2e8f0'}`,
                                borderRadius: 8, cursor: 'pointer',
                                background: selected === opt.value ? '#f0f9ff' : '#fff',
                            }}
                        >
                            <input
                                type="radio"
                                name="send-file-destination"
                                checked={selected === opt.value}
                                onChange={() => setSelected(opt.value)}
                            />
                            <span>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</span>
                                <span style={{ display: 'block', fontSize: 12, color: '#718096' }}>{opt.value}</span>
                            </span>
                        </label>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
                <button
                    type="button"
                    className="btn-primary"
                    disabled={busy || !selected}
                    onClick={() => onSendTo(selected)}
                >
                    {sending ? 'Sending…' : 'Send'}
                </button>
            </div>
        </Modal>
    );
}
