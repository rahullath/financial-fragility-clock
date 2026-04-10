/**
 * Sidebar — fixed left navigation
 * Collapsed (icon only, 52px) ↔ Expanded (icon + label, 210px)
 * State persisted to localStorage.
 * Hidden on /present.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

// ── Nav items ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    to: '/',
    exact: true,
    label: 'Clock',
    sub: 'Fragility score',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx={12} cy={12} r={9} />
        <line x1={12} y1={6} x2={12} y2={12} />
        <line x1={12} y1={12} x2={15.5} y2={9.5} />
        <circle cx={12} cy={12} r={1} fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    to: '/dashboard',
    exact: false,
    label: 'Data Room',
    sub: 'Charts & heatmaps',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x={3} y={3} width={7} height={7} rx={1} />
        <rect x={14} y={3} width={7} height={7} rx={1} />
        <rect x={3} y={14} width={7} height={7} rx={1} />
        <rect x={14} y={14} width={7} height={7} rx={1} />
      </svg>
    ),
  },
  {
    to: '/model',
    exact: false,
    label: 'ML Lab',
    sub: 'SHAP & predictions',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" />
      </svg>
    ),
  },
  {
    to: '/history',
    exact: false,
    label: 'Archive',
    sub: 'Crisis timeline',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: '/methods',
    exact: false,
    label: 'Methods',
    sub: 'Theory & maths',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
];

const BOTTOM_ITEMS = [
  {
    to: '/present',
    label: 'Present',
    sub: 'Fullscreen mode',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ expanded, onToggle }) => {

  return (
    <aside
      className={`sidebar ${expanded ? 'sidebar--expanded' : 'sidebar--collapsed'}`}
      aria-label="Main navigation"
    >
      {/* Toggle button */}
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        title={expanded ? 'Collapse (Ctrl+B)' : 'Expand (Ctrl+B)'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          {expanded ? (
            <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />  // chevron left-left
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />           // hamburger
          )}
        </svg>
      </button>

      {/* Wordmark / logo */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon" aria-hidden="true">⚑</div>
        {expanded && (
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Fragility</span>
            <span className="sidebar-brand-sub">Clock</span>
          </div>
        )}
      </div>

      {/* Primary navigation */}
      <nav className="sidebar-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'sidebar-item--active' : ''}`
            }
            title={!expanded ? item.label : undefined}
          >
            <span className="sidebar-item-icon" aria-hidden="true">
              {item.icon}
            </span>
            {expanded && (
              <span className="sidebar-item-text">
                <span className="sidebar-item-label">{item.label}</span>
                <span className="sidebar-item-sub">{item.sub}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="sidebar-divider" role="separator" />

      {/* Bottom navigation */}
      <nav className="sidebar-nav sidebar-nav--bottom" aria-label="Secondary">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="sidebar-item sidebar-item--secondary"
            title={!expanded ? item.label : undefined}
            target="_self"
          >
            <span className="sidebar-item-icon" aria-hidden="true">
              {item.icon}
            </span>
            {expanded && (
              <span className="sidebar-item-text">
                <span className="sidebar-item-label">{item.label}</span>
                <span className="sidebar-item-sub">{item.sub}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
