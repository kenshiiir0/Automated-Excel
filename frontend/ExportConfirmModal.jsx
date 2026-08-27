import React from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';

// Small confirmation step before an Excel export actually runs. Tells the
// person exactly how many rows are about to be downloaded, and whether
// that's the full list or just what their current search/filters have
// narrowed it down to -- so a click doesn't silently export more or less
// than they expected.
//
// "Filtered" is decided by comparing filteredCount to totalCount rather
// than inspecting each page's individual filter/search state -- simpler,
// and it can't miss a filter some page adds later that this component
// doesn't know about.
export default function ExportConfirmModal({ itemLabel, filteredCount, totalCount, onConfirm, onClose }) {
    const isFiltered = filteredCount !== totalCount;

    return (
        <Modal title="Export to Excel" onClose={onClose} maxWidth={420}>
            <p style={{ fontSize: 13.5, color: '#4a5568', marginTop: 0, lineHeight: 1.5 }}>
                {isFiltered ? (
                    <>
                        Your search/filters are narrowing this down. Export will include{' '}
                        <strong>{filteredCount} {itemLabel}{filteredCount === 1 ? '' : 's'}</strong> (out of {totalCount} total) --
                        exactly what's currently shown on screen.
                    </>
                ) : (
                    <>
                        No filters are active. Export will include{' '}
                        <strong>all {totalCount} {itemLabel}{totalCount === 1 ? '' : 's'}</strong>.
                    </>
                )}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                <button type="button" className="btn-primary" onClick={onConfirm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="download" size={14} /> Export {filteredCount} {itemLabel}{filteredCount === 1 ? '' : 's'}
                </button>
            </div>
        </Modal>
    );
}
