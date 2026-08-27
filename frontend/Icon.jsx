import React from 'react';

// Small, flat, single-color line icons (24x24 viewBox, stroke-based) used
// throughout the app in place of pictograph emoji (📊👥🔍🗑️ etc). Emoji
// render as glossy, platform-specific "3D" icons on most systems -- these
// are plain SVG strokes instead, so the UI stays visually consistent
// regardless of OS/browser and matches the rest of the flat design.
//
// Usage: <Icon name="dashboard" /> or <Icon name="search" size={16} />
// currentColor is used for stroke, so these inherit whatever text color
// is set on their container -- no separate color prop needed in most cases.

const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" /><circle cx="17.5" cy="9" r="2.5" /><path d="M15 20c.2-2.7 1.7-4.6 3.5-5" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" /><path d="M3 12h18" /></>,
  graduationCap: <><path d="M2 9l10-5 10 5-10 5-10-5z" /><path d="M6 11.5v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5" /><path d="M22 9v6" /></>,
  logout: <><path d="M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" /><path d="M15 16l5-4-5-4" /><path d="M20 12H9" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" /><path d="M6.5 7l.7 12.2A2 2 0 0 0 9.2 21h5.6a2 2 0 0 0 2-1.8L18 7" /><path d="M10 11v6" /><path d="M14 11v6" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  phone: <path d="M6.6 10.8a15.9 15.9 0 0 0 6.6 6.6l2.2-2.2a1.4 1.4 0 0 1 1.4-.3c1.2.4 2.5.6 3.9.6a1.4 1.4 0 0 1 1.4 1.4v3.5a1.4 1.4 0 0 1-1.4 1.4C10.3 21.8 2.2 13.7 2.2 3.4A1.4 1.4 0 0 1 3.6 2h3.5A1.4 1.4 0 0 1 8.5 3.4c0 1.4.2 2.7.6 3.9a1.4 1.4 0 0 1-.35 1.4L6.6 10.8z" />,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  refresh: <><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6" /><path d="M4 4v4.6h4.6" /><path d="M4 13a8 8 0 0 0 13.7 4.7l2.3-2.3" /><path d="M20 20v-4.6h-4.6" /></>,
  edit: <><path d="M15.5 4.5l4 4L7 21H3v-4L15.5 4.5z" /><path d="M13.5 6.5l4 4" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><rect x="8.5" y="2" width="7" height="4" rx="1" /><path d="M8.5 11h7" /><path d="M8.5 15h7" /></>,
  cake: <><path d="M4 21v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8" /><path d="M2 21h20" /><path d="M4 15c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0 2-1 3 0" /><path d="M12 11V7" /><path d="M12 4a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 12 4z" /></>,
  alertTriangle: <><path d="M12 4L2.5 20h19L12 4z" /><path d="M12 10.5v4" /><path d="M12 17.2v.1" /></>,
  check: <path d="M4 12.5l5 5L20 6" />,
  door: <><rect x="5" y="3" width="10" height="18" rx="1" /><path d="M15 12v.01" /><path d="M19 21H5" /></>,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
  userPlus: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" /><path d="M18 9v5" /><path d="M15.5 11.5h5" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></>,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
  folder: <path d="M3 6a2 2 0 0 1 2-2h4.5l2 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />,
  file: <><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M15 2v5h5" /></>,
  alertDoc: <><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M15 2v5h5" /><path d="M12 11v3" /><path d="M12 17h.01" /></>,
};

export default function Icon({ name, size = 16, strokeWidth = 2, className = '', style = {}, title }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      className={`icon icon-${name} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {paths}
    </svg>
  );
}
