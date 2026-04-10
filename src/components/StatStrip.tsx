/**
 * StatStrip — spec v2 §5
 *
 * Full-width strip with three hero numbers:
 *   1. CRASH PROXIMITY  — "X:XX to midnight" (derived from fragility score)
 *   2. CRASH PROBABILITY — RF classifier output; shows "—" if not in JSON
 *   3. CRISIS SIMILARITY — DTW score; shows "—" if not computed yet
 *
 * Each stat has a 30-day sparkline beneath the number.
 */

import React, { useMemo } from 'react';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { toNum } from '../utils/dataUtils';
import './StatStrip.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function findRowForDate(rows: DataRow[], date: Date): { row: DataRow | null; idx: number } {
  const target = date.getTime();
  let best: DataRow | null = null;
  let bestIdx = -1;
  rows.forEach((r, i) => {
    const t = new Date(r.date as string).getTime();
    if (t <= target && toNum(r.fragility_score) != null) { best = r; bestIdx = i; }
  });
  return { row: best, idx: bestIdx };
}

function minutesToMidnight(score: number): string {
  const mins = Math.round((1 - score / 100) * 720);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

interface SparklineProps {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
}

const Sparkline: React.FC<SparklineProps> = ({ values, color, width = 80, height = 24 }) => {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      if (v == null) return null;
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="sparkline-svg">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  );
};

// ── StatBlock ─────────────────────────────────────────────────────────────────

interface StatBlockProps {
  label: string;
  value: string;
  sub: string;
  sparkValues: (number | null)[];
  sparkColor: string;
}

const StatBlock: React.FC<StatBlockProps> = ({ label, value, sub, sparkValues, sparkColor }) => (
  <div className="stat-block">
    <span className="stat-label">{label}</span>
    <span className="stat-value" style={{ color: sparkColor }}>{value}</span>
    <span className="stat-sub">{sub}</span>
    <div className="stat-spark">
      <Sparkline values={sparkValues} color={sparkColor} />
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const StatStrip: React.FC = () => {
  const { currentModelData } = useModelContext();
  const { selectedDate } = useDateContext();

  const rows = currentModelData.featuresData.data;

  const { row, idx } = useMemo(() => findRowForDate(rows, selectedDate), [rows, selectedDate]);

  // ── Fragility score → minutes to midnight ──────────────────────────────────
  const score = toNum(row?.fragility_score) ?? 0;
  const timeStr = minutesToMidnight(score);

  // ── 30-day sparklines ──────────────────────────────────────────────────────
  const sparkWindow = 30;
  const sparkRows = useMemo(
    () => rows.slice(Math.max(0, idx - sparkWindow + 1), idx + 1),
    [rows, idx, sparkWindow]
  );
  const fragSparkline = sparkRows.map((r) => toNum(r.fragility_score));

  // Crash probability — from RF classifier output, or null if not present
  const crashProbSparkline = sparkRows.map((r) => {
    const v = toNum((r as Record<string, unknown>)['crash_probability'] as number | null);
    return v;
  });
  const crashProbValue = toNum((row as Record<string, unknown> | null)?.['crash_probability'] as number | null);
  const crashProbStr = crashProbValue != null ? `${(crashProbValue * 100).toFixed(0)}%` : '—';
  const crashProbSub = crashProbValue != null ? 'next 30 days' : 'classifier not computed';

  // Crisis similarity — DTW output if present, else null
  const similarityValue = toNum((row as Record<string, unknown> | null)?.['crisis_similarity_composite'] as number | null);
  const similarityStr = similarityValue != null ? `${similarityValue.toFixed(0)} / 100` : '—';
  const similaritySub = similarityValue != null ? 'vs selected crises' : 'DTW not computed';
  const simSparkline = sparkRows.map((r) => toNum((r as Record<string, unknown>)['crisis_similarity_composite'] as number | null));

  // ── Colours ────────────────────────────────────────────────────────────────
  const proximityColor = score > 67 ? '#ef4444' : score > 33 ? '#f59e0b' : '#22c55e';
  const probColor = crashProbValue != null
    ? (crashProbValue > 0.67 ? '#ef4444' : crashProbValue > 0.33 ? '#f59e0b' : '#22c55e')
    : '#3d4357';
  const simColor = similarityValue != null
    ? (similarityValue > 67 ? '#ef4444' : similarityValue > 33 ? '#f59e0b' : '#22c55e')
    : '#3d4357';

  return (
    <div className="stat-strip panel-card">
      <StatBlock
        label="CRASH PROXIMITY"
        value={timeStr}
        sub="to midnight"
        sparkValues={fragSparkline}
        sparkColor={proximityColor}
      />
      <div className="stat-divider" />
      <StatBlock
        label="CRASH PROBABILITY"
        value={crashProbStr}
        sub={crashProbSub}
        sparkValues={crashProbSparkline}
        sparkColor={probColor}
      />
      <div className="stat-divider" />
      <StatBlock
        label="CRISIS SIMILARITY"
        value={similarityStr}
        sub={similaritySub}
        sparkValues={simSparkline}
        sparkColor={simColor}
      />
    </div>
  );
};

export default StatStrip;
