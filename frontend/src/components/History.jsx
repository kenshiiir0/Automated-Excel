import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from '../../Icon.jsx';

// ---------------------------------------------------------------------------
// History -- one page covering everything the user asked for: "add one for
// the delete functions or any editing happening in the system. Include who
// did it and the time and date of it happening." Two tabs:
//   1. Activity Log  -- every create/update/archive/restore, who did it,
//      when, and (for updates) exactly which fields changed, old -> new.
//   2. Archived Records -- the flip side of "nothing is ever deleted": a
//      browsable, restorable list of every archived Employee, Intern,
//      Candidate, and Account.
// Both read from data the backend already writes on every mutating action
// (lib/auditLog.js + the is_archived columns) -- this page is purely a
// viewer, it doesn't change how anything else in the app works.
// ---------------------------------------------------------------------------

const ENTITY_META = {
    employee:  { label: 'Employee',   plural: 'Employees',   icon: 'people',         restorePath: (id) => `/api/employees/${id}/restore`,             listPath: '/api/employees' },
    intern:    { label: 'Intern',     plural: 'Interns',      icon: 'graduationCap',  restorePath: (id) => `/api/interns/${id}/restore`,               listPath: '/api/interns' },
    candidate: { label: 'Candidate',  plural: 'Candidates',   icon: 'briefcase',      restorePath: (id) => `/api/recruitment/candidates/${id}/restore`, listPath: '/api/recruitment/candidates' },
    user:      { label: 'Account',    plural: 'Accounts',     icon: 'shield',         restorePath: (id) => `/api/users/${id}/restore`,                 listPath: '/api/users' },
};

const ACTION_META = {
    create:  { label: 'Created',  bg: '#e6f4ea', color: '#137333' },
    update:  { label: 'Edited',   bg: '#e3f2fd', color: '#1565c0' },
    archive: { label: 'Archived', bg: '#fce8e6', color: '#c5221f' },
    restore: { label: 'Restored', bg: '#fff3e0', color: '#e65100' },
};

function ActionPill({ action }) {
    const meta = ACTION_META[action] || { label: action, bg: '#f5f5f5', color: '#757575' };
    return (
        <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px',
            borderRadius: 10, background: meta.bg, color: meta.color, letterSpacing: 0.3,
        }}>
            {meta.label}
        </span>
    );
}

function fmtDateTime(v) {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleString('en-PH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit',
        });
    } catch {
        return v;
    }
}

