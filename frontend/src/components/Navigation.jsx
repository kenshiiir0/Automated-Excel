import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../authContext.jsx';
import Icon from '../../Icon.jsx';
import { GETMEDS_LOGO_ICON } from '../../brandAssets.js';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/employees', label: 'Employees', icon: 'people' },
  { to: '/recruitment', label: 'Recruitment', icon: 'briefcase' },
  { to: '/interns', label: 'Interns', icon: 'graduationCap' },
  { to: '/hr-documents', label: 'HR Documents', icon: 'folder' },
];

const STORAGE_KEY = 'hr-sidebar-collapsed';

export default function Navigation() {
  const { user, logout, loggingOut } = useAuth();

  // Manage Users is only relevant to accounts that can actually see it --
  // admin can view the account list (read-only), super_admin can also
  // edit roles/status. A plain 'user' account never sees this item.
  const canSeeUserManagement = user?.role === 'admin' || user?.role === 'super_admin';
  // Disciplinary Memos is a write/HR-action capability (generating and
  // emailing NTEs/warnings), gated the same as Manage Users -- admin and
  // super_admin only, not visible to a plain 'user' account.
  const navItems = canSeeUserManagement
    ? [...NAV_ITEMS, { to: '/disciplinary-memos', label: 'Disciplinary Memos', icon: 'alertDoc' }, { to: '/send-files', label: 'Send Files', icon: 'upload' }, { to: '/users', label: 'Manage Users', icon: 'shield' }, { to: '/history', label: 'History', icon: 'clipboard' }]
    : NAV_ITEMS;

  // "collapsed" is the user's pinned preference, remembered across visits.
  // Starts collapsed by default.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // "hovering" is a purely transient, in-memory state (not persisted) that
  // temporarily reveals the full sidebar while collapsed, the way Slack/VS
  // Code do it. Moving the mouse away collapses it back without touching
  // the user's pinned preference.
  const [hovering, setHovering] = useState(false);

  // The pinned state is what actually reserves layout space for the page
  // content -- a hover peek should float on top of the content, not push
  // it around, otherwise the page would jump every time the mouse passes
  // near the sidebar.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore storage errors (private browsing, etc.)
    }
    document.documentElement.style.setProperty(
      '--sidebar-width',
      collapsed ? '64px' : '220px'
    );
  }, [collapsed]);

  // Whether labels/details should actually render right now: either the
  // sidebar is pinned open, or the mouse is currently hovering it.
  const expanded = !collapsed || hovering;

  return (
    <nav
      className={`main-sidebar${collapsed ? ' collapsed' : ''}${expanded && collapsed ? ' hover-peek' : ''}`}
      onMouseEnter={() => collapsed && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <img src={GETMEDS_LOGO_ICON} alt="GetMEDS" className="sidebar-brand-logo" />
          {expanded && (
            <div className="brand-text">
              <span className="brand-title">GetMeds HR</span>
              <span className="brand-subtitle">Analytics &amp; Portal</span>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-links">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            title={!expanded ? item.label : undefined}
          >
            <span className="sidebar-link-icon"><Icon name={item.icon} size={18} /></span>
            {expanded && <span className="sidebar-link-label">{item.label}</span>}
          </NavLink>
        ))}
      </div>

      <div className="sidebar-bottom">
        {user && (
          <NavLink
            to="/profile"
            className={({ isActive }) => `sidebar-profile-link${isActive ? ' active' : ''}`}
            title={!expanded ? `${user.full_name || user.username} -- View profile` : undefined}
          >
            <span className="sidebar-profile-avatar">
              {(user.full_name || user.username || '?').slice(0, 1).toUpperCase()}
            </span>
            {expanded && (
              <span className="sidebar-profile-text">
                <span className="sidebar-profile-name">{user.full_name || user.username}</span>
                <span className="sidebar-profile-role">View profile</span>
              </span>
            )}
          </NavLink>
        )}
        {user && (
          <button
            className="sidebar-toggle"
            onClick={logout}
            disabled={loggingOut}
            aria-label="Log out"
            title={!expanded ? 'Log out' : undefined}
          >
            <span className="sidebar-link-icon">
              {loggingOut ? <span className="btn-spinner" /> : <Icon name="logout" size={18} />}
            </span>
            {expanded && <span>{loggingOut ? 'Signing out…' : 'Log out'}</span>}
          </button>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Pin navigation open' : 'Collapse navigation'}
          title={collapsed ? 'Pin open' : 'Collapse'}
        >
          <span className={`sidebar-toggle-arrow${collapsed ? '' : ' flipped'}`}>›</span>
          {expanded && <span>{collapsed ? 'Pin open' : 'Collapse'}</span>}
        </button>
      </div>
    </nav>
  );
}
