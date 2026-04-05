import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DateProvider, useDateContext } from '../contexts/DateContext';
import ClockVisual from '../components/ClockVisual';
import RegimeTimeline from '../components/RegimeTimeline';
import SHAPChart from '../components/SHAPChart';
import NetworkMST from '../components/NetworkMST';
import ModelPerformanceTable from '../components/ModelPerformanceTable';
import './PresentationMode.css';

/** 
 * DateController 
 * A hidden component that forces the global DateContext to specific snapshot 
 * dates depending on which slide is active. 
 */
const DateController: React.FC<{ slide: number }> = ({ slide }) => {
  const { setSelectedDate } = useDateContext();

  useEffect(() => {
    // 0 = Clock Front, 1 = Timeline, 2 = SHAP, 3 = Double MST, 4 = Model Table
    if (slide === 0) {
      setSelectedDate(new Date('2010-05-06')); // Flash Crash / Ponzi
    } else if (slide === 1 || slide === 2) {
      setSelectedDate(new Date('2010-05-06')); 
    }
  }, [slide, setSelectedDate]);

  return null;
};

const PresentationInner: React.FC = () => {
  const [slide, setSlide] = useState(0);
  const TOTAL_SLIDES = 5;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      setSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));
    } else if (e.key === 'ArrowLeft') {
      setSlide((s) => Math.max(s - 1, 0));
    } else if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const slideOffset = `-${slide * 100}vw`;

  return (
    <div className="presentation-route">
      <DateController slide={slide} />
      
      <div className="presentation-exit">
        <Link to="/" className="btn-exit">Exit (Esc)</Link>
      </div>

      <div 
        className="presentation-track" 
        style={{ transform: `translateX(${slideOffset})` }}
      >
        {/* Panel 1: Clock Visual */}
        <section className="present-panel">
          <div className="panel-content-centered">
            <div className="panel-graphic large-clock">
              <ClockVisual />
            </div>
            <div className="panel-caption">
              <h2>This is what a Minsky moment looks like in data</h2>
              <p>May 6, 2010: The US Flash Crash combined with the European Sovereign Debt Crisis rippling through global markets. The composite index flags systemic PONZI phase vulnerability.</p>
            </div>
          </div>
        </section>

        {/* Panel 2: Regime Timeline */}
        <section className="present-panel">
          <div className="panel-content-split">
            <div className="panel-graphic timeline-hero">
              <RegimeTimeline />
            </div>
            <div className="panel-caption">
              <h2>Structuring Market Chaos</h2>
              <p>By blending rolling permutation entropy, network correlation centrality, and dynamic volatility into a composite 1-100 score, we mathematically slice time-series history into discrete HEDGE, SPECULATIVE, and PONZI risk domains.</p>
            </div>
          </div>
        </section>

        {/* Panel 3: SHAP Chart */}
        <section className="present-panel">
          <div className="panel-content-split">
             <div className="panel-caption">
              <h2>What Drives Contagion?</h2>
              <p>Our SHAP (SHapley Additive exPlanations) analysis unpacks the non-linear Random Forest algorithm. Here we isolate feature importance specifically when predicting PONZI outbreaks, showing exact drivers of systemic collapses.</p>
            </div>
            <div className="panel-graphic">
              <SHAPChart />
            </div>
          </div>
        </section>

        {/* Panel 4: Network MST */}
        <section className="present-panel">
           <div className="panel-content-centered">
            <div className="panel-caption">
              <h2>The Network Effect: Jan 2009 vs May 2010</h2>
              <p>Observe how the underlying minimum spanning tree (MST) structure condenses. As fragility increases, markets become highly correlated and dense. Distances between nodes mathematically shrink.</p>
            </div>
            <div className="panel-graphic mst-hero">
               <NetworkMST />
            </div>
          </div>
        </section>

        {/* Panel 5: Model Table */}
        <section className="present-panel">
           <div className="panel-content-split">
            <div className="panel-graphic">
              <ModelPerformanceTable />
            </div>
            <div className="panel-caption">
              <h2>Why non-linear models win during Crises</h2>
              <p>Traditional Ordinary Least Squares (OLS) regressions perform acceptably during HEDGE markets. However, Random Forests drastically outperform during PONZI events, proving that crash mechanics are fundamentally non-linear and boundary-driven.</p>
            </div>
          </div>
        </section>

      </div>

      <div className="presentation-footer">
         <span>Slide {slide + 1} of {TOTAL_SLIDES}</span>
         <span className="controls-hint">Use [←] and [→] to navigate. Press [F] for Fullscreen.</span>
      </div>
    </div>
  );
};

/**
 * We wrap PresentationMode in its own DateProvider so it does not permanently 
 * alter the user's Dashboard date selection when they exit back out.
 */
const PresentationMode: React.FC = () => {
  return (
    <DateProvider>
      <PresentationInner />
    </DateProvider>
  );
};

export default PresentationMode;
