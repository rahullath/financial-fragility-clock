/**
 * Layout.tsx — Kraken shell
 * Sidebar (collapsible) + sticky topbar + scrollable main area
 */

import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Layout.css';

// ── Nav config ──────────────────────────────────────────────────

const NAV = [
  {
    section: 'Analysis',
    items: [
      { to: '/',          label: 'Clock',       icon: IconClock },
      { to: '/dashboard', label: 'Data Room',   icon: IconData },
      { to: '/model',     label: 'Model Lab',   icon: IconModel },
      { to: '/history',   label: 'Crisis Log',  icon: IconHistory },
    ],
  },
  {
    section: 'Report',
    items: [
      { to: '/methods',   label: 'Methodology', icon: IconMethods },
      { to: '/report',    label: 'Report',      icon: IconReport },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/':          'Clock',
  '/dashboard': 'Data Room',
  '/model':     'Model Lab',
  '/history':   'Crisis Log',
  '/methods':   'Methodology',
  '/report':    'Report',
};

// ── Logo SVG ─────────────────────────────────────────────────────

function LogoMark() {
  return (
    <svg className="sidebar-logo-icon" viewBox="0 0 28 28" fill="none" aria-label="Financial Fragility Clock">
      {/* Clock face */}
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5"/>
      {/* Clock hands — pointing to ~11:58 (near midnight = fragility metaphor) */}
      <line x1="14" y1="14" x2="14" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="8" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Crisis tick mark */}
      <circle cx="14" cy="3" r="1.5" fill="currentColor" opacity="0.5"/>
      <circle cx="14" cy="14" r="2" fill="currentColor"/>
    </svg>
  );
}

// ── Icon set (inline SVG, 16×16) ─────────────────────────────────

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconData() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconModel() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v5h5"/>
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  );
}
function IconMethods() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  );
}
function IconReport() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

// ── Layout component ──────────────────────────────────────────────

interface LayoutProps { children: React.ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Dashboard';

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`}
             aria-label="Main navigation">

        {/* Logo */}
        <NavLink to="/" className="sidebar-logo" onClick={() => setMobileOpen(false)}>
          <LogoMark />
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">Fragility Clock</span>
            <span className="sidebar-logo-sub">ISE² · Turkey</span>
          </div>
        </NavLink>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="sidebar-section-label">{group.section}</div>
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? label : undefined}
                >
                  <Icon />
                  <span className="nav-item-label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="sidebar-footer">
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
            <span>Collapse</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:199 }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main */}
      <div className="layout-main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-breadcrumb">
            {/* Mobile hamburger */}
            <button
              style={{ display:'none' }}
              className="k-btn k-btn-ghost"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              id="mobile-menu-btn"
            >
              <IconMenu />
            </button>
            <span className="topbar-breadcrumb-sep" style={{ fontSize: 'var(--k-text-sm)', color: 'var(--k-text-faint)' }}>ISE²</span>
            <span className="topbar-breadcrumb-sep">/</span>
            <span className="topbar-breadcrumb-current">{pageTitle}</span>
          </div>

          <div className="topbar-right">
            {/* Crisis status pill — hardcoded to crisis for Turkey 2018–present */}
            <div className="status-pill crisis" title="Turkey ISE² — ongoing currency crisis">
              <span className="status-pulse" />
              <span>Crisis Regime</span>
            </div>

            {/* Present mode link */}
            <a
              href="/present"
              target="_blank"
              rel="noopener noreferrer"
              className="k-btn k-btn-ghost"
              style={{ fontSize: 'var(--k-text-xs)', padding: '4px 10px' }}
              title="Open presentation mode"
            >
              Present
            </a>
          </div>
        </header>

        {/* Page content */}
        <div className="layout-scroll">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
