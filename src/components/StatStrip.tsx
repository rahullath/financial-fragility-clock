/**
 * StatStrip — spec v3
 *
 * Four-stat strip:
 *   1. CRASH PROXIMITY  — "X:XX to midnight" (fragility → time mapping)
 *   2. REGIME TRANSITION — P(→PONZI) from walk-forward RF classifier
 *   3. CRISIS SIMILARITY — DTW similarity vs selected crisis windows
 *   4. DAYS TO THRESHOLD — linear extrapolation of current fragility trend
 *
 * Each stat has a 30-day sparkline and an explanatory sub-label.
 */

import React, { useMemo } from 'react';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { toNum } from '../utils/dataUtils';
import { generateStatStripExplanation } from '../utils/laymanExplanations';
import LaymanOverlay from './LaymanOverlay';
import './StatStrip.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const CRITICAL_THRESHOLD = 80;  // fragility score level = "crisis conditions"
const SLOPE_WINDOW = 10;        // days of history used for linear trend

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
  // PONZI regime (score >= 70): show "past midnight" to indicate crisis threshold crossed
  if (score >= 70) {
    const minsPast = Math.round((score - 70) / 30 * 120); // maps 70-100 to 0-120 minutes past
    
    if (score >= 99) {
      return 'PAST MIDNIGHT';
    } else if (minsPast === 0) {
      return 'PAST MIDNIGHT';
    } else {
      return `${minsPast} minutes past midnight`;
    }
  }
  
  // HEDGE and SPECULATIVE regimes (score < 70): show "to midnight"
  const mins = Math.round((1 - score / 100) * 120); // 120 min = 2 hours
  
  if (mins >= 60) {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    if (mm === 0) {
      return `${hh}h 0m to midnight`;
    }
    return `${hh}h ${mm}m to midnight`;
  } else if (mins <= 1) {
    // At score=100 (0 minutes) or score=99.17+ (1 minute), show "1 minute to midnight"
    return '1 minute to midnight';
  } else {
    return `${mins} minutes to midnight`;
  }
}

/**
 * Compute the linear extrapolation of fragility score to CRITICAL_THRESHOLD.
 * Uses OLS on the last SLOPE_WINDOW data points.
 *
 * Returns:
 *   { days: number, direction: 'rising'|'falling'|'stable' }
 *   days = Infinity if slope is zero or negative (not heading to threshold)
 */
