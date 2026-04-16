/**
 * Layout.tsx — Kraken-style top navbar (replaces sidebar)
 * Light default, IBM Plex Sans, Kraken Purple accent, dark toggle.
 * Reads DESIGN.md: https://github.com/rahullath/financial-fragility-clock/blob/turkey/DESIGN.md
 */
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './Layout.css';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IcData = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IcModel = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IcHistory = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v5h5"/>
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
    <polyline points="12 7 12 12 15 14"/>
  </svg>
);
const IcBook = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const IcReport = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
);
const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6"  x2="6"  y2="18"/>
    <line x1="6"  y1="6"  x2="18" y2="18"/>
  </svg>
);

// Clock SVG logo — minute hand near midnight
const LogoMark = () => (
  <svg className="navbar-logo" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="14" y1="14" x2="14" y2="5.5"  stroke="currentColor" strokeWidth="2"   strokeLinecap="round"/>
    <line x1="14" y1="14" x2="8.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="14" cy="3" r="1.2" fill="currentColor" opacity="0.5"/>
    <circle cx="14" cy="14" r="1.8" fill="currentColor"/>
  </svg>
);

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/',          label: 'Clock',       Icon: IcClock,   end: true  },
  { to: '/dashboard', label: 'Data Room',   Icon: IcData,    end: false },
  { to: '/model',     label: 'Model Lab',   Icon: IcModel,   end: false },
  { to: '/history',   label: 'Crisis Log',  Icon: IcHistory, end: false },
  { to: '/methods',   label: 'Methodology', Icon: IcBook,    end: false },
  { to: '/report',    label: 'Report',      Icon: IcReport,  end: false },
];

// ── Component ─────────────────────────────────────────────────────────────────
const Layout: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close mobile menu on navigation
  useEffect(() => setMenuOpen(false), [pathname]);

  // Apply theme to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  return (
    <div className="layout-body">

      {/* ── Navbar ── */}
      <nav className="navbar" role="navigation" aria-label="Main">

        {/* Brand */}
        <NavLink to="/" className="navbar-brand">
          <LogoMark />
          <div>
            <span className="navbar-brand-name">Fragility Clock</span>
            <span className="navbar-brand-sub">ISE² · Turkey 2009–2024</span>
          </div>
        </NavLink>

        {/* Desktop nav links */}
        <div className="navbar-nav">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Right: regime pill + theme toggle */}
        <div className="navbar-right">
          <div className="navbar-regime crisis">
            <span className="regime-pulse" />
            Ponzi Regime
          </div>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="navbar-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <XIcon /> : <MenuIcon />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`navbar-drawer${menuOpen ? ' open' : ''}`}
        aria-hidden={!menuOpen}
      >
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
        <div className="navbar-regime crisis">
          <span className="regime-pulse" />
          Ponzi Regime
        </div>
      </div>

      {/* Page content */}
      <div className="layout-scroll">
        <Outlet />
      </div>

    </div>
  );
};

export default Layout;
