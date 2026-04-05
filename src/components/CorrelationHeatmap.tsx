import React, { useMemo, useState } from 'react';
import { scaleSequential } from 'd3-scale';
import { interpolateRdBu } from 'd3-scale-chromatic';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { exportChart } from '../utils/exportChart';
import './CorrelationHeatmap.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find the row closest to (but not after) the target date. */
function findRowForDate(rows: DataRow[], date: Date): DataRow | null {
  const target = date.getTime();
  let best: DataRow | null = null;
  for (const r of rows) {
    const t = new Date(r.date as string).getTime();
    if (t <= target) best = r;
  }
  return best;
}

/** Find row 30 days (calendar) before target, for delta calculation. */
function findRowBefore(rows: DataRow[], date: Date, days: number): DataRow | null {
  const target = new Date(date.getTime() - days * 86400000);
  return findRowForDate(rows, target);
}

/**
 * Extract NxN correlation matrix from a DataRow's pairwise_correlations dict.
 * Returns { indices, matrix } where matrix[i][j] is corr between i and j.
 */
function buildMatrix(
  row: DataRow,
  indices: string[]
): { matrix: (number | null)[][]; pairs: Record<string, number | null> } {
  const pc = row.pairwise_correlations as Record<string, number | null> | null;
  const pairs: Record<string, number | null> = pc ?? {};

  const n = indices.length;
  const matrix: (number | null)[][] = Array.from({ length: n }, () =>
    Array(n).fill(null)
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      const key1 = `${indices[i]}_${indices[j]}`;
      const key2 = `${indices[j]}_${indices[i]}`;
      const val = pairs[key1] ?? pairs[key2] ?? null;
      matrix[i][j] = val;
    }
  }
  return { matrix, pairs };
}

// D3 RdBu diverging scale, reversed so red = high correlation
const colorScale = scaleSequential(
  (t) => interpolateRdBu(1 - t) // red => high corr, blue => low/negative
).domain([-1, 1]);

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * CorrelationHeatmap
 *
 * Custom SVG grid showing 60-day rolling pairwise correlations at the
 * currently selected date. Hover shows exact value and 30-day delta.
 * Updates with a CSS transition when the date changes.
 *
 * Requirements: 15.1–15.6, 36.2
 */
const CorrelationHeatmap: React.FC = () => {
  const { currentModelData } = useModelContext();
  const { selectedDate } = useDateContext();

  const [hovered, setHovered] = useState<{
    i: number;
    j: number;
    val: number | null;
    delta: number | null;
  } | null>(null);

  const indices = currentModelData.info.indices;
  const rows = currentModelData.featuresData.data;

  const { matrix, prevMatrix } = useMemo(() => {
    const row = findRowForDate(rows, selectedDate);
    const prevRow = findRowBefore(rows, selectedDate, 30);
    const { matrix } = row
      ? buildMatrix(row, indices)
      : { matrix: Array.from({ length: indices.length }, (_, i) =>
            Array.from({ length: indices.length }, (__, j) => (i === j ? 1 : null))
          ) };
    const { matrix: prevMatrix } = prevRow
      ? buildMatrix(prevRow, indices)
      : { matrix: matrix };
    return { matrix, prevMatrix };
  }, [rows, selectedDate, indices]);

  const n = indices.length;
  // Max 13 indices — cap cell size so it fits in card
  const cellSize = Math.min(42, Math.floor(340 / n));
  const labelW = 52;
  const svgW = labelW + n * cellSize;
  const svgH = labelW + n * cellSize;

  return (
    <div className="corr-heatmap" id="chart-correlation-heatmap" aria-label="Correlation heatmap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="heatmap-title">60-day Rolling Correlations</div>
        <button 
          onClick={() => exportChart('chart-correlation-heatmap', 'correlation_heatmap')}
          style={{ fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer' }}
        >
          Export PNG
        </button>
      </div>

      <div className="heatmap-scroll">
        <svg width={svgW} height={svgH} style={{ display: 'block' }}>
          {/* Column labels (top) */}
          {indices.map((idx, j) => (
            <text
              key={`col-${j}`}
              x={labelW + j * cellSize + cellSize / 2}
              y={labelW - 4}
              textAnchor="end"
              fontSize={Math.min(10, cellSize * 0.28)}
              fill="var(--text-muted)"
              fontFamily="var(--font-mono)"
              transform={`rotate(-45, ${labelW + j * cellSize + cellSize / 2}, ${labelW - 4})`}
            >
              {idx}
            </text>
          ))}

          {/* Row labels (left) */}
          {indices.map((idx, i) => (
            <text
              key={`row-${i}`}
              x={labelW - 4}
              y={labelW + i * cellSize + cellSize / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={Math.min(10, cellSize * 0.28)}
              fill="var(--text-muted)"
              fontFamily="var(--font-mono)"
            >
              {idx}
            </text>
          ))}

          {/* Cells */}
          {matrix.map((row, i) =>
            row.map((val, j) => {
              const fill = val != null ? colorScale(val) : '#e5e0d8';
              const delta =
                val != null && prevMatrix[i][j] != null
                  ? val - (prevMatrix[i][j] as number)
                  : null;
              const isHovered = hovered?.i === i && hovered?.j === j;

              return (
                <g
                  key={`${i}-${j}`}
                  onMouseEnter={() => setHovered({ i, j, val, delta })}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'default' }}
                >
                  <rect
                    x={labelW + j * cellSize}
                    y={labelW + i * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={fill}
                    stroke={isHovered ? 'var(--text-primary)' : 'var(--bg-card)'}
                    strokeWidth={isHovered ? 1.5 : 0.5}
                    style={{ transition: 'fill 300ms ease' }}
                  />
                  {cellSize >= 38 && val != null && (
                    <text
                      x={labelW + j * cellSize + cellSize / 2}
                      y={labelW + i * cellSize + cellSize / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={9}
                      fill={Math.abs(val) > 0.5 ? '#fff' : '#333'}
                      fontFamily="var(--font-mono)"
                      pointerEvents="none"
                    >
                      {val.toFixed(2)}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="heatmap-hover">
          <span className="hh-pair">
            {indices[hovered.i]} × {indices[hovered.j]}
          </span>
          <span className="hh-val">
            {hovered.val != null ? hovered.val.toFixed(4) : '—'}
          </span>
          {hovered.delta != null && (
            <span
              className="hh-delta"
              style={{ color: hovered.delta >= 0 ? 'var(--ponzi)' : 'var(--hedge)' }}
            >
              {hovered.delta >= 0 ? '+' : ''}
              {hovered.delta.toFixed(4)} 30d
            </span>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="heatmap-legend">
        <span style={{ color: '#2166ac' }}>−1</span>
        <div className="legend-bar" />
        <span style={{ color: '#d6604d' }}>+1</span>
      </div>
    </div>
  );
};

export default CorrelationHeatmap;
