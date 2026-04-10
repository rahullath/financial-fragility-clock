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

const ClockLanding: React.FC = () => (
  <div className="clock-landing">

    {/* Hero row: clock left, timeline right */}
    <div className="clock-landing-hero">
      <div>
        <DoomsdayClock />
      </div>
      <div>
        <RegimeTimeline />
      </div>
    </div>

    {/* Full-width stat strip */}
    <StatStrip />

    {/* Date scrubber */}
    <DateScrubber />

    {/* Crisis reference chips */}
    <CrisisSelector />

  </div>
);

export default ClockLanding;
