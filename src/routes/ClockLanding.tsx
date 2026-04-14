/**
 * ClockLanding — the visceral / route
 * DoomsdayClock hero + StatStrip + CrisisSelector
 * Nothing else. This is the emotional first impression.
 */

import React from 'react';
import DoomsdayClock from '../components/DoomsdayClock';
import StatStrip from '../components/StatStrip';
import CrisisSelector from '../components/CrisisSelector';
import RegimeTimeline from '../components/RegimeTimeline';
import DateScrubber from '../components/DateScrubber';
import ModelToggle from '../components/ModelToggle';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { usePageTitle } from '../hooks/usePageTitle';

const ClockLanding: React.FC = () => {
  usePageTitle('Clock');
  
  return (
    <div className="clock-landing">
      {/* Model selection toggle */}
      <ResponsiveContainer priority="high" mobileLayout="stack">
        <ModelToggle />
      </ResponsiveContainer>

      {/* Hero row: clock left, timeline right */}
      <ResponsiveContainer priority="high" mobileLayout="stack">
        <div className="clock-landing-hero">
          <div>
            <DoomsdayClock />
          </div>
          <div>
            <RegimeTimeline />
          </div>
        </div>
      </ResponsiveContainer>

      {/* Full-width stat strip */}
      <ResponsiveContainer priority="high" mobileLayout="scroll">
        <StatStrip />
      </ResponsiveContainer>

      {/* Date scrubber */}
      <ResponsiveContainer priority="high" mobileLayout="stack">
        <DateScrubber />
      </ResponsiveContainer>

      {/* Crisis reference chips */}
      <ResponsiveContainer priority="medium" mobileLayout="scroll">
        <CrisisSelector />
      </ResponsiveContainer>

    </div>
  );
};

export default ClockLanding;