function fmtFieldName(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtValue(v) {
    if (v === null || v === undefined || v === '') return <span style={{ color: '#cbd5e0', fontStyle: 'italic' }}>empty</span>;
    return String(v);
}

// Expandable per-row detail: which fields changed, old value -> new value.
// Only 'update' entries have this (create/archive/restore carry no diff).
function ChangesDetail({ changes }) {
    if (!changes || changes.length === 0) return null;
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
            <thead>
                <tr>
                    <th style={{ textAlign: 'left', fontSize: 10.5, color: '#a0aec0', fontWeight: 700, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}>Field</th>
                    <th style={{ textAlign: 'left', fontSize: 10.5, color: '#a0aec0', fontWeight: 700, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}>Before</th>
                    <th style={{ textAlign: 'left', fontSize: 10.5, color: '#a0aec0', fontWeight: 700, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}>After</th>
                </tr>
            </thead>
            <tbody>
                {changes.map((chg, i) => (
                    <tr key={i}>
                        <td style={{ fontSize: 12.5, fontWeight: 600, color: '#4a5568', padding: '4px 8px', whiteSpace: 'nowrap' }}>{fmtFieldName(chg.field)}</td>
                        <td style={{ fontSize: 12.5, color: '#c5221f', padding: '4px 8px' }}>{fmtValue(chg.old_value)}</td>
                        <td style={{ fontSize: 12.5, color: '#137333', padding: '4px 8px' }}>{fmtValue(chg.new_value)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function ActivityLogTab() {
    const [entries, setEntries] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const [filterEntity, setFilterEntity] = useState('All');
    const [filterAction, setFilterAction] = useState('All');
    const [search, setSearch] = useState('');

    const [page, setPage] = useState(0);
    const PAGE_SIZE = 50;

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (filterEntity !== 'All') params.set('entityType', filterEntity);
            if (filterAction !== 'All') params.set('action', filterAction);
            params.set('limit', String(PAGE_SIZE));
            params.set('offset', String(page * PAGE_SIZE));

            const res = await fetch(`/api/audit-log?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load activity log.');
            setEntries(Array.isArray(data.entries) ? data.entries : []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [filterEntity, filterAction, page]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(0); }, [filterEntity, filterAction]);

    const filtered = useMemo(() => {
        if (!search.trim()) return entries;
        const q = search.toLowerCase();
        return entries.filter(e =>
            (e.entity_label || '').toLowerCase().includes(q) ||
            (e.performed_by_name || '').toLowerCase().includes(q)
        );
    }, [entries, search]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div>
            <div className="search-filter-bar">
                <div className="search-input-wrap">
                    <span className="search-icon"><Icon name="search" size={15} /></span>
                    <input
                        className="search-input"
                        type="text"
                        placeholder="Search by record name or who made the change…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
                </div>
                <select className="filter-select" value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
                    <option value="All">All Record Types</option>
                    <option value="employee">Employees</option>
                    <option value="intern">Interns</option>
                    <option value="candidate">Recruitment Candidates</option>
                    <option value="user">User Accounts</option>
                </select>
                <select className="filter-select" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                    <option value="All">All Actions</option>
                    <option value="create">Created</option>
                    <option value="update">Edited</option>
                    <option value="archive">Archived</option>
                    <option value="restore">Restored</option>
                </select>
                <span className="results-count">{total} total {total === 1 ? 'entry' : 'entries'}</span>
            </div>

            {error && <div className="login-error">Could not load activity log: {error}</div>}

            <div className="table-card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: 24 }}></th>
                            <th>Record</th>
                            <th>Type</th>
                            <th>Action</th>
                            <th>Performed By</th>
                            <th>Date &amp; Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>Loading…</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0', fontStyle: 'italic' }}>
                                    No activity recorded yet.
                                </td>
                            </tr>
                        ) : filtered.map(entry => {
                            const meta = ENTITY_META[entry.entity_type] || { label: entry.entity_type, icon: 'file' };
                            const isExpanded = expandedId === entry.id;
                            const hasDetail = entry.action === 'update' && entry.changes && entry.changes.length > 0;
                            return (
                                <React.Fragment key={entry.id}>
                                    <tr
                                        className="table-row"
                                        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
                                        onClick={() => hasDetail && setExpandedId(isExpanded ? null : entry.id)}
                                    >
                                        <td>
                                            {hasDetail && (
                                                <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: '#a0aec0', fontSize: 11 }}>
                                                    ▶
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600, fontSize: 13, color: '#1a202c' }}>
                                            {entry.entity_label || <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>Record #{entry.entity_id}</span>}
                                        </td>
                                        <td>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#718096' }}>
                                                <Icon name={meta.icon} size={13} /> {meta.label}
                                            </span>
                                        </td>
                                        <td><ActionPill action={entry.action} /></td>
                                        <td style={{ fontSize: 12.5, color: '#4a5568', fontWeight: 500 }}>
                                            {entry.performed_by_name || <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>System</span>}
                                        </td>
                                        <td style={{ fontSize: 12, color: '#a0aec0', whiteSpace: 'nowrap' }}>{fmtDateTime(entry.created_at)}</td>
                                    </tr>
                                    {isExpanded && hasDetail && (
                                        <tr>
                                            <td></td>
                                            <td colSpan={5} style={{ background: '#f8fafc', padding: '6px 12px 12px' }}>
                                                <ChangesDetail changes={entry.changes} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {!loading && total > PAGE_SIZE && (
                <div className="pagination-bar">
                    <span className="pagination-summary">
                        Page {page + 1} of {totalPages}
                    </span>
                    <div className="pagination-controls">
                        <button className="pagination-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹ Prev</button>
                        <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next ›</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function recordDisplayName(entityType, record) {
    if (entityType === 'employee') {
        const name = [record.last_name, record.first_name].filter(Boolean).join(', ');
        return record.emp_id ? `${record.emp_id} — ${name}` : name || `Record #${record.id}`;
    }
    if (entityType === 'intern') {
        return [record.last_name, record.first_name].filter(Boolean).join(', ') || record.complete_name || `Record #${record.id}`;
    }
    if (entityType === 'candidate') {
        return record.candidate_name || `Record #${record.id}`;
    }
    if (entityType === 'user') {
        return record.full_name || record.username || record.email || `Record #${record.id}`;
    }
    return `Record #${record.id}`;
}

function ArchivedRecordsTab({ showToast }) {
    const [entityType, setEntityType] = useState('employee');
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [restoringId, setRestoringId] = useState(null);
    const [search, setSearch] = useState('');

    const meta = ENTITY_META[entityType];

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${meta.listPath}?includeArchived=1`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load archived records.');
            setRecords(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [meta.listPath]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        if (!search.trim()) return records;
        const q = search.toLowerCase();
        return records.filter(r => recordDisplayName(entityType, r).toLowerCase().includes(q));
    }, [records, search, entityType]);

    const handleRestore = async (record) => {
        setRestoringId(record.id);
        try {
            const res = await fetch(meta.restorePath(record.id), { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not restore this record.');
            setRecords(prev => prev.filter(r => r.id !== record.id));
            showToast('success', `${recordDisplayName(entityType, record)} restored.`);
        } catch (err) {
            showToast('error', err.message);
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <div>
            <div className="search-filter-bar">
                <div className="search-input-wrap">
                    <span className="search-icon"><Icon name="search" size={15} /></span>
                    <input
                        className="search-input"
                        type="text"
                        placeholder="Search archived records by name…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
                </div>
                <select className="filter-select" value={entityType} onChange={e => setEntityType(e.target.value)}>
                    {Object.entries(ENTITY_META).map(([key, m]) => (
                        <option key={key} value={key}>{m.plural}</option>
                    ))}
                </select>
                <span className="results-count">{filtered.length} archived {filtered.length === 1 ? meta.label.toLowerCase() : meta.plural.toLowerCase()}</span>
            </div>

            {error && <div className="login-error">Could not load archived records: {error}</div>}

            <div className="table-card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Archived On</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>Loading…</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#a0aec0', fontStyle: 'italic' }}>
                                    No archived {meta.plural.toLowerCase()}.
                                </td>
                            </tr>
                        ) : filtered.map(record => (
                            <tr key={record.id} className="table-row">
                                <td style={{ fontWeight: 600, fontSize: 13, color: '#1a202c' }}>
                                    {recordDisplayName(entityType, record)}
                                </td>
                                <td style={{ fontSize: 12, color: '#a0aec0' }}>{fmtDateTime(record.archived_at)}</td>
                                <td>
                                    <button
                                        className="btn-primary"
                                        style={{ fontSize: 11.5, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                        disabled={restoringId === record.id}
                                        onClick={() => handleRestore(record)}
                                    >
                                        <Icon name="refresh" size={13} />
                                        {restoringId === record.id ? 'Restoring…' : 'Restore'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function History() {
    const [tab, setTab] = useState('activity');
    const [toast, setToast] = useState(null);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    }, []);

    return (
        <div className="page-container">
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            <div className="page-header">
                <div>
                    <h1 className="page-title">History</h1>
                    <p className="page-subtitle">
                        Every edit, archive, and restore across Employees, Interns, Recruitment, and Accounts --
                        who did it and when. Nothing in this system is ever permanently deleted; archived
                        records can be brought back here.
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid #e2e8f0' }}>
                <button
                    onClick={() => setTab('activity')}
                    style={{
                        padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                        fontSize: 13.5, fontWeight: 600,
                        color: tab === 'activity' ? '#1D9FDA' : '#a0aec0',
                        borderBottom: tab === 'activity' ? '2px solid #1D9FDA' : '2px solid transparent',
                        marginBottom: -1,
                    }}
                >
                    Activity Log
                </button>
                <button
                    onClick={() => setTab('archived')}
                    style={{
                        padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                        fontSize: 13.5, fontWeight: 600,
                        color: tab === 'archived' ? '#1D9FDA' : '#a0aec0',
                        borderBottom: tab === 'archived' ? '2px solid #1D9FDA' : '2px solid transparent',
                        marginBottom: -1,
                    }}
                >
                    Archived Records
                </button>
            </div>

            {tab === 'activity' ? <ActivityLogTab /> : <ArchivedRecordsTab showToast={showToast} />}
        </div>
    );
}
