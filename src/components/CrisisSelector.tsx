/**
 * CrisisSelector — spec v2 §7
 *
 * A horizontal row of toggleable crisis chips.
 * State lives in CrisisContext — this component is purely a UI writer.
 * All consumers (DoomsdayClock, StatStrip, RegimeTimeline) read from CrisisContext.
 *
 * Example:
 *   Reference crises:
 *   [● GFC 2008]  [● Flash Crash 2010]  [○ Dot-com 2000]  [○ COVID 2020]  [○ EU Debt]
 */

import React from 'react';
import { useCrisisContext } from '../contexts/CrisisContext';
import { useModelContext } from '../contexts/ModelContext';
import './CrisisSelector.css';

const CrisisSelector: React.FC = () => {
  const { crisisWindows, selectedCrises, toggleCrisis } = useCrisisContext();
  const { selectedModel } = useModelContext();

  return (
    <div className="crisis-selector panel-card">
      <div className="crisis-selector-inner">
        <span className="crisis-selector-label">Reference crises</span>
        <div className="crisis-chip-row">
          {crisisWindows.map((w) => {
            // Chips that require Model B are disabled when Model A is active
            const disabled = w.modelRequired === 'B' && selectedModel === 'A';
            const selected = selectedCrises.has(w.id) && !disabled;

            return (
              <button
                key={w.id}
                className={`crisis-chip ${selected ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && toggleCrisis(w.id)}
                disabled={disabled}
                aria-pressed={selected}
                title={
                  disabled
                    ? `${w.label} requires Model B data (2003–2025)`
                    : `${w.label}: ${w.start} – ${w.end}`
                }
              >
                <span className={`crisis-dot crisis-dot--${w.severity}`} />
                <span className="crisis-chip-label">{w.shortLabel}</span>
              </button>
            );
          })}
        </div>
        {selectedModel === 'A' && (
          <span className="crisis-model-note">
            Switch to Model B for GFC 2008, Dot-com, and COVID reference crises
          </span>
        )}
      </div>
    </div>
  );
};

export default CrisisSelector;
