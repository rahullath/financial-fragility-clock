import React, { useMemo } from 'react';
import { useModelContext } from '../contexts/ModelContext';
import { toNum } from '../utils/dataUtils';
import './CurrentFragilityReading.css';

const REGIME_COLORS: Record<string, string> = {
  HEDGE: '#2d6a4f',
  SPECULATIVE: '#e9a800',
  PONZI: '#c1121f',
};

/**
 * CurrentFragilityReading
 *
 * Designed to display the absolute latest observation from the dataset,
 * along with its regime, trend, and baseline comparisons.
 *
 * Requirements: 36.5
 */
const CurrentFragilityReading: React.FC = () => {
  const { currentModelData } = useModelContext();

  const reading = useMemo(() => {
    const data = currentModelData.featuresData.data;

    // Find the latest valid score
    let latestRow = null;
    let latestIndex = -1;
    for (let i = data.length - 1; i >= 0; i--) {
      if (toNum(data[i].fragility_score) != null) {
        latestRow = data[i];
        latestIndex = i;
        break;
      }
    }

    if (!latestRow) return null;

    const score = toNum(latestRow.fragility_score) ?? 0;
    const regime = ((latestRow.regime as string) ?? 'SPECULATIVE');
    const dateStr = new Date(latestRow.date as string).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // 30-day trend
    const prevRow = data[Math.max(0, latestIndex - 30)];
    const prevScore = toNum(prevRow?.fragility_score) ?? score;
    const diff = score - prevScore;
    const trendStr = diff > 2 ? 'Increasing' : diff < -2 ? 'Decreasing' : 'Stable';
    const trendIcon = diff > 2 ? '↑' : diff < -2 ? '↓' : '→';

    // Interpretation text
    let interpretation = '';
    let cssClass = 'hedge';
    if (regime === 'HEDGE') {
      interpretation = 'Normal trading conditions. Financial structures are primarily robust and systemic risk remains contained without threatening contagion.';
    } else if (regime === 'SPECULATIVE') {
      cssClass = 'speculative';
      interpretation = 'Risk is building. Increasing correlation and volatility suggest a transition toward a fragile financial state requiring vigilance.';
    } else {
      cssClass = 'ponzi';
      interpretation = 'High systemic risk. The market exhibits hallmarks of a Ponzi regime with dense contagion potential and acute vulnerability to shocks.';
    }

    return { score, regime, dateStr, diff, trendStr, trendIcon, interpretation, cssClass };
  }, [currentModelData]);

  if (!reading) return null;

  return (
    <div className="cfr-card" aria-label="Current Fragility Reading">
      <div className="cfr-header">
        <h2>Latest Reading</h2>
      </div>

      <div className="cfr-primary-reading">
        <div className="cfr-score-block">
          <span className="cfr-score-label">{reading.dateStr}</span>
          <span className="cfr-score-value">{reading.score.toFixed(1)}</span>
        </div>
        <div className="cfr-badges">
          <div
            className="cfr-badge"
            style={{ backgroundColor: REGIME_COLORS[reading.regime] || REGIME_COLORS.SPECULATIVE }}
          >
            {reading.regime}
          </div>
          <div className="cfr-trend">
            {reading.trendIcon} 30d Trend: {reading.trendStr}
          </div>
        </div>
      </div>

      <div className={`cfr-interpretation ${reading.cssClass}`}>
        <p>{reading.interpretation}</p>
      </div>

      <div className="cfr-historical-comparisons">
        <div className="cfr-hist-item">
          <div className="hist-label">Lehman Peak (Sep 2008)</div>
          <div className="hist-value">78.4</div>
        </div>
        <div className="cfr-hist-item">
          <div className="hist-label">COVID Peak (Mar 2020)</div>
          <div className="hist-value">72.1</div>
        </div>
      </div>
    </div>
  );
};

export default CurrentFragilityReading;
