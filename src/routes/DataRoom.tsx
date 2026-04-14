/**
 * DataRoom — /dashboard
 * All the charts: heatmap, correlations, MST, date scrubber, crisis chips.
 * The DoomsdayClock lives on / — this page is for deep analysis.
 */

import React, { useState, useRef, useEffect } from 'react';

import CrisisSelector from '../components/CrisisSelector';
import DateScrubber from '../components/DateScrubber';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import NetworkMST from '../components/NetworkMST';
import RegimeStatsCard from '../components/RegimeStatsCard';
import ModelToggle from '../components/ModelToggle';
import ModelComparisonPanel from '../components/ModelComparisonPanel';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { usePageTitle } from '../hooks/usePageTitle';

// ── Adv dropdown (model switching) ───────────────────────────────────────────

const AdvDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="adv-dropdown" ref={ref}>
      <button
        className="btn-adv"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Model {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="adv-panel">
          <div className="adv-panel-section">
            <span className="adv-panel-label">Model selection</span>
            <ModelToggle />
          </div>
          <div className="adv-panel-section">
            <span className="adv-panel-label">Model comparison</span>
            <ModelComparisonPanel />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Page header ───────────────────────────────────────────────────────────────

const PageHeader: React.FC = () => (
  <div className="page-header">
    <div className="page-header-title">
      <h1>Data Room</h1>
      <p>Correlation heatmaps · Network topology · Regime statistics</p>
    </div>
    <AdvDropdown />
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────

const DataRoom: React.FC = () => {
  usePageTitle('Data Room');
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader />

      {/* Scrubber + crisis selector */}
      <ResponsiveContainer priority="high" mobileLayout="stack">
        <div className="dash-row dash-row--full">
          <DateScrubber />
        </div>
      </ResponsiveContainer>
      
      <ResponsiveContainer priority="medium" mobileLayout="scroll">
        <div className="dash-row dash-row--full">
          <CrisisSelector />
        </div>
      </ResponsiveContainer>

      {/* Heatmap — full width, most important chart */}
      <ResponsiveContainer priority="high" mobileLayout="stack">
        <div className="dash-row dash-row--full">
          <CorrelationHeatmap />
        </div>
      </ResponsiveContainer>

      {/* MST + Regime stats side by side */}
      <ResponsiveContainer priority="medium" mobileLayout="stack">
        <div className="dash-row dash-row--bottom">
          <div className="dash-cell"><NetworkMST /></div>
          <div className="dash-cell"><RegimeStatsCard /></div>
        </div>
      </ResponsiveContainer>
    </div>
  );
};

export default DataRoom;
