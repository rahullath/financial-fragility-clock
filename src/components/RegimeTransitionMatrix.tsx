import React, { useMemo, useState } from 'react';
import { scaleSequential } from 'd3-scale';
import { interpolateYlOrRd } from 'd3-scale-chromatic';
import { useModelContext } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { exportChart } from '../utils/exportChart';
import { generateRegimeTransitionExplanation } from '../utils/laymanExplanations';
import LaymanOverlay from './LaymanOverlay';
import './RegimeTransitionMatrix.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const REGIME_LABELS: Record<string, string> = {
  normal: 'Normal',
  stressed: 'Stressed',
  crisis: 'Crisis',
};

const REGIME_COLORS: Record<string, string> = {
  normal: 'var(--hedge)',
  stressed: 'var(--speculative)',
  crisis: 'var(--ponzi)',
};

// Color scale for probability intensity (0-1)
const probabilityColorScale = scaleSequential(interpolateYlOrRd).domain([0, 1]);

/**
 * Format date to ISO string for comparison
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * RegimeTransitionMatrix
 *
 * Displays a 3x3 heatmap showing regime transition probabilities from the
 * current regime to all possible regimes (normal, stressed, crisis).
 * Updates reactively when the selected date changes.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
const RegimeTransitionMatrix: React.FC = () => {
  const { getRegimeTransitions, regimeTransitions } = useModelContext();
  const { selectedDate } = useDateContext();

  const [hovered, setHovered] = useState<{
    from: string;
    to: string;
    probability: number;
  } | null>(null);

  // Get transition data for the selected date
  const transitionData = useMemo(() => {
    const dateStr = formatDateISO(selectedDate);
    return getRegimeTransitions(dateStr);
  }, [selectedDate, getRegimeTransitions]);

  // Extract regimes and matrix
  const regimes = regimeTransitions?.metadata.regimes || ['normal', 'stressed', 'crisis'];
  const matrix = transitionData?.matrix || [];
  const currentRegime = transitionData?.current_regime || 'normal';

  const cellSize = 80;
  const labelW = 70;
  const svgW = labelW + regimes.length * cellSize;
  const svgH = labelW + regimes.length * cellSize;

  return (
    <div 
      className="regime-transition-matrix"
      data-testid="regime-transition-matrix"
      id="chart-regime-transition-matrix"
      aria-label="Regime transition probability matrix"
    >
      <div className="rtm-header">
        <div className="rtm-title">Regime Transition Probabilities</div>
        <div className="rtm-controls">
          <LaymanOverlay 
            explanationGenerator={() => 
              generateRegimeTransitionExplanation(transitionData, currentRegime)
            }
          />
          <button 
            onClick={() => exportChart('chart-regime-transition-matrix', 'regime_transitions')}
            className="rtm-export-btn"
          >
            Export PNG
          </button>
        </div>
      </div>

      <div className="rtm-current-regime">
        Current Regime: <span style={{ color: REGIME_COLORS[currentRegime] }}>
          {REGIME_LABELS[currentRegime] || currentRegime}
        </span>
      </div>

      <div className="rtm-container">
        <svg width={svgW} height={svgH}>
          {/* Column labels (top) - "To" regimes */}
          <text
            x={labelW + (regimes.length * cellSize) / 2}
            y={20}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
            fontWeight="600"
          >
            TO →
          </text>
          {regimes.map((regime, j) => (
            <text
              key={`col-${j}`}
              x={labelW + j * cellSize + cellSize / 2}
              y={labelW - 10}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-secondary)"
              fontFamily="var(--font-mono)"
            >
              {REGIME_LABELS[regime]}
            </text>
          ))}

          {/* Row labels (left) - "From" regimes */}
          <text
            x={20}
            y={labelW + (regimes.length * cellSize) / 2}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
            fontWeight="600"
            transform={`rotate(-90, 20, ${labelW + (regimes.length * cellSize) / 2})`}
          >
            ← FROM
          </text>
          {regimes.map((regime, i) => (
            <text
              key={`row-${i}`}
              x={labelW - 10}
              y={labelW + i * cellSize + cellSize / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="var(--text-secondary)"
              fontFamily="var(--font-mono)"
            >
              {REGIME_LABELS[regime]}
            </text>
          ))}

          {/* Matrix cells */}
          {regimes.map((fromRegime, i) =>
            regimes.map((toRegime, j) => {
              const probability = matrix[i]?.[j] ?? 0;
              const fill = probabilityColorScale(probability);
              const isCurrentRegimeRow = fromRegime === currentRegime;
              const isHovered = 
                hovered?.from === fromRegime && hovered?.to === toRegime;

              return (
                <g
                  key={`${i}-${j}`}
                  onMouseEnter={() => 
                    setHovered({ from: fromRegime, to: toRegime, probability })
                  }
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'default' }}
                >
                  <rect
                    x={labelW + j * cellSize}
                    y={labelW + i * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={fill}
                    stroke={
                      isHovered 
                        ? 'var(--text-primary)' 
                        : isCurrentRegimeRow 
                        ? REGIME_COLORS[currentRegime]
                        : 'var(--bg-border)'
                    }
                    strokeWidth={isHovered ? 2 : isCurrentRegimeRow ? 2 : 1}
                    style={{ transition: 'all 300ms ease' }}
                    opacity={isCurrentRegimeRow ? 1 : 0.7}
                  />
                  <text
                    x={labelW + j * cellSize + cellSize / 2}
                    y={labelW + i * cellSize + cellSize / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={14}
                    fill={probability > 0.5 ? '#fff' : 'var(--text-primary)'}
                    fontFamily="var(--font-mono)"
                    fontWeight="600"
                    pointerEvents="none"
                  >
                    {(probability * 100).toFixed(0)}%
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="rtm-tooltip">
          <div className="rtm-tooltip-transition">
            {REGIME_LABELS[hovered.from]} → {REGIME_LABELS[hovered.to]}
          </div>
          <div className="rtm-tooltip-probability">
            {(hovered.probability * 100).toFixed(2)}%
          </div>
          <div className="rtm-tooltip-description">
            Probability of transitioning from {REGIME_LABELS[hovered.from].toLowerCase()} 
            {' '}to {REGIME_LABELS[hovered.to].toLowerCase()} regime
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="rtm-legend">
        <span>Low (0%)</span>
        <div className="rtm-legend-bar" />
        <span>High (100%)</span>
      </div>
    </div>
  );
};

export default RegimeTransitionMatrix;
