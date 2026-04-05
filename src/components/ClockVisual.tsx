import React, { useEffect, useState, useMemo } from 'react';
import { arc } from 'd3-shape';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { toNum } from '../utils/dataUtils';
import './ClockVisual.css';

// ── Regime config ─────────────────────────────────────────────────────────────

const REGIME_CONFIG = {
  HEDGE: { color: '#2d6a4f', startAngle: 0, endAngle: 33, label: 'Hedge' },
  SPECULATIVE: {
    color: '#e9a800',
    startAngle: 33,
    endAngle: 67,
    label: 'Speculative',
  },
  PONZI: { color: '#c1121f', startAngle: 67, endAngle: 100, label: 'Ponzi' },
} as const;

type Regime = keyof typeof REGIME_CONFIG;

// ── Helpers ───────────────────────────────────────────────────────────────────

const scoreToAngle = (score: number) => (score / 100) * 360;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Find the data row closest to (but not after) the given date, with a valid numeric fragility_score. */
function findRowForDate(rows: DataRow[], date: Date): DataRow | null {
  const target = date.getTime();
  let best: DataRow | null = null;
  for (const r of rows) {
    const t = new Date(r.date as string).getTime();
    if (t <= target && toNum(r.fragility_score) != null && r.regime != null) {
      best = r;
    }
  }
  return best ?? null;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * ClockVisual
 *
 * Self-contained — reads selected model's data from ModelContext and the
 * active date from DateContext. No props needed.
 *
 * Requirements: 11.1–11.7, 36.2
 */
const ClockVisual: React.FC = () => {
  const { currentModelData } = useModelContext();
  const { selectedDate, keyEvents } = useDateContext();

  // ── Derive values from context ──────────────────────────────────────────────
  const { score, regime, date, trend, dominantSource } = useMemo(() => {
    const rows = currentModelData.featuresData.data;
    const row = findRowForDate(rows, selectedDate);

    if (!row) {
      return {
        score: 0,
        regime: 'SPECULATIVE' as Regime,
        date: selectedDate,
        trend: 'stable' as const,
        dominantSource: currentModelData.info.indices[0],
      };
    }

    const score = toNum(row.fragility_score) ?? 0;
    const regime = ((row.regime as string) ?? 'SPECULATIVE') as Regime;
    const date = new Date(row.date as string);

    // 30-day trend
    const idx = rows.indexOf(row);
    const prev = rows[Math.max(0, idx - 30)];
    const prevScore = toNum(prev?.fragility_score) ?? score;
    const trend: 'up' | 'down' | 'stable' =
      score - prevScore > 2 ? 'up' : score - prevScore < -2 ? 'down' : 'stable';

    // Dominant contagion source — first index key with a non-null value in row
    const markets = currentModelData.info.indices;
    const dominantSource = markets.find((m) => row[m] != null) ?? markets[0];

    return { score, regime, date, trend, dominantSource };
  }, [currentModelData, selectedDate]);

  // ── Animation state ─────────────────────────────────────────────────────────
  const [currentAngle, setCurrentAngle] = useState(scoreToAngle(score));
  const [isPulsing, setIsPulsing] = useState(false);
  const [prevRegime, setPrevRegime] = useState<string>(regime);

  useEffect(() => {
    setCurrentAngle(scoreToAngle(score));
    if (regime !== prevRegime) {
      setIsPulsing(true);
      setPrevRegime(regime);
      const t = setTimeout(() => setIsPulsing(false), 1000);
      return () => clearTimeout(t);
    }
  }, [score, regime, prevRegime]);

  // ── SVG geometry ───────────────────────────────────────────────────────────
  const W = 400,
    H = 400,
    cx = W / 2,
    cy = H / 2;
  const outerR = 150,
    innerR = 120;

  const arcGen = useMemo(
    () =>
      arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(innerR)
        .outerRadius(outerR),
    []
  );

  const regimeArcs = useMemo(
    () =>
      Object.entries(REGIME_CONFIG).map(([name, cfg]) => ({
        name,
        color: cfg.color,
        path: arcGen({
          startAngle: toRad(scoreToAngle(cfg.startAngle)),
          endAngle: toRad(scoreToAngle(cfg.endAngle)),
        }),
      })),
    [arcGen]
  );

  const needleLen = innerR - 10;
  const needleRad = toRad(currentAngle - 90);
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const trendArrow =
    trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  const safeRegime: Regime =
    regime in REGIME_CONFIG ? regime : 'SPECULATIVE';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="clock-visual">
      <svg
        width={W}
        height={H}
        className="clock-svg"
        aria-label={`Financial Fragility Clock: score ${score.toFixed(1)}, regime ${safeRegime}`}
        role="img"
      >
        <g transform={`translate(${cx}, ${cy})`}>
          {/* Regime arcs */}
          {regimeArcs.map(({ name, color, path }) => (
            <path
              key={name}
              d={path ?? ''}
              fill={color}
              opacity={0.85}
              className="regime-arc"
            />
          ))}

          {/* Outer ring (pulse on threshold crossing) */}
          <circle
            r={outerR + 5}
            fill="none"
            stroke="var(--border)"
            strokeWidth={2}
            className={isPulsing ? 'pulse-ring' : ''}
          />

          {/* Inner background */}
          <circle
            r={innerR - 10}
            fill="var(--bg)"
            stroke="var(--border)"
            strokeWidth={1}
          />

          {/* Needle */}
          <line
            x1={0}
            y1={0}
            x2={nx - cx}
            y2={ny - cy}
            stroke="var(--text-primary)"
            strokeWidth={3}
            strokeLinecap="round"
            className="needle"
          />
          <circle r={6} fill="var(--text-primary)" />

          {/* Date */}
          <text
            y={-12}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fontFamily="var(--font-mono)"
            fill="var(--text-muted)"
          >
            {formattedDate}
          </text>

          {/* Score */}
          <text
            y={16}
            textAnchor="middle"
            fontSize={28}
            fontWeight={700}
            fontFamily="var(--font-display)"
            fill="var(--text-primary)"
          >
            {score.toFixed(1)}
          </text>

          {/* Score label */}
          <text
            y={34}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
          >
            FRAGILITY INDEX
          </text>
        </g>

        {/* Event markers on outer ring */}
        {keyEvents.map((event, i) => {
          // Find the row nearest this event to get the fragility score angle
          const eventRows = currentModelData.featuresData.data;
          const eFind = findRowForDate(eventRows, event.date);
          if (!eFind) return null;
          const eScore = (eFind.fragility_score as number) ?? 0;
          const eAngle = toRad(scoreToAngle(eScore) - 90);
          const mr = outerR + 14;
          const mx2 = cx + mr * Math.cos(eAngle);
          const my2 = cy + mr * Math.sin(eAngle);
          return (
            <g key={i}>
              <circle
                cx={mx2}
                cy={my2}
                r={5}
                fill="#dc3545"
                className="event-marker"
                aria-label={event.label}
              >
                <title>{event.label}: {event.description}</title>
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Regime badges */}
      <div className="regime-badges">
        <div
          className="badge regime-badge"
          style={{ backgroundColor: REGIME_CONFIG[safeRegime].color }}
        >
          {REGIME_CONFIG[safeRegime].label}
        </div>
        <div className="badge trend-badge">
          30d {trendArrow}
        </div>
        <div className="badge source-badge">{dominantSource}</div>
      </div>
    </div>
  );
};

export default ClockVisual;
