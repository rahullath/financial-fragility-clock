import React, { useMemo, useState } from 'react';
import { scaleSequential } from 'd3-scale';
import { interpolateBlues } from 'd3-scale-chromatic';
import { useModelContext } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { exportChart } from '../utils/exportChart';
import { generateDTWSimilarityExplanation } from '../utils/laymanExplanations';
import LaymanOverlay from './LaymanOverlay';
import './DTWSimilarityHeatmap.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format date to ISO string for comparison
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date for display (MMM DD, YYYY)
 */
function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

// Color scale for similarity scores (0-1)
const similarityColorScale = scaleSequential(interpolateBlues).domain([0, 1]);

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * DTWSimilarityHeatmap
 *
 * Displays a timeline heatmap showing historical periods most similar to the
 * selected date using Dynamic Time Warping (DTW) analysis. Highlights the top 5
 * most similar periods and allows navigation to those dates.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
const DTWSimilarityHeatmap: React.FC = () => {
  const { getSimilarPeriods, dtwSimilarity } = useModelContext();
  const { selectedDate, setSelectedDate } = useDateContext();

  const [hoveredPeriod, setHoveredPeriod] = useState<{
    date: string;
    score: number;
    features: string[];
  } | null>(null);

  // Get similarity data for the selected date
  const similarityData = useMemo(() => {
    const dateStr = formatDateISO(selectedDate);
    const allPeriods = getSimilarPeriods(dateStr, 100); // Get more for visualization
    const top5 = getSimilarPeriods(dateStr, 5);
    
    return {
      allPeriods,
      top5Dates: new Set(top5.map(p => p.date)),
      top5,
    };
  }, [selectedDate, getSimilarPeriods]);

  // Handle period click - navigate to that date
  const handlePeriodClick = (dateStr: string) => {
    setSelectedDate(new Date(dateStr));
  };

  // Calculate layout dimensions
  const cellWidth = 12;
  const cellHeight = 40;
  const labelHeight = 60;
  const topMargin = 40;
  const periodsPerRow = Math.min(60, similarityData.allPeriods.length);
  const numRows = Math.ceil(similarityData.allPeriods.length / periodsPerRow);
  
  const svgWidth = periodsPerRow * cellWidth + 40;
  const svgHeight = numRows * cellHeight + labelHeight + topMargin;
  const hasSimilarityData = !!dtwSimilarity && similarityData.allPeriods.length > 0;

  return (
    <div 
      className="dtw-similarity-heatmap" 
      id="chart-dtw-similarity"
      role="region"
      aria-label="Historical similarity heatmap"
    >
      <div className="dtw-header">
        <div className="dtw-title">Historical Similarity Analysis (DTW)</div>
        <div className="dtw-controls">
          <LaymanOverlay 
            explanationGenerator={() => 
              generateDTWSimilarityExplanation(
                formatDateISO(selectedDate),
                similarityData.top5
              )
            }
          />
          <button 
            onClick={() => exportChart('chart-dtw-similarity', 'dtw_similarity')}
            className="dtw-export-btn"
          >
            Export PNG
          </button>
        </div>
      </div>

      <div className="dtw-reference-date">
        Reference Date: <span>{formatDateDisplay(formatDateISO(selectedDate))}</span>
      </div>

      <div className="dtw-container">
        {hasSimilarityData ? (
          <svg width={svgWidth} height={svgHeight}>
            {/* Title */}
            <text
              x={svgWidth / 2}
              y={20}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-muted)"
              fontFamily="var(--font-mono)"
              fontWeight="600"
            >
              Similar Historical Periods (Click to Navigate)
            </text>

            {/* Heatmap cells */}
            {similarityData.allPeriods.map((period, index) => {
              const row = Math.floor(index / periodsPerRow);
              const col = index % periodsPerRow;
              const x = col * cellWidth + 20;
              const y = row * cellHeight + topMargin + labelHeight;
              
              const isTop5 = similarityData.top5Dates.has(period.date);
              const isHovered = hoveredPeriod?.date === period.date;
              const fill = similarityColorScale(period.score);

              return (
                <g
                  key={period.date}
                  onMouseEnter={() => 
                    setHoveredPeriod({
                      date: period.date,
                      score: period.score,
                      features: period.features_matched,
                    })
                  }
                  onMouseLeave={() => setHoveredPeriod(null)}
                  onClick={() => handlePeriodClick(period.date)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={x}
                    y={y}
                    width={cellWidth}
                    height={cellHeight}
                    fill={fill}
                    stroke={
                      isHovered 
                        ? 'var(--text-primary)' 
                        : isTop5 
                        ? 'var(--accent-primary)'
                        : 'var(--bg-border)'
                    }
                    strokeWidth={isHovered ? 2 : isTop5 ? 2 : 0.5}
                    opacity={isTop5 ? 1 : 0.8}
                    style={{ transition: 'all 200ms ease' }}
                  />
                  
                  {/* Label for top 5 */}
                  {isTop5 && (
                    <>
                      <text
                        x={x + cellWidth / 2}
                        y={y - 5}
                        textAnchor="middle"
                        fontSize={8}
                        fill="var(--accent-primary)"
                        fontFamily="var(--font-mono)"
                        fontWeight="700"
                        pointerEvents="none"
                      >
                        ★
                      </text>
                      <text
                        x={x + cellWidth / 2}
                        y={y + cellHeight + 12}
                        textAnchor="middle"
                        fontSize={7}
                        fill="var(--text-secondary)"
                        fontFamily="var(--font-mono)"
                        pointerEvents="none"
                      >
                        {formatDateDisplay(period.date).split(',')[0]}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="dtw-similarity-empty">
            <p>No similarity data available for the selected date.</p>
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      {hoveredPeriod && (
        <div className="dtw-tooltip">
          <div className="dtw-tooltip-date">
            {formatDateDisplay(hoveredPeriod.date)}
          </div>
          <div className="dtw-tooltip-score">
            Similarity: {(hoveredPeriod.score * 100).toFixed(1)}%
          </div>
          <div className="dtw-tooltip-features">
            Matched features: {hoveredPeriod.features.slice(0, 3).join(', ')}
            {hoveredPeriod.features.length > 3 && ` +${hoveredPeriod.features.length - 3} more`}
          </div>
          <div className="dtw-tooltip-action">
            Click to navigate to this period
          </div>
        </div>
      )}

      {/* Top 5 list */}
      <div className="dtw-top5-list">
        <div className="dtw-top5-title">Top 5 Most Similar Periods</div>
        {hasSimilarityData ? (
          similarityData.top5.map((period, index) => (
            <div 
              key={period.date}
              className="dtw-top5-item"
              onClick={() => handlePeriodClick(period.date)}
            >
              <span className="dtw-top5-rank">#{index + 1}</span>
              <span className="dtw-top5-date">{formatDateDisplay(period.date)}</span>
              <span className="dtw-top5-score">{(period.score * 100).toFixed(1)}%</span>
            </div>
          ))
        ) : (
          <div className="dtw-top5-item dtw-top5-item--empty">
            No comparable periods yet
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="dtw-legend">
        <span>Low Similarity (0%)</span>
        <div className="dtw-legend-bar" />
        <span>High Similarity (100%)</span>
      </div>

      {/* Metadata */}
      <div className="dtw-metadata">
        <div className="dtw-metadata-item">
          <span className="dtw-metadata-label">Window Size:</span>
          <span className="dtw-metadata-value">{dtwSimilarity?.metadata.window_size ?? 0} days</span>
        </div>
        <div className="dtw-metadata-item">
          <span className="dtw-metadata-label">Features Analyzed:</span>
          <span className="dtw-metadata-value">{dtwSimilarity?.metadata.feature_set.length ?? 0}</span>
        </div>
      </div>
    </div>
  );
};

export default DTWSimilarityHeatmap;
