import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DateProvider, useDateContext } from '../contexts/DateContext';
import { CrisisProvider } from '../contexts/CrisisContext';
import DoomsdayClock from '../components/DoomsdayClock';
import RegimeTimeline from '../components/RegimeTimeline';
import SHAPChart from '../components/SHAPChart';
import NetworkMST from '../components/NetworkMST';
import ModelPerformanceTable from '../components/ModelPerformanceTable';
import './PresentationMode.css';

const TOTAL_SLIDES = 5;

// ── Date controller ─────────────────────────────────────────────────────────
const DateController: React.FC<{ slide: number }> = ({ slide }) => {
  const { setSelectedDate } = useDateContext();

  useEffect(() => {
    const dates: Record<number, string> = {
      0: '2010-05-06', // Flash Crash — Ponzi
      1: '2010-05-06',
      2: '2010-05-06',
      3: '2010-05-06',
      4: '2010-05-06',
    };
    const target = dates[slide];
    if (target) setSelectedDate(new Date(target));
  }, [slide, setSelectedDate]);

  return null;
};

// ── Slide definitions ───────────────────────────────────────────────────────

const Slide0: React.FC = () => (
  <div className="panel-layout-center">
    <div className="panel-graphic" style={{ maxWidth: 340, margin: '0 auto' }}>
      <DoomsdayClock />
    </div>
    <div className="panel-text">
      <span className="panel-kicker">May 6, 2010 · Flash Crash</span>
      <h2>This is what a Minsky moment looks like in data</h2>
      <p>
        The US Flash Crash combined with the European Sovereign Debt Crisis rippling through
        global markets. The composite fragility index enters PONZI territory — maximum
        contagion, minimum diversification.
      </p>
    </div>
  </div>
);

const Slide1: React.FC = () => (
  <div className="panel-layout-split">
    <div className="panel-graphic">
      <RegimeTimeline />
    </div>
    <div className="panel-text">
      <span className="panel-kicker">The Data · Jan 2009 – Feb 2011</span>
      <h2>Structuring Market Chaos</h2>
      <p>
        Rolling permutation entropy, network correlation centrality, and dynamic volatility
        combine into a single composite score. Three discrete Minsky regimes emerge from the
        continuous signal — each with distinct risk characteristics.
      </p>
    </div>
  </div>
);

const Slide2: React.FC = () => (
  <div className="panel-layout-split flip">
    <div className="panel-graphic">
      <SHAPChart />
    </div>
    <div className="panel-text">
      <span className="panel-kicker">Feature Importance · SHAP Analysis</span>
      <h2>What Drives Contagion?</h2>
      <p>
        SHapley Additive exPlanations decompose the Random Forest's predictions at the
        feature level — per regime. During PONZI outbreaks, the dominant contagion source
        shifts. This is the distinction between a correlation model and a causal one.
      </p>
    </div>
  </div>
);

const Slide3: React.FC = () => (
  <div className="panel-layout-split">
    <div className="panel-graphic">
      <NetworkMST />
    </div>
    <div className="panel-text">
      <span className="panel-kicker">Correlation Network · Mantegna Distance</span>
      <h2>The Network Effect</h2>
      <p>
        The Minimum Spanning Tree of market correlations condenses as fragility rises.
        During PONZI states, node distances collapse — markets move as one. Diversification
        fails precisely when investors need it most.
      </p>
    </div>
  </div>
);

const Slide4: React.FC = () => (
  <div className="panel-layout-split flip">
    <div className="panel-graphic">
      <ModelPerformanceTable />
    </div>
    <div className="panel-text">
      <span className="panel-kicker">OLS vs Random Forest · Regime-Stratified</span>
      <h2>Why Non-Linear Models Win in Crises</h2>
      <p>
        OLS performs acceptably in HEDGE regimes. Random Forest's advantage is concentrated
        in PONZI periods — where crash mechanics are fundamentally non-linear and
        boundary-driven. The Minsky framework is not just theoretical: it validates
        quantitatively.
      </p>
    </div>
  </div>
);

const SLIDES = [Slide0, Slide1, Slide2, Slide3, Slide4];

// ── Inner component ─────────────────────────────────────────────────────────

const PresentationInner: React.FC = () => {
  const [slide, setSlide] = useState(0);

  const goNext = useCallback(() => setSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1)), []);
  const goPrev = useCallback(() => setSlide((s) => Math.max(s - 1, 0)), []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') { window.location.href = '/'; }
      else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      }
    },
    [goNext, goPrev]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);


  return (
    <div className="presentation-route">
      <DateController slide={slide} />

      {/* Exit */}
      <div className="presentation-exit">
        <Link to="/" className="btn-exit">← Exit</Link>
      </div>

      {/* Slide track */}
      <div
        className="presentation-track"
        style={{ transform: `translateX(-${slide * 100}vw)` }}
      >
        {SLIDES.map((SlideComp, i) => (
          <section key={i} className="present-panel">
            <SlideComp />
          </section>
        ))}
      </div>

      {/* Progress dots */}
      <div className="presentation-dots">
        {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
          <button
            key={i}
            className={`presentation-dot ${i === slide ? 'active' : ''}`}
            onClick={() => setSlide(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{ border: 'none', cursor: 'pointer', padding: 0 }}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="presentation-footer">
        <span>{slide + 1} / {TOTAL_SLIDES}</span>
        <span>← → navigate · F fullscreen · Esc exit</span>
      </div>

      {/* Nav buttons */}
      <div className="presentation-nav">
        <button className="btn-nav" onClick={goPrev} disabled={slide === 0} aria-label="Previous slide">‹</button>
        <button className="btn-nav" onClick={goNext} disabled={slide === TOTAL_SLIDES - 1} aria-label="Next slide">›</button>
      </div>
    </div>
  );
};

// ── Wrapper with isolated providers ────────────────────────────────────────

const PresentationMode: React.FC = () => (
  <CrisisProvider>
    <DateProvider>
      <PresentationInner />
    </DateProvider>
  </CrisisProvider>
);

export default PresentationMode;
