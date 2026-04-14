/**
 * HistoryArchive — /history
 * Full-page annotated regime timeline — the crisis seismograph.
 * RegimeTimeline takes full width with crisis markers overlaid.
 */

import React from 'react';
import RegimeTimeline from '../components/RegimeTimeline';
import DateScrubber from '../components/DateScrubber';
import CrisisSelector from '../components/CrisisSelector';
import DTWSimilarityHeatmap from '../components/DTWSimilarityHeatmap';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { usePageTitle } from '../hooks/usePageTitle';
import { useModelContext } from '../contexts/ModelContext';
import './HistoryArchive.css';

const PageHeader: React.FC = () => (
  <div className="page-header">
    <div className="page-header-title">
      <h1>Crisis Archive</h1>
      <p>Annotated regime timeline · Fragility signal through history · Scrub to replay</p>
    </div>
  </div>
);

const HistoryArchive: React.FC = () => {
  usePageTitle('Crisis Archive');
  const { currentModelData } = useModelContext();
  
  // Use model-specific events from ModelContext
  const crisisAnnotations = currentModelData.keyEvents;
  
  return (
    <div className="history-archive">
      <PageHeader />

      {/* Date scrubber */}
      <DateScrubber />

      {/* Crisis reference chips */}
      <CrisisSelector />

      {/* Full-width timeline */}
      <div className="history-timeline-wrap panel-card">
        <div className="panel-header">
          <span className="panel-title">Minsky Regime Timeline — Fragility Signal</span>
          <span className="history-anno-count">
            {crisisAnnotations.length} annotated events
          </span>
        </div>
        <div className="panel-body" style={{ padding: '0.5rem' }}>
          <RegimeTimeline />
        </div>
      </div>

      {/* DTW Similarity Heatmap */}
      <ResponsiveContainer priority="medium" mobileLayout="stack">
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title">Historical Similarity Analysis</span>
          </div>
          <div className="panel-body">
            <DTWSimilarityHeatmap />
          </div>
        </div>
      </ResponsiveContainer>

      {/* Event legend */}
      <div className="history-events panel-card">
        <div className="panel-header">
          <span className="panel-title">Annotated Crisis Events</span>
        </div>
        <div className="panel-body">
          <div className="history-events-grid">
            {crisisAnnotations.map((ev) => (
              <div key={ev.date} className={`history-event history-event--${ev.severity}`}>
                <span className="history-event-date">{ev.date}</span>
                <span className="history-event-label">{ev.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryArchive;
