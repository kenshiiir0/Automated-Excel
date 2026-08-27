import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../Icon.jsx';

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
    const [priorWarningNote, setPriorWarningNote] = useState('');

    const [previewUrl, setPreviewUrl] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [sending, setSending] = useState(false);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4500);
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [empRes, typesRes, historyRes] = await Promise.all([
                    fetch('/api/employees'),
                    fetch('/api/disciplinary-memos/types'),
                    fetch('/api/disciplinary-memos'),
                ]);
                const empData = await empRes.json();
                const typesData = await typesRes.json();
                const historyData = await historyRes.json();
                setEmployees(Array.isArray(empData) ? empData : []);
                setMemoTypes(typesData.types || []);
                setCompanyRules(typesData.rules || []);
                setHistory(Array.isArray(historyData) ? historyData : []);
            } catch (err) {
                showToast('error', 'Could not load employees or memo history.');
            } finally {
                setLoading(false);
            }
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
            setDrafting(false);
        }
    };

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

    const handleSend = async () => {
        if (!previewUrl) {
            showToast('error', 'Generate and review the document first.');
            return;
        }
        setSending(true);
        try {
            const res = await fetch('/api/disciplinary-memos/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload()),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not send the memo.');
            showToast('success', `Sent to ${data.toEmail}.`);
            setHistory(prev => [data.memo, ...prev]);
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
                            type="text"
                            placeholder="e.g. August 20, 2026 (or a cutoff range)"
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
                                {drafting ? 'Drafting…' : 'AI Draft'}
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
                    <button type="button" className="btn-ghost" disabled={!canGenerate || generating} onClick={handleGeneratePreview}>
                        {generating ? 'Generating…' : 'Generate & Preview'}
                    </button>
                    <button type="button" className="btn-primary" disabled={!previewUrl || sending} onClick={handleSend} title={!previewUrl ? 'Generate and review the document first' : undefined}>
                        {sending ? 'Sending…' : 'Send to Employee'}
                    </button>
                </div>
                {previewUrl && (
                    <p style={{ fontSize: 12, color: '#2f855a', marginTop: 10, marginBottom: 0 }}>
                        Preview opened in a new tab. Review it, then click Send when ready.
                    </p>
                )}
            </div>

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
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(m => (
                                <tr key={m.id} className="table-row">
                                    <td style={{ fontWeight: 600 }}>{m.employees ? `${m.employees.first_name} ${m.employees.last_name}` : '—'}</td>
                                    <td style={{ fontSize: 12, color: '#718096' }}>{(memoTypes.find(t => t.key === m.memo_type) || {}).label || m.memo_type}</td>
                                    <td style={{ fontSize: 12, color: '#a0aec0' }}>{fmtDate(m.sent_at)}</td>
                                    <td style={{ fontSize: 12, color: '#a0aec0' }}>{m.sent_to_email}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
