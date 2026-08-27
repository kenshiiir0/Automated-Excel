import React, { useEffect, useRef } from 'react';

// Generic popup dialog used for "Add X" forms across the app (Employees,
// Interns, Recruitment) so a long form doesn't push the whole page layout
// around -- it floats over the page instead, and closes on Escape, a
// backdrop click, or its own close button.
export default function Modal({ title, onClose, children, maxWidth = 720 }) {
    const panelRef = useRef(null);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    return (
        <div
            className="modal-overlay"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="modal-panel"
                style={{ maxWidth }}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                ref={panelRef}
            >
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
}