function computeDaysToThreshold(scores: (number | null)[]): {
  days: number | null;
  direction: 'rising' | 'falling' | 'stable';
  slopePerDay: number;
} {
  const valid = scores.filter((v): v is number => v != null);
  if (valid.length < 3) return { days: null, direction: 'stable', slopePerDay: 0 };

  const n = valid.length;
  // OLS: y = a + b*x where x is 0..n-1
  const xMean = (n - 1) / 2;
  const yMean = valid.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (valid[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;  // points per trading day
  const currentScore = valid[n - 1];

  if (Math.abs(slope) < 0.05) return { days: null, direction: 'stable', slopePerDay: slope };

  if (slope <= 0) return { days: null, direction: 'falling', slopePerDay: slope };

  // How many days at this slope until we hit the critical threshold?
  if (currentScore >= CRITICAL_THRESHOLD) return { days: 0, direction: 'rising', slopePerDay: slope };
  const days = Math.round((CRITICAL_THRESHOLD - currentScore) / slope);
  return { days, direction: 'rising', slopePerDay: slope };
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
  detail?: string;           // additional one-liner below sub
  sparkValues: (number | null)[];
  sparkColor: string;
}

const StatBlock: React.FC<StatBlockProps> = ({ label, value, sub, detail, sparkValues, sparkColor }) => (
  <div className="stat-block">
    <span className="stat-label">{label}</span>
    <span className="stat-value" style={{ color: sparkColor }}>{value}</span>
    <span className="stat-sub">{sub}</span>
    {detail && <span className="stat-detail">{detail}</span>}
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

  // ── Stat 1: Fragility → minutes-to-midnight ────────────────────────────────
  const score = toNum(row?.fragility_score) ?? 0;
  const timeStr = minutesToMidnight(score);
  
  // Determine if we're past midnight for the sub-label
  const isPastMidnight = score >= 70;
  const proximitySub = isPastMidnight ? 'past midnight' : 'to midnight';

  // ── 30-day sparkline window ────────────────────────────────────────────────
  const sparkWindow = 30;
  const sparkRows = useMemo(
    () => rows.slice(Math.max(0, idx - sparkWindow + 1), idx + 1),
    [rows, idx]
  );
  const fragSparkline = sparkRows.map((r) => toNum(r.fragility_score));

  // ── Stat 2: Regime transition probability (→ PONZI) ────────────────────────
  const regimeProbValue = toNum((row as Record<string, unknown> | null)?.['crash_probability'] as number | null);
  const regimeProbStr = regimeProbValue != null ? `${(regimeProbValue * 100).toFixed(0)}%` : '—';
  const regimeProbSub = regimeProbValue != null
    ? `P(→ PONZI regime, 30d)`
    : 'classifier not computed';
  const regimeProbSparkline = sparkRows.map((r) =>
    toNum((r as Record<string, unknown>)['crash_probability'] as number | null)
  );

  // ── Stat 3: Crisis similarity (DTW) ───────────────────────────────────────
  const similarityValue = toNum((row as Record<string, unknown> | null)?.['crisis_similarity_composite'] as number | null);
  const similarityStr = similarityValue != null ? `${similarityValue.toFixed(0)} / 100` : '—';
  const similaritySub = similarityValue != null ? 'vs selected crises (DTW)' : 'DTW not computed';
  const simSparkline = sparkRows.map((r) =>
    toNum((r as Record<string, unknown>)['crisis_similarity_composite'] as number | null)
  );

  // ── Stat 4: Days to critical threshold ────────────────────────────────────
  // Use last SLOPE_WINDOW scores to fit a linear trend; extrapolate to score=80
  const slopeScores = useMemo(() => {
    const window = rows.slice(Math.max(0, idx - SLOPE_WINDOW + 1), idx + 1);
    return window.map((r) => toNum(r.fragility_score));
  }, [rows, idx]);

  const { days, direction, slopePerDay } = useMemo(
    () => computeDaysToThreshold(slopeScores),
    [slopeScores]
  );

  let daysStr: string;
  let daysSub: string;
  let daysDetail: string | undefined;

  if (score >= CRITICAL_THRESHOLD) {
    daysStr = 'NOW';
    daysSub = 'Critical threshold reached';
    daysDetail = `Score ${score.toFixed(0)} ≥ ${CRITICAL_THRESHOLD} — crisis conditions active`;
  } else if (direction === 'falling') {
    daysStr = '↓';
    daysSub = 'Fragility declining';
    daysDetail = `Trend: ${slopePerDay.toFixed(2)} pts/day — moving away from threshold`;
  } else if (direction === 'stable' || days == null) {
    daysStr = '—';
    daysSub = 'Trend flat';
    daysDetail = 'Insufficient directional signal over last 10 days';
  } else {
    daysStr = `~${days}d`;
    daysSub = `to score ${CRITICAL_THRESHOLD} (critical)`;
    // Convert trading days to calendar estimate (÷5 * 7)
    const calDays = Math.round(days * 7 / 5);
    daysDetail = `At ${slopePerDay.toFixed(2)} pts/day · ≈${calDays} calendar days if trend holds`;
  }

  // ── Colours ────────────────────────────────────────────────────────────────
  const proximityColor = score > 67 ? '#ef4444' : score > 33 ? '#f59e0b' : '#22c55e';

  const probColor = regimeProbValue != null
    ? (regimeProbValue > 0.67 ? '#ef4444' : regimeProbValue > 0.33 ? '#f59e0b' : '#22c55e')
    : '#3d4357';

  const simColor = similarityValue != null
    ? (similarityValue > 67 ? '#ef4444' : similarityValue > 33 ? '#f59e0b' : '#22c55e')
    : '#3d4357';

  const daysColor = score >= CRITICAL_THRESHOLD
    ? '#ef4444'
    : direction === 'falling'
    ? '#22c55e'
    : direction === 'stable' || days == null
    ? '#3d4357'
    : days < 20
    ? '#ef4444'
    : days < 60
    ? '#f59e0b'
    : '#22c55e';

  return (
    <div className="stat-strip panel-card" data-testid="stat-strip">
      <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10 }}>
        <LaymanOverlay 
          explanationGenerator={() => generateStatStripExplanation(row)}
        />
      </div>
      <StatBlock
        label="CRASH PROXIMITY"
        value={timeStr}
        sub={proximitySub}
        detail={`Fragility score: ${score.toFixed(1)} / 100`}
        sparkValues={fragSparkline}
        sparkColor={proximityColor}
      />
      <div className="stat-divider" />
      <StatBlock
        label="REGIME TRANSITION"
        value={regimeProbStr}
        sub={regimeProbSub}
        sparkValues={regimeProbSparkline}
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
      <div className="stat-divider" />
      <StatBlock
        label="DAYS TO CRITICAL"
        value={daysStr}
        sub={daysSub}
        detail={daysDetail}
        sparkValues={slopeScores}
        sparkColor={daysColor}
      />
    </div>
  );
};

export default StatStrip;
