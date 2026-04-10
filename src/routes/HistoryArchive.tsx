/**
 * HistoryArchive — /history
 * Full-page annotated regime timeline — the crisis seismograph.
 * RegimeTimeline takes full width with crisis markers overlaid.
 */

import React from 'react';
import RegimeTimeline from '../components/RegimeTimeline';
import DateScrubber from '../components/DateScrubber';
import CrisisSelector from '../components/CrisisSelector';
import './HistoryArchive.css';

const CRISIS_ANNOTATIONS = [
  { date: '2010-05-06', label: 'Flash Crash', severity: 'crisis' },
  { date: '2010-04-23', label: 'Greece bailout request', severity: 'correction' },
  { date: '2011-08-05', label: 'US credit downgrade', severity: 'crisis' },
  { date: '2008-09-15', label: 'Lehman Brothers', severity: 'crisis' },
  { date: '2020-03-16', label: 'COVID lockdowns', severity: 'crisis' },
];

const PageHeader: React.FC = () => (
  <div className="page-header">
    <div className="page-header-title">
      <h1>Crisis Archive</h1>
      <p>Annotated regime timeline · Fragility signal through history · Scrub to replay</p>
    </div>
  </div>
);

const HistoryArchive: React.FC = () => (
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
          {CRISIS_ANNOTATIONS.length} annotated events
        </span>
      </div>
      <div className="panel-body" style={{ padding: '0.5rem' }}>
        <RegimeTimeline />
      </div>
    </div>

    {/* Event legend */}
    <div className="history-events panel-card">
      <div className="panel-header">
        <span className="panel-title">Annotated Crisis Events</span>
      </div>
      <div className="panel-body">
        <div className="history-events-grid">
          {CRISIS_ANNOTATIONS.map((ev) => (
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

export default HistoryArchive;
