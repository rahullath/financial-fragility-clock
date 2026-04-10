/**
 * Layout — wraps every route except /present
 * Contains: Sidebar + status bar (live timestamp + version + keyboard hint)
 * Sidebar toggle state persisted to localStorage.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

// Live timestamp component
const LiveClock: React.FC = () => {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = time.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'UTC',
  });
  return <span className="statusbar-clock">{fmt} UTC</span>;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar-expanded') !== 'false';
    } catch {
      return true;
    }
  });

  const toggle = useCallback(() => {
    setExpanded((e) => {
      const next = !e;
      try { localStorage.setItem('sidebar-expanded', String(next)); } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggle(); }
      if ((e.key === 'p' || e.key === 'P') && !window.location.pathname.includes('present')) {
        window.location.href = '/present';
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  const sidebarW = expanded ? 'var(--sidebar-w-expanded)' : 'var(--sidebar-w-collapsed)';

  return (
    <div className="app-shell">
      <Sidebar expanded={expanded} onToggle={toggle} />

      {/* Main area pushes right by sidebar width */}
      <div
        className="app-content"
        style={{ marginLeft: sidebarW }}
      >
        {/* Status bar */}
        <div className="statusbar" role="status">
          <span className="statusbar-indicator" aria-hidden="true" />
          <span className="statusbar-label">Live · Fragility Index v1.0</span>
          <span className="statusbar-sep" aria-hidden="true">·</span>
          <span className="statusbar-label">ISE / Global 2003–2025 · RF + OLS</span>
          <div className="statusbar-right">
            <span className="statusbar-hint">
              <kbd>Ctrl</kbd>+<kbd>B</kbd> sidebar
              <span className="statusbar-sep" aria-hidden="true">·</span>
              <kbd>P</kbd> present
            </span>
            <LiveClock />
          </div>
        </div>

        {/* Page content */}
        <main className="page-main">
          {children}
        </main>

        {/* Footer */}
        <footer className="app-footer">
          Fragility Index v1.0 · Minsky (1992) · ISE 2009–2011 / Global 2003–2025
          · Random Forest + OLS · Last recalibrated Apr 2026 · Group 5 · MSc FinTech · Birmingham
        </footer>
      </div>
    </div>
  );
};

export default Layout;
