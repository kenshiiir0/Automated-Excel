import React, { useState, useRef, useEffect } from 'react';
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
export default function CustomSelect({ value, onChange, options, className = '', placeholder, disabled = false, style }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const normalized = options.map(o => (typeof o === 'object' && o !== null) ? o : { value: o, label: String(o) });
    const selected = normalized.find(o => String(o.value) === String(value));

    return (
        <div className="custom-select-wrap" ref={wrapRef} style={{ position: 'relative', ...style }}>
            <div
                className={`custom-select-control ${className} ${disabled ? 'custom-select-disabled' : ''}`}
                onClick={() => { if (!disabled) setOpen(o => !o); }}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(o => !o); } }}
            >
                <span className={`custom-select-value ${!selected ? 'custom-select-placeholder' : ''}`}>
                    {selected ? selected.label : (placeholder || '')}
                </span>
                <Icon name="chevronDown" size={14} className={`custom-select-arrow ${open ? 'custom-select-arrow-open' : ''}`} />
            </div>
            {open && !disabled && (
                <div className="custom-select-panel" onMouseDown={e => e.preventDefault()}>
                    {normalized.map(o => (
                        <div
                            key={o.value}
                            className={`custom-select-row ${String(o.value) === String(value) ? 'custom-select-row-active' : ''}`}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                        >
                            {o.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
