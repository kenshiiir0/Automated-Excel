import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

// Shared custom-styled dropdown used across the app in place of a native
// <select> -- same look as the Company Rule Violated picker in
// Disciplinary Memos (floating rounded panel, hover-highlighted rows,
// closes on outside click), but without that field's search box /
// hover-preview tooltip / category grouping, since every other dropdown
// in the app has a short, fixed list of options and doesn't need them.
//
// Usage mirrors a native <select>: pass `value`, `onChange(newValue)`,
// and `options` as an array of either plain strings or {value, label}
// objects. `className` is applied to the visible control box so callers
// can reuse existing sizing classes (emp-form-input, filter-select, etc).
//
// `required`: when true, a visually-hidden native <select required> is
// kept in sync with `value` right alongside the visible custom control.
// It participates in the surrounding <form>'s native validation exactly
// like a real required select would (blocks submit, shows the browser's
// "please fill this field" bubble anchored to the visible control) --
// this exists purely so swapping a required native <select> for this
// component doesn't silently drop that validation.
//
// The dropdown panel itself is rendered through a portal into
// document.body, positioned from the control's live bounding rect,
// rather than as a normal DOM child of the control. If it were a normal
// child, any ancestor with `overflow: hidden` -- e.g. the rounded-corner
// .table-card wrapping every data table in this app -- would visually
// clip it the moment it extended past that ancestor's box, which is
// exactly what happened with the Role dropdown in Manage Users: opening
// it near the bottom of a table cell cut the panel off after 2 rows
// instead of showing all of them. Portaling to <body> means the panel's
// only positioning constraint is the viewport, not whatever scrollable/
// clipped container happens to contain the control.
export default function CustomSelect({ value, onChange, options, className = '', placeholder, disabled = false, required = false, style }) {
    const [open, setOpen] = useState(false);
    const [panelRect, setPanelRect] = useState(null);
    const wrapRef = useRef(null);
    const hiddenSelectRef = useRef(null);

    const computeRect = useCallback(() => {
        if (!wrapRef.current) return;
        const r = wrapRef.current.getBoundingClientRect();
        setPanelRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        computeRect();
    }, [open, computeRect]);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target) && !e.target.closest?.('.custom-select-panel')) {
                setOpen(false);
            }
        };
        // Keep the floating panel glued to the control if the page scrolls
        // or the window resizes while it's open, since it's no longer a
        // normal in-flow child that would move with the control on its own.
        const handleReposition = () => computeRect();
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleReposition, true);
        window.addEventListener('resize', handleReposition);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleReposition, true);
            window.removeEventListener('resize', handleReposition);
        };
    }, [open, computeRect]);

    const normalized = options.map(o => (typeof o === 'object' && o !== null) ? o : { value: o, label: String(o) });
    const selected = normalized.find(o => String(o.value) === String(value));

    return (
        <div className="custom-select-wrap" ref={wrapRef} style={{ position: 'relative', ...style }}>
            <div
                className={`custom-select-control ${className} ${disabled ? 'custom-select-disabled' : ''}`}
                onClick={() => {
                    if (disabled) return;
                    setOpen(o => !o);
                }}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(o => !o); } }}
            >
                <span className={`custom-select-value ${!selected ? 'custom-select-placeholder' : ''}`}>
                    {selected ? selected.label : (placeholder || '')}
                </span>
                <Icon name="chevronDown" size={14} className={`custom-select-arrow ${open ? 'custom-select-arrow-open' : ''}`} />
            </div>
            {open && !disabled && panelRect && createPortal(
                <div
                    className="custom-select-panel custom-select-panel-portal"
                    style={{ top: panelRect.top, left: panelRect.left, width: panelRect.width }}
                    onMouseDown={e => e.preventDefault()}
                >
                    {normalized.map(o => (
                        <div
                            key={o.value}
                            className={`custom-select-row ${String(o.value) === String(value) ? 'custom-select-row-active' : ''}`}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                        >
                            {o.label}
                        </div>
                    ))}
                </div>,
                document.body
            )}
            {required && (
                <select
                    ref={hiddenSelectRef}
                    className="custom-select-hidden-native"
                    value={value ?? ''}
                    required
                    // Read-only from the user's perspective (the visible
                    // control above is what they interact with) -- this
                    // exists only so the browser's native form validation
                    // sees a required field that is/isn't filled in.
                    onChange={() => {}}
                    tabIndex={-1}
                    aria-hidden="true"
                >
                    <option value="" disabled>—</option>
                    {normalized.filter(o => o.value !== '').map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            )}
        </div>
    );
}
