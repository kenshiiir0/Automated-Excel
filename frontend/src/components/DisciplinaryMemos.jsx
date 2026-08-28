import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../Icon.jsx';
import Modal from '../../Modal.jsx';

const NARRATIVE_STARTERS = {
    NTE: 'Describe what happened: what rule was broken, when, and what the employee did (or failed to do). This becomes the "facts established" paragraph in the Notice to Explain.',
    WRITTEN_WARNING: 'Describe the violation(s): dates, pattern (e.g. attendance records for a specific cutoff period), and any prior verbal reminders already given.',
    FINAL_WRITTEN_WARNING: 'Describe the continued violation since the last warning: what changed (or didn’t), with dates.',
};

function fmtDate(v) {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return v;
    }
}

export default function DisciplinaryMemos() {
    const [employees, setEmployees] = useState([]);
    const [memoTypes, setMemoTypes] = useState([]);
    const [companyRules, setCompanyRules] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    const [employeeSearch, setEmployeeSearch] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [memoType, setMemoType] = useState('NTE');
    const [ruleCode, setRuleCode] = useState('');
    const [ruleText, setRuleText] = useState('');
    const [incidentDate, setIncidentDate] = useState('');
    const [incidentTime, setIncidentTime] = useState('Working hours');
    const [bulletFacts, setBulletFacts] = useState('');
    const [incidentNarrative, setIncidentNarrative] = useState('');
    const [drafting, setDrafting] = useState(false);
    const [draftingSeconds, setDraftingSeconds] = useState(0);
    const draftingTimerRef = useRef(null);
    const [priorWarningNote, setPriorWarningNote] = useState('');

    const [previewUrl, setPreviewUrl] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [sending, setSending] = useState(false);
    const [showSendOptions, setShowSendOptions] = useState(false);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4500);
    }, []);

    // Loads employees, memo types/rules, and issue history independently
    // (Promise.allSettled, not Promise.all) so one endpoint failing --
    // say the employees list 500s -- doesn't blank out the other two
    // that succeeded. Each failure is reported with its own real cause
    // (the server's actual error message when there is one, the HTTP
    // status otherwise, or the raw network error) rather than one vague
    // "could not load" message that hides which part broke and why.
    useEffect(() => {
        async function loadOne(url) {
            const res = await fetch(url);
            let body = null;
            try { body = await res.json(); } catch { /* not JSON, e.g. an empty 500 */ }
            if (!res.ok) {
                const reason = body?.error || `HTTP ${res.status}`;
                throw new Error(`${url} failed: ${reason}`);
            }
            return body;
        }

        (async () => {
            setLoading(true);
            const [empResult, typesResult, historyResult] = await Promise.allSettled([
                loadOne('/api/employees'),
                loadOne('/api/disciplinary-memos/types'),
                loadOne('/api/disciplinary-memos'),
            ]);

            const failures = [];

            if (empResult.status === 'fulfilled') {
                setEmployees(Array.isArray(empResult.value) ? empResult.value : []);
            } else {
                failures.push(empResult.reason?.message || 'Could not load employees.');
            }

            if (typesResult.status === 'fulfilled') {
                setMemoTypes(typesResult.value?.types || []);
                setCompanyRules(typesResult.value?.rules || []);
            } else {
                failures.push(typesResult.reason?.message || 'Could not load memo types.');
            }

            if (historyResult.status === 'fulfilled') {
                setHistory(Array.isArray(historyResult.value) ? historyResult.value : []);
            } else {
                failures.push(historyResult.reason?.message || 'Could not load memo history.');
            }

            if (failures.length > 0) {
                showToast('error', failures.join(' — '));
            }

            setLoading(false);
        })();
    }, [showToast]);

    // Clear any previous preview whenever the underlying inputs change --
    // an old preview left on screen after editing a field would silently
    // no longer match what Send is about to generate.
    useEffect(() => {
        if (previewUrl) {
            window.URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEmployee, memoType, ruleCode, ruleText, incidentDate, incidentTime, incidentNarrative, priorWarningNote]);

    const filteredEmployees = employeeSearch.trim()
        ? employees.filter(e => `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(employeeSearch.toLowerCase()))
        : [];

    const canGenerate = selectedEmployee && memoType && ruleText.trim() && incidentNarrative.trim()
        && (memoType !== 'FINAL_WRITTEN_WARNING' || priorWarningNote.trim());

    const buildPayload = () => ({
        employeeId: selectedEmployee.id,
        memoType,
        ruleText: ruleText.trim(),
        incidentDate: incidentDate.trim(),
        incidentTime: incidentTime.trim(),
        incidentNarrative: incidentNarrative.trim(),
        priorWarningNote: priorWarningNote.trim(),
    });

    const handleRuleCodeChange = (code) => {
        setRuleCode(code);
        if (code === 'OTHER') {
            setRuleText('');
            return;
        }
        const match = companyRules.find(r => r.code === code);
        setRuleText(match ? match.text : '');
    };

    const handleDraftNarrative = async () => {
        if (!ruleText.trim() || !bulletFacts.trim()) {
            showToast('error', 'Fill in the rule and bullet facts first.');
            return;
        }
        setDrafting(true);
        setDraftingSeconds(0);
        // AI drafting can legitimately take several seconds (it's a real
        // network call to Gemini, with a fallback chain and one retry
        // built in server-side) -- a ticking counter on the button makes
        // clear the request is still alive rather than looking frozen,
        // which is what a plain static "Drafting..." label can look like
        // past the first couple of seconds.
        draftingTimerRef.current = setInterval(() => {
            setDraftingSeconds(s => s + 1);
        }, 1000);
        try {
            const res = await fetch('/api/disciplinary-memos/draft-narrative', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memoType, ruleText: ruleText.trim(), bulletFacts: bulletFacts.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not draft the narrative.');
            setIncidentNarrative(data.narrative);
            showToast('success', 'Draft added below -- review and edit before generating.');
        } catch (err) {
            showToast('error', err.message);
        } finally {
            clearInterval(draftingTimerRef.current);
            draftingTimerRef.current = null;
            setDrafting(false);
        }
    };

    // Stop the ticking counter if the component unmounts mid-draft (should
    // be rare now that this page stays mounted via the keep-alive router,
    // but stray intervals are worth guarding against regardless).
    useEffect(() => {
        return () => {
            if (draftingTimerRef.current) clearInterval(draftingTimerRef.current);
        };
    }, []);

    const handleGeneratePreview = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/disciplinary-memos/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload()),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Could not generate the preview.');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            setPreviewUrl(url);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (err) {
            showToast('error', err.message);
        } finally {
            setGenerating(false);
        }
    };

    // A separate, explicit Download button (distinct from Generate &
    // Preview's new-tab behavior) -- always saves a file to disk rather
    // than relying on the browser's own "save from a preview tab" action,
    // which isn't obvious to everyone. Available once a memo can be
    // generated, independent of whether Send has been used yet.
    const handleDirectDownload = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/disciplinary-memos/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload()),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Could not generate the document.');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const config = memoTypes.find(t => t.key === memoType);
            const filename = `${(config?.label || memoType).replace(/\s+/g, '_')}_${(selectedEmployee.first_name || '')}_${(selectedEmployee.last_name || '')}.docx`.replace(/\s+/g, '_');
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            showToast('error', err.message);
        } finally {
            setGenerating(false);
        }
    };

    // Per-row download in Recently Issued -- re-generates that exact
    // memo from its stored fields (the backend never stores the binary
    // file, only the fields used to build it) so a past memo can be
    // pulled again later without redrafting it from scratch.
    const handleDownloadHistoryMemo = async (memo) => {
        try {
            const res = await fetch(`/api/disciplinary-memos/${memo.id}/download`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Could not download this memo.');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="(.+)"/);
            const a = document.createElement('a');
            a.href = url;
            a.download = match ? match[1] : `memo_${memo.id}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            showToast('error', err.message);
        }
    };

    // toEmail comes from the Send Options modal -- whichever address HR
    // picked (personal, work, or Zoho). The backend still validates this
    // is actually one of the employee's own on-file addresses before
    // using it, so this is never trusted blindly.
    const handleSend = async (toEmail) => {
        if (!previewUrl) {
            showToast('error', 'Generate and review the document first.');
            return;
        }
        setSending(true);
        try {
            const res = await fetch('/api/disciplinary-memos/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...buildPayload(), toEmail }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not send the memo.');
            showToast('success', `Sent to ${data.toEmail}.`);
            setHistory(prev => [data.memo, ...prev]);
            setShowSendOptions(false);
            // Reset the form for the next memo.
            setSelectedEmployee(null);
            setEmployeeSearch('');
            setRuleText('');
            setIncidentDate('');
            setIncidentNarrative('');
            setPriorWarningNote('');
            if (previewUrl) window.URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
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
                    <h1 className="page-title">Disciplinary Memos</h1>
                    <p className="page-subtitle">
                        Generate a Notice to Explain, Written Warning, or Final Written Warning, review it, then send.
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
                        <label className="emp-form-label">Memo Type</label>
                        <select className="emp-form-input" value={memoType} onChange={e => setMemoType(e.target.value)}>
                            {memoTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                    </div>

                    <div className="emp-form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="emp-form-label">Company Rule Violated</label>
                        <select
                            className="emp-form-input"
                            value={ruleCode}
                            onChange={e => handleRuleCodeChange(e.target.value)}
                        >
                            <option value="" disabled>Select the rule violated…</option>
                            {companyRules.map(r => (
                                <option key={r.code} value={r.code}>{r.code === 'OTHER' ? r.text : `Rule ${r.code} — ${r.text.replace(/^Rule No\. [0-9.]+ /, '')}`}</option>
                            ))}
                        </select>
                        {ruleCode === 'OTHER' && (
                            <textarea
                                className="emp-form-input"
                                style={{ marginTop: '8px', minHeight: '60px' }}
                                placeholder="Type the exact company rule/policy violated…"
                                value={ruleText}
                                onChange={e => setRuleText(e.target.value)}
                            />
                        )}
                        {ruleCode && ruleCode !== 'OTHER' && (
                            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>{ruleText}</p>
                        )}
                    </div>

                    <div className="emp-form-group">
                        <label className="emp-form-label">Date of Incident</label>
                        <input
                            className="emp-form-input"
                            type="date"
                            value={incidentDate}
                            onChange={e => setIncidentDate(e.target.value)}
                        />
                    </div>

                    {memoType === 'FINAL_WRITTEN_WARNING' && (
                        <div className="emp-form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="emp-form-label">Prior Warning Reference</label>
                            <input
                                className="emp-form-input"
                                type="text"
                                placeholder="e.g. Records show you were previously issued a Written Warning on July 1, 2026 for similar violations."
                                value={priorWarningNote}
                                onChange={e => setPriorWarningNote(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="emp-form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="emp-form-label">Quick Facts (optional -- for AI drafting)</label>
                        <p style={{ fontSize: 12, color: '#a0aec0', margin: '0 0 6px' }}>{NARRATIVE_STARTERS[memoType]} Type short bullet-style facts here, then click "AI Draft" to expand them into a formal paragraph below -- you can still edit the result before generating.</p>
                        <textarea
                            className="emp-form-input"
                            rows={3}
                            style={{ resize: 'vertical', fontFamily: 'inherit' }}
                            placeholder="e.g. Late 6 times in June 11-25 cutoff; no advance notice given; verbal reminder already given once"
                            value={bulletFacts}
                            onChange={e => setBulletFacts(e.target.value)}
                        />
                        <div style={{ marginTop: 8 }}>
                            <button type="button" className="btn-ghost" disabled={drafting || !ruleText.trim() || !bulletFacts.trim()} onClick={handleDraftNarrative}>
                                {drafting
                                    ? (draftingSeconds >= 2 ? `Drafting… (${draftingSeconds}s)` : 'Drafting…')
                                    : 'AI Draft'}
                            </button>
                        </div>
                    </div>

                    <div className="emp-form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="emp-form-label">Incident Narrative</label>
                        <p style={{ fontSize: 12, color: '#a0aec0', margin: '0 0 6px' }}>This is what appears in the memo. Type it directly, or use AI Draft above and edit the result.</p>
                        <textarea
                            className="emp-form-input"
                            rows={5}
                            style={{ resize: 'vertical', fontFamily: 'inherit' }}
                            value={incidentNarrative}
                            onChange={e => setIncidentNarrative(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button type="button" className="btn-ghost" disabled={!canGenerate || generating} onClick={handleGeneratePreview} title="Opens the document in a new tab for review">
                        {generating ? 'Generating…' : 'Generate & Preview'}
                    </button>
                    <button type="button" className="btn-ghost" disabled={!canGenerate || generating} onClick={handleDirectDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Saves the document to your computer">
                        <Icon name="download" size={14} /> Download
                    </button>
                    <button type="button" className="btn-primary" disabled={!previewUrl || sending} onClick={() => setShowSendOptions(true)} title={!previewUrl ? 'Generate and review the document first' : undefined}>
                        {sending ? 'Sending…' : 'Send…'}
                    </button>
                </div>
                {previewUrl && (
                    <p style={{ fontSize: 12, color: '#2f855a', marginTop: 10, marginBottom: 0 }}>
                        Preview opened in a new tab. Review it, then click Send when ready.
                    </p>
                )}
            </div>

            {showSendOptions && selectedEmployee && (
                <SendOptionsModal
                    employee={selectedEmployee}
                    sending={sending}
                    onClose={() => setShowSendOptions(false)}
                    onSendTo={handleSend}
                />
            )}

            <div className="section-title">Recently Issued</div>
            {history.length === 0 ? (
                <div className="table-card" style={{ padding: '32px 24px', textAlign: 'center', color: '#a0aec0', fontStyle: 'italic' }}>
                    No memos issued yet.
                </div>
            ) : (
                <div className="table-card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Type</th>
                                <th>Sent</th>
                                <th>To</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(m => (
                                <tr key={m.id} className="table-row">
                                    <td style={{ fontWeight: 600 }}>{m.employees ? `${m.employees.first_name} ${m.employees.last_name}` : '—'}</td>
                                    <td style={{ fontSize: 12, color: '#718096' }}>{(memoTypes.find(t => t.key === m.memo_type) || {}).label || m.memo_type}</td>
                                    <td style={{ fontSize: 12, color: '#a0aec0' }}>{fmtDate(m.sent_at)}</td>
                                    <td style={{ fontSize: 12, color: '#a0aec0' }}>{m.sent_to_email}</td>
                                    <td>
                                        <button
                                            type="button"
                                            className="btn-ghost"
                                            style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                            onClick={() => handleDownloadHistoryMemo(m)}
                                            title="Download this memo again"
                                        >
                                            <Icon name="download" size={12} /> Download
                                        </button>
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

// ---------------------------------------------------------------------------
// SendOptionsModal -- opened by the "Send…" button. Lets HR choose exactly
// which address on file to send to (personal / work / Zoho -- whichever
// actually exist for this employee), or skip emailing entirely and just
// download the document instead. Only options with a real value show up;
// an employee missing all three sees just the Download option, since
// there's nowhere to send it.
// ---------------------------------------------------------------------------
function SendOptionsModal({ employee, sending, onClose, onSendTo }) {
    const emailOptions = [
        { key: 'personal_email', label: 'Personal Email', value: employee.personal_email },
        { key: 'email', label: 'Work Email', value: employee.email },
        { key: 'zoho_email', label: 'Zoho Email', value: employee.zoho_email },
    ].filter(opt => opt.value);

    const [selected, setSelected] = useState(emailOptions[0]?.value || '');

    const busy = sending;

    return (
        <Modal title="Send Disciplinary Memo" onClose={onClose} maxWidth={480}>
            <p style={{ fontSize: 13.5, color: '#4a5568', marginTop: 0 }}>
                Choose where to send this memo for <strong>{employee.first_name} {employee.last_name}</strong>.
            </p>

            {emailOptions.length === 0 ? (
                <div className="login-error" style={{ marginBottom: 16 }}>
                    No email on file for this employee (personal, work, or Zoho). Close this and use the
                    Download button instead, or add an email in Employee Details first.
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
                                name="send-destination"
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
