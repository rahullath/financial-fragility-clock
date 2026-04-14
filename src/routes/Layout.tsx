/**
 * Layout — wraps every route except /present
 * Contains: Sidebar + status bar (live timestamp + version + keyboard hint)
 * Sidebar toggle state persisted to localStorage.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import TutorialOverlay from '../components/TutorialOverlay';
import ErrorBoundary from '../components/ErrorBoundary';
import { useTutorialContext } from '../contexts/TutorialContext';
import { useModelContext } from '../contexts/ModelContext';
import { TUTORIAL_STEPS } from '../config/tutorialSteps';
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

  const { startTutorial, isCompleted } = useTutorialContext();
  const { extendedDataError, isLoadingExtendedData } = useModelContext();

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
          {isLoadingExtendedData && (
            <>
              <span className="statusbar-sep" aria-hidden="true">·</span>
              <span className="statusbar-label" style={{ color: 'var(--color-warning, #f39c12)' }}>
                Loading extended data...
              </span>
            </>
          )}
          {extendedDataError && (
            <>
              <span className="statusbar-sep" aria-hidden="true">·</span>
              <span className="statusbar-label" style={{ color: 'var(--color-error, #e74c3c)' }} title={extendedDataError}>
                ⚠ Some features unavailable
              </span>
            </>
          )}
          <div className="statusbar-right">
            <button
              className="tutorial-trigger-button"
              onClick={startTutorial}
              aria-label="Start tutorial"
              title="Start interactive tutorial"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx={12} cy={12} r={10} />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <circle cx={12} cy={17} r={0.5} fill="currentColor" />
              </svg>
              {!isCompleted && <span className="tutorial-badge" aria-label="New">!</span>}
            </button>
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
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>

        {/* Footer */}
        <footer className="app-footer">
          Fragility Index v1.0 · Minsky (1992) · ISE 2009–2011 / Global 2003–2025
          · Random Forest + OLS · Last recalibrated Apr 2026 · Group 5 · MSc FinTech · Birmingham
        </footer>
      </div>

      {/* Tutorial overlay */}
      <TutorialOverlay steps={TUTORIAL_STEPS} />
    </div>
  );
};

export default Layout;
