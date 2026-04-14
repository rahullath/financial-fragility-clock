/**
 * Dashboard — spec v2 layout
 *
 * Layout:
 *   HEADER (compact sticky) — title + [Adv ▾] dropdown + [Present] [Methods] links
 *   STAT STRIP (full width)
 *   LEFT: DoomsdayClock   RIGHT: RegimeTimeline
 *   DATE SCRUBBER (full width)
 *   CRISIS SELECTOR (full width)
 *   TRIO: CorrelationHeatmap | SHAPChart | NetworkMST
 *   BOTTOM: ModelPerformanceTable | RegimeStatsCard
 *
 * Advanced dropdown contains: ModelToggle, ModelComparisonPanel
 */

import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

import DoomsdayClock from '../components/DoomsdayClock';
import StatStrip from '../components/StatStrip';
import CrisisSelector from '../components/CrisisSelector';
import RegimeTimeline from '../components/RegimeTimeline';
import DateScrubber from '../components/DateScrubber';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import SHAPChart from '../components/SHAPChart';
import NetworkMST from '../components/NetworkMST';
import ModelPerformanceTable from '../components/ModelPerformanceTable';
import RegimeStatsCard from '../components/RegimeStatsCard';
import ModelToggle from '../components/ModelToggle';
import ModelComparisonPanel from '../components/ModelComparisonPanel';
import RegimeTransitionMatrix from '../components/RegimeTransitionMatrix';
import VolatilityClusteringChart from '../components/VolatilityClusteringChart';
import CorrelationNetworkEvolution from '../components/CorrelationNetworkEvolution';
import ResponsiveContainer from '../components/ResponsiveContainer';

const Dashboard: React.FC = () => {
  const [advOpen, setAdvOpen] = useState(false);
  const advRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (advRef.current && !advRef.current.contains(e.target as Node)) {
        setAdvOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-title-block">
            <h1>Financial Fragility Clock</h1>
            <p>Minsky · crash proximity detector · ISE / Global 2003–2025</p>
          </div>

          <div className="app-header-controls">
            <nav>
              <Link to="/present" className="nav-link">Present</Link>
              <Link to="/methods" className="nav-link">Methods</Link>
            </nav>

            {/* Advanced dropdown */}
            <div className="adv-dropdown" ref={advRef}>
              <button
                className="btn-adv"
                onClick={() => setAdvOpen((o) => !o)}
                aria-expanded={advOpen}
                aria-haspopup="true"
                id="adv-btn"
              >
                Adv {advOpen ? '▴' : '▾'}
              </button>

              {advOpen && (
                <div className="adv-panel" role="dialog" aria-labelledby="adv-btn">
                  <div className="adv-panel-section">
                    <span className="adv-panel-label">Model selection</span>
                    <ModelToggle />
                  </div>
                  <div className="adv-panel-section">
                    <span className="adv-panel-label">Model comparison (2009–2011)</span>
                    <ModelComparisonPanel />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="app-main">

        {/* Stat strip */}
        <ResponsiveContainer priority="high" mobileLayout="scroll">
          <section className="dash-row dash-row--full">
            <StatStrip />
          </section>
        </ResponsiveContainer>

        {/* Clock + Timeline */}
        <ResponsiveContainer priority="high" mobileLayout="stack">
          <section className="dash-row dash-row--top">
            <div className="dash-cell">
              <DoomsdayClock />
            </div>
            <div className="dash-cell">
              <RegimeTimeline />
            </div>
          </section>
        </ResponsiveContainer>

        {/* Date Scrubber */}
        <ResponsiveContainer priority="high" mobileLayout="stack">
          <section className="dash-row dash-row--full">
            <DateScrubber />
          </section>
        </ResponsiveContainer>

        {/* Crisis Selector */}
        <ResponsiveContainer priority="medium" mobileLayout="scroll">
          <section className="dash-row dash-row--full">
            <CrisisSelector />
          </section>
        </ResponsiveContainer>

        {/* Trio: Heatmap + SHAP + MST */}
        <ResponsiveContainer priority="medium" mobileLayout="stack">
          <section className="dash-row dash-row--trio">
            <div className="dash-cell"><CorrelationHeatmap /></div>
            <div className="dash-cell"><SHAPChart /></div>
            <div className="dash-cell"><NetworkMST /></div>
          </section>
        </ResponsiveContainer>

        {/* Regime Transition Matrix */}
        <ResponsiveContainer priority="medium" mobileLayout="collapse">
          <section className="dash-row dash-row--full">
            <RegimeTransitionMatrix />
          </section>
        </ResponsiveContainer>

        {/* Volatility Clustering */}
        <ResponsiveContainer priority="low" mobileLayout="collapse">
          <section className="dash-row dash-row--full">
            <VolatilityClusteringChart />
          </section>
        </ResponsiveContainer>

        {/* Correlation Network Evolution */}
        <ResponsiveContainer priority="low" mobileLayout="collapse">
          <section className="dash-row dash-row--full">
            <CorrelationNetworkEvolution />
          </section>
        </ResponsiveContainer>

        {/* Performance Table + Regime Stats */}
        <ResponsiveContainer priority="low" mobileLayout="stack">
          <section className="dash-row dash-row--bottom">
            <div className="dash-cell"><ModelPerformanceTable /></div>
            <div className="dash-cell"><RegimeStatsCard /></div>
          </section>
        </ResponsiveContainer>

      </main>

      <footer className="app-footer">
        <span>Financial Fragility Clock · Minsky (1992) · ISE / Global 2003–2025 · Group 5 · MSc FinTech · Birmingham</span>
      </footer>
    </div>
  );
};

export default Dashboard;
