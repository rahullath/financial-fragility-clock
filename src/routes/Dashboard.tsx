import React from 'react';
import { Link } from 'react-router-dom';
import ClockVisual from '../components/ClockVisual';
import ModelToggle from '../components/ModelToggle';
import RegimeTimeline from '../components/RegimeTimeline';
import DateScrubber from '../components/DateScrubber';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import SHAPChart from '../components/SHAPChart';
import NetworkMST from '../components/NetworkMST';
import ModelPerformanceTable from '../components/ModelPerformanceTable';
import RegimeStatsCard from '../components/RegimeStatsCard';
import CurrentFragilityReading from '../components/CurrentFragilityReading';
import ModelComparisonPanel from '../components/ModelComparisonPanel';

import { useModelContext } from '../contexts/ModelContext';

/**
 * Dashboard
 * Main interactive exploration route
 */
const Dashboard: React.FC = () => {
  const { selectedModel } = useModelContext();

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-title-block">
            <h1>Financial Fragility Clock</h1>
            <p>Minsky-regime-aware composite risk index</p>
          </div>
          
          <div className="app-header-controls" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <nav style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/present" className="nav-link">Presentation Mode</Link>
              <Link to="/methods" className="nav-link">Methodology</Link>
            </nav>
            <ModelToggle />
          </div>
        </div>
      </header>

      {/* ── Main dashboard ────────────────────────────────────────────────── */}
      <main className="app-main">
        {selectedModel === 'B' && (
          <section className="dash-row dash-row--top" style={{ marginBottom: '1.5rem' }}>
            <CurrentFragilityReading />
          </section>
        )}

        {/* Row 1 — Clock + Timeline */}
        <section className="dash-row dash-row--top">
          <div className="dash-cell dash-cell--clock">
            <ClockVisual />
          </div>
          <div className="dash-cell dash-cell--timeline">
            <RegimeTimeline />
          </div>
        </section>

        {/* Row 2 — Date Scrubber (full width) */}
        <section className="dash-row dash-row--scrubber">
          <DateScrubber />
        </section>

        {/* Row 3 — Heatmap + SHAP + MST */}
        <section className="dash-row dash-row--trio">
          <div className="dash-cell">
            <CorrelationHeatmap />
          </div>
          <div className="dash-cell">
            <SHAPChart />
          </div>
          <div className="dash-cell">
            <NetworkMST />
          </div>
        </section>

        {/* Row 4 — Performance Table + Regime Stats */}
        <section className="dash-row dash-row--bottom">
          <div className="dash-cell">
            <ModelPerformanceTable />
          </div>
          <div className="dash-cell">
            <RegimeStatsCard />
          </div>
        </section>

        {/* Comparison Panel */}
        <section className="dash-row dash-row--bottom">
          <ModelComparisonPanel />
        </section>
      </main>

      <footer className="app-footer">
        <span>Financial Fragility Clock · Minsky (1992) · ISE / Global 2003–2025</span>
      </footer>
    </div>
  );
};

export default Dashboard;
