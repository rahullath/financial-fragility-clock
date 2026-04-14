import React, { useMemo, useCallback, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { useCrisisContext } from '../contexts/CrisisContext';
import { toNum } from '../utils/dataUtils';
import { exportChart } from '../utils/exportChart';
import { generateTimelineExplanation } from '../utils/laymanExplanations';
import LaymanOverlay from './LaymanOverlay';
import './RegimeTimeline.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const REGIME_COLORS: Record<string, string> = {
  HEDGE: '#22c55e',
  SPECULATIVE: '#f59e0b',
  PONZI: '#ef4444',
};

const SEVERITY_COLORS: Record<string, string> = {
  crisis: '#ef4444',
  correction: '#f59e0b',
  note: '#4a9eff',
};

function formatAxisDate(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
}

function formatTooltipDate(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DataRow; value: number }>;
}

const TimelineTooltip: React.FC<TooltipProps> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const score = toNum(row.fragility_score);
  const regime = (row.regime as string) ?? '—';
  return (
    <div className="timeline-tooltip">
      <div className="tt-date">{formatTooltipDate(row.date as string)}</div>
      <div className="tt-score">
        Score: <strong>{score != null ? score.toFixed(1) : '—'}</strong>
      </div>
      <div
        className="tt-regime"
        style={{ color: REGIME_COLORS[regime] ?? '#888' }}
      >
        {regime}
      </div>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * RegimeTimeline
 *
 * Full time-series area chart of fragility scores coloured by Minsky regime.
 * Clicking the chart updates DateContext.selectedDate.
 * Event markers (vertical reference lines) are drawn for key events.
 *
 * Requirements: 14.1–14.6, 36.2
 */
const RegimeTimeline: React.FC = () => {
  const { currentModelData } = useModelContext();
  const { selectedDate, setSelectedDate } = useDateContext();
  const { activeCrisisWindows } = useCrisisContext();

  // ── Chart data: only rows with a valid fragility_score ─────────────────────
  const chartData = useMemo(
    () =>
      currentModelData.featuresData.data
        .filter((r) => toNum(r.fragility_score) != null)
        .map((r) => ({ ...r, fragility_score: toNum(r.fragility_score) })),
    [currentModelData]
  );

  // Helper to find row for selected date
  const findRowForDate = (rows: DataRow[], date: Date): DataRow | null => {
    const target = date.getTime();
    let best: DataRow | null = null;
    for (const r of rows) {
      const t = new Date(r.date as string).getTime();
      if (t <= target && toNum(r.fragility_score) != null) best = r;
    }
    return best ?? null;
  };

  // ── Gradient stops: regime-coloured fill segments ──────────────────────────
  // Build a linear gradient based on regime at each data point (sampled at 1%)
  const gradientStops = useMemo(() => {
    if (!chartData.length) return [];
    return chartData
      .filter((_, i) => i % Math.max(1, Math.floor(chartData.length / 100)) === 0)
      .map((row, i, arr) => ({
        offset: `${((i / Math.max(arr.length - 1, 1)) * 100).toFixed(1)}%`,
        color: REGIME_COLORS[(row.regime as string) ?? 'SPECULATIVE'] ?? '#e9a800',
      }));
  }, [chartData]);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (data: { activePayload?: Array<{ payload: DataRow }> } | null) => {
      if (!data?.activePayload?.[0]) return;
      const row = data.activePayload[0].payload;
      if (row.date) setSelectedDate(new Date(row.date as string));
    },
    [setSelectedDate]
  );

  const selectedIso = selectedDate.toISOString().slice(0, 10);

  // ── Tick reducer for X axis ────────────────────────────────────────────────
  const xTicks = useMemo(() => {
    if (!chartData.length) return [];
    const step = Math.max(1, Math.floor(chartData.length / 8));
    return chartData
      .filter((_, i) => i % step === 0)
      .map((r) => r.date as string);
  }, [chartData]);

  return (
    <div className="regime-timeline" data-testid="regime-timeline" id="chart-regime-timeline" aria-label="Fragility score timeline">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', gap: '8px' }}>
        <LaymanOverlay 
          explanationGenerator={() => {
            const rows = currentModelData.featuresData.data;
            const row = findRowForDate(rows, selectedDate);
            return generateTimelineExplanation(row);
          }}
        />
        <button 
          onClick={() => exportChart('chart-regime-timeline', 'regime_timeline')}
          style={{ fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer' }}
        >
          Export PNG
        </button>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
          onClick={handleClick}
          style={{ cursor: 'crosshair' }}
        >
          <defs>
            <linearGradient id="regimeGradient" x1="0" y1="0" x2="1" y2="0">
              {gradientStops.map((stop, i) => (
                <stop
                  key={i}
                  offset={stop.offset}
                  stopColor={stop.color}
                  stopOpacity={0.35}
                />
              ))}
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            ticks={xTicks}
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />

          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={32}
          />

          <Tooltip content={<TimelineTooltip />} />

          {/* Regime threshold lines */}
          <ReferenceLine y={33} stroke="var(--hedge)" strokeDasharray="4 4" strokeOpacity={0.6} />
          <ReferenceLine y={67} stroke="var(--ponzi)" strokeDasharray="4 4" strokeOpacity={0.6} />

          {/* Selected date cursor */}
          <ReferenceLine
            x={selectedIso}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeOpacity={0.8}
          />

          {/* Key event markers */}
          {activeCrisisWindows.map((crisis, i) => {
            const color = SEVERITY_COLORS[crisis.severity] || SEVERITY_COLORS['note'];
            return (
              <ReferenceLine
                key={i}
                x={crisis.start}
                stroke={color}
                strokeDasharray="6 3"
                strokeWidth={1.5}
                strokeOpacity={0.7}
                label={{
                  value: crisis.label,
                  position: 'top',
                  fontSize: 9,
                  fill: color,
                  fontFamily: 'var(--font-mono)',
                }}
              />
            );
          })}

          <Area
            type="monotone"
            dataKey="fragility_score"
            stroke="var(--accent)"
            strokeWidth={1.5}
            fill="url(#regimeGradient)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RegimeTimeline;
