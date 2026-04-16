/**
 * Layout.tsx — Kraken shell
 * Uses react-router <Outlet/> to render child routes.
 */
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './Layout.css';

const NAV = [
  { section: 'Analysis', items: [
    { to: '/',          label: 'Clock',        Icon: IcClock },
    { to: '/dashboard', label: 'Data Room',    Icon: IcData },
    { to: '/model',     label: 'Model Lab',    Icon: IcModel },
    { to: '/history',   label: 'Crisis Log',   Icon: IcHistory },
  ]},
  { section: 'Report', items: [
    { to: '/methods',   label: 'Methodology',  Icon: IcBook },
    { to: '/report',    label: 'Report',       Icon: IcReport },
  ]},
];

const TITLES: Record<string,string> = {
  '/': 'Clock', '/dashboard': 'Data Room',
  '/model': 'Model Lab', '/history': 'Crisis Log',
  '/methods': 'Methodology', '/report': 'Report',
};

function IcClock()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IcData()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function IcModel()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
function IcHistory() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><polyline points="12 7 12 12 15 14"/></svg>; }
function IcBook()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>; }
function IcReport()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function IcLeft()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>; }
function IcRight()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>; }

const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? 'Dashboard';

  return (
    <div className="layout">
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}`}>
        <NavLink to="/" className="sidebar-logo" onClick={() => setMobileOpen(false)}>
          <svg className="sidebar-logo-icon" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="14" y1="14" x2="14" y2="5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="14" y1="14" x2="8.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="14" cy="3" r="1.2" fill="currentColor" opacity="0.6"/>
            <circle cx="14" cy="14" r="1.8" fill="currentColor"/>
          </svg>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">Fragility Clock</span>
            <span className="sidebar-logo-sub">ISE² · Turkey 2009–2024</span>
          </div>
        </NavLink>

        <nav className="sidebar-nav">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="sidebar-section-label">{section}</div>
              {items.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} end={to==='/'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? label : undefined}>
                  <Icon />
                  <span className="nav-item-label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <IcRight /> : <IcLeft />}
            <span>Collapse</span>
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <div className="layout-main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span className="topbar-sep">ISE²</span>
            <span className="topbar-sep" style={{color:'var(--k-text-faint)'}}>/</span>
            <span className="topbar-title">{title}</span>
          </div>
          <div className="topbar-right">
            <div className="status-pill crisis">
              <span className="status-pulse" />
              Crisis Regime
            </div>
          </div>
        </header>
        <main className="layout-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
