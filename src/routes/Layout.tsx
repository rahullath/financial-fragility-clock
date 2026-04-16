/**
 * Layout.tsx — top navbar shell (no sidebar)
 * Light/warm palette, human nav, regime pill, dark mode toggle
 */
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './Layout.css';

// ── Tiny inline SVG icons ──────────────────────────────────────────

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6"  y1="6" x2="18" y2="18"/>
  </svg>
);

// Clock logo mark — minute hand near midnight
const LogoMark = () => (
  <svg className="navbar-logo" width="26" height="26" viewBox="0 0 26 26" fill="none"
       aria-hidden="true">
    <circle cx="13" cy="13" r="11" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="13" y1="13" x2="13" y2="4"  stroke="currentColor" strokeWidth="2"   strokeLinecap="round"/>
    <line x1="13" y1="13" x2="7.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="13" cy="13" r="1.75" fill="currentColor"/>
  </svg>
);

// ── Nav items ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/',          label: 'Overview',    end: true },
  { to: '/dashboard', label: 'Data Room',   end: false },
  { to: '/model',     label: 'Model Lab',   end: false },
  { to: '/history',   label: 'Crisis Log',  end: false },
  { to: '/methods',   label: 'Methodology', end: false },
  { to: '/report',    label: 'Report',      end: false },
];

// ── Layout ─────────────────────────────────────────────────────────

const Layout: React.FC = () => {
  const [theme, setTheme] = useState<'light'|'dark'>('light');
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <div className="layout-body">
      {/* ── Navbar ── */}
      <nav className="navbar" role="navigation" aria-label="Main">
        <NavLink to="/" className="navbar-brand">
          <LogoMark />
          <div className="navbar-brand-text">
            <span className="navbar-brand-name">Fragility Clock</span>
            <span className="navbar-brand-sub">ISE² · Turkey 2009–2024</span>
          </div>
        </NavLink>

        {/* Desktop nav */}
        <div className="navbar-nav">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                'nav-link' + (isActive ? ' active' : '')
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Right */}
        <div className="navbar-right">
          <div className="regime-pill ponzi">
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
      <div className={`navbar-drawer${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        {NAV_ITEMS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* Page outlet */}
      <Outlet />
    </div>
  );
};

export default Layout;
