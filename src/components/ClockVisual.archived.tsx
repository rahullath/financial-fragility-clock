import React, { useEffect, useState, useMemo, useRef } from 'react';
import { arc } from 'd3-shape';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { toNum } from '../utils/dataUtils';
import './ClockVisual.css';

// ── Regime config ──────────────────────────────────────────────────────────────

const REGIME_CONFIG = {
  HEDGE:       { color: '#2d6a4f', darkColor: '#166534', label: 'Hedge',       min: 0,  max: 33  },
  SPECULATIVE: { color: '#e9a800', darkColor: '#92400e', label: 'Speculative', min: 33, max: 67  },
  PONZI:       { color: '#c1121f', darkColor: '#7f1d1d', label: 'Ponzi',       min: 67, max: 100 },
} as const;

type Regime = keyof typeof REGIME_CONFIG;

// ── Geometry helpers ───────────────────────────────────────────────────────────

/** Map 0–100 score to 0–360 degrees (clockwise from 12 o'clock) */
const scoreToAngle = (score: number) => (score / 100) * 360;

/** Degrees to radians, offset so 0 = 12 o'clock */
const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;

/** Polar to cartesian */
const polar = (cx: number, cy: number, r: number, angleDeg: number) => ({
  x: cx + r * Math.cos(toRad(angleDeg)),
  y: cy + r * Math.sin(toRad(angleDeg)),
});

function findRowForDate(rows: DataRow[], date: Date): DataRow | null {
  const target = date.getTime();
  let best: DataRow | null = null;
  for (const r of rows) {
    const t = new Date(r.date as string).getTime();
    if (t <= target && toNum(r.fragility_score) != null) best = r;
  }
  return best ?? null;
}

// ── SVG arc generator ──────────────────────────────────────────────────────────

const OUTER_R = 110;
const INNER_R = 82;
const CX = 140;
const CY = 140;
const W = 280;
const H = 280;

// ── Component ──────────────────────────────────────────────────────────────────

const ClockVisual: React.FC = () => {
  const { currentModelData } = useModelContext();
  const { selectedDate, keyEvents } = useDateContext();

  // ── Derive values ──────────────────────────────────────────────────────────
  const { score, regime, date, trend, dominantSource } = useMemo(() => {
    const rows = currentModelData.featuresData.data;
    const row = findRowForDate(rows, selectedDate);

    if (!row) {
      return { score: 0, regime: 'SPECULATIVE' as Regime, date: selectedDate, trend: 'stable' as const, dominantSource: '—' };
    }

    const score = toNum(row.fragility_score) ?? 0;
    const regime = ((row.regime as string) ?? 'SPECULATIVE') as Regime;
    const date = new Date(row.date as string);

    const idx = rows.indexOf(row);
    const prev = rows[Math.max(0, idx - 30)];
    const prevScore = toNum(prev?.fragility_score) ?? score;
    const diff = score - prevScore;
    const trend: 'up' | 'down' | 'stable' = diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable';

    // Dominant source: use SHAP data if available, else first index
    const shap = currentModelData.outputsData['shap'] as Record<string, unknown> | undefined;
    const regimeShap = shap?.['regime_shap'] as Record<string, Record<string, number>> | undefined;
    const meanShap = shap?.['mean_abs_shap'] as Record<string, number> | undefined;
    const shapSource = regimeShap?.[regime] ?? meanShap;
    let dominantSource = currentModelData.info.indices[0];
    if (shapSource) {
      const top = Object.entries(shapSource).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
      if (top) dominantSource = top[0];
    }

    return { score, regime, date, trend, dominantSource };
  }, [currentModelData, selectedDate]);

  // ── Animation ──────────────────────────────────────────────────────────────
  const [displayAngle, setDisplayAngle] = useState(scoreToAngle(score));
  const [isPulsing, setIsPulsing] = useState(false);
  const [pulseColor, setPulseColor] = useState('#ffffff');
  const prevRegimeRef = useRef<string>(regime);

  useEffect(() => {
    setDisplayAngle(scoreToAngle(score));
    if (regime !== prevRegimeRef.current) {
      setPulseColor(REGIME_CONFIG[regime in REGIME_CONFIG ? regime as Regime : 'SPECULATIVE'].color);
      setIsPulsing(false);
      requestAnimationFrame(() => setIsPulsing(true));
      const t = setTimeout(() => setIsPulsing(false), 950);
      prevRegimeRef.current = regime;
      return () => clearTimeout(t);
    }
  }, [score, regime]);

  // ── Arc paths ──────────────────────────────────────────────────────────────
  const arcGen = useMemo(
    () => arc<{ startAngle: number; endAngle: number }>().innerRadius(INNER_R).outerRadius(OUTER_R),
    []
  );

  const regimeArcs = useMemo(
    () =>
      Object.entries(REGIME_CONFIG).map(([name, cfg]) => ({
        name,
        color: cfg.color,
        path: arcGen({
          startAngle: (scoreToAngle(cfg.min) * Math.PI) / 180,
          endAngle:   (scoreToAngle(cfg.max) * Math.PI) / 180,
        }),
      })),
    [arcGen]
  );

  // ── Needle ─────────────────────────────────────────────────────────────────
  const needleLen = INNER_R - 8;
  const needleTip = polar(0, 0, needleLen, displayAngle);
  const needleBack = polar(0, 0, 14, displayAngle + 180);

  // ── Tick marks (every 10 units = 36°) ─────────────────────────────────────
  const ticks = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const angle = i * 36;
        const isMajor = i % 5 === 0;
        const r1 = OUTER_R + 4;
        const r2 = OUTER_R + (isMajor ? 12 : 7);
        const p1 = polar(0, 0, r1, angle);
        const p2 = polar(0, 0, r2, angle);
        return { ...p1, x2: p2.x, y2: p2.y, isMajor, label: i * 10, angle };
      }),
    []
  );

  // ── Event markers — fixed at even positions on outer ring ─────────────────
  const eventMarkers = useMemo(() => {
    const total = keyEvents.length;
    return keyEvents.map((evt, i) => {
      // Space events evenly around the upper arc (210° to 330° range = 120° spread)
      const spreadDeg = 120;
      const startDeg = 210;
      const angle = total === 1
        ? startDeg + spreadDeg / 2
        : startDeg + (i / (total - 1)) * spreadDeg;
      const r = OUTER_R + 20;
      const pos = polar(0, 0, r, angle);

      // Find fragility at event date to determine colour
      const rows = currentModelData.featuresData.data;
      const row = findRowForDate(rows, evt.date);
      const evtRegime = (row?.regime as string) ?? 'SPECULATIVE';
      const color = REGIME_CONFIG[evtRegime as Regime]?.color ?? '#888';

      return { ...pos, label: evt.label, description: evt.description, color, angle };
    });
  }, [keyEvents, currentModelData]);

  // ── Hover state for event tooltips ─────────────────────────────────────────
  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);

  // ── Formatted values ───────────────────────────────────────────────────────
  const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const safeRegime: Regime = regime in REGIME_CONFIG ? (regime as Regime) : 'SPECULATIVE';
  const regimeColor = REGIME_CONFIG[safeRegime].color;
  const trendLabel = trend === 'up' ? '↑ Rising' : trend === 'down' ? '↓ Falling' : '→ Stable';
  const trendClass = `clock-status-value trend-${trend}`;
  const regimeClass = `clock-status-value regime-${safeRegime.toLowerCase()}`;

  return (
    <div className="clock-panel">
      <span className="clock-panel-label">Fragility Index</span>

      <div className="clock-svg-wrapper">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="clock-svg"
          aria-label={`Fragility score ${score.toFixed(1)}, ${safeRegime} regime`}
          role="img"
        >
          <g transform={`translate(${CX}, ${CY})`}>

            {/* ── Outer bezel ─────────────────────────────────────────── */}
            <circle r={OUTER_R + 28} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            <circle r={OUTER_R + 18} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

            {/* ── Regime arcs ─────────────────────────────────────────── */}
            {regimeArcs.map(({ name, color, path }) => (
              <path
                key={name}
                d={path ?? ''}
                fill={color}
                opacity={safeRegime === name ? 1 : 0.35}
                style={{ transition: 'opacity 500ms ease' }}
              />
            ))}

            {/* ── Arc border rings ─────────────────────────────────────── */}
            <circle r={OUTER_R}   fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} />
            <circle r={INNER_R}   fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} />

            {/* ── Pulse ring ───────────────────────────────────────────── */}
            {isPulsing && (
              <circle
                r={OUTER_R + 6}
                fill="none"
                stroke={pulseColor}
                strokeWidth={4}
                className="clock-pulse-ring"
              />
            )}

            {/* ── Tick marks ───────────────────────────────────────────── */}
            {ticks.map((t, i) => (
              <line
                key={i}
                x1={t.x} y1={t.y}
                x2={t.x2} y2={t.y2}
                stroke={t.isMajor ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}
                strokeWidth={t.isMajor ? 1.5 : 1}
              />
            ))}

            {/* ── Score labels at 0, 50, 100 ───────────────────────────── */}
            {[0, 50, 100].map((val) => {
              const p = polar(0, 0, OUTER_R + 14, scoreToAngle(val));
              return (
                <text
                  key={val}
                  x={p.x} y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8}
                  fill="rgba(255,255,255,0.3)"
                  fontFamily="var(--font-mono)"
                >
                  {val}
                </text>
              );
            })}

            {/* ── Inner face ───────────────────────────────────────────── */}
            <circle r={INNER_R - 1} fill="#0f1117" />
            <circle r={INNER_R - 1} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />

            {/* ── Subtle inner glow matching regime ────────────────────── */}
            <circle r={INNER_R - 1} fill={regimeColor} opacity={0.04} style={{ transition: 'fill 600ms ease, opacity 600ms ease' }} />

            {/* ── Date ─────────────────────────────────────────────────── */}
            <text
              y={-20}
              textAnchor="middle"
              fontSize={9}
              fontFamily="var(--font-mono)"
              fill="rgba(255,255,255,0.3)"
              letterSpacing="0.08em"
            >
              {formattedDate.toUpperCase()}
            </text>

            {/* ── Score ────────────────────────────────────────────────── */}
            <text
              y={10}
              textAnchor="middle"
              fontSize={34}
              fontWeight={700}
              fontFamily="var(--font-display)"
              fill="#ffffff"
            >
              {score.toFixed(1)}
            </text>

            {/* ── Regime name ──────────────────────────────────────────── */}
            <text
              y={30}
              textAnchor="middle"
              fontSize={9}
              fontFamily="var(--font-mono)"
              fill={regimeColor}
              letterSpacing="0.14em"
              style={{ transition: 'fill 500ms ease' }}
            >
              {safeRegime}
            </text>

            {/* ── Needle ───────────────────────────────────────────────── */}
            <g className="clock-needle" style={{ transform: `rotate(${displayAngle}deg)` }}>
              {/* Shadow */}
              <line
                x1={needleBack.x + 1} y1={needleBack.y + 1}
                x2={needleTip.x + 1}  y2={needleTip.y + 1}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={3}
                strokeLinecap="round"
              />
              {/* Needle body */}
              <line
                x1={needleBack.x} y1={needleBack.y}
                x2={needleTip.x}  y2={needleTip.y}
                stroke="#ffffff"
                strokeWidth={2}
                strokeLinecap="round"
              />
              {/* Tip accent in regime colour */}
              <line
                x1={0} y1={0}
                x2={needleTip.x} y2={needleTip.y}
                stroke={regimeColor}
                strokeWidth={1}
                strokeLinecap="round"
                opacity={0.7}
              />
            </g>

            {/* ── Centre pivot ─────────────────────────────────────────── */}
            <circle r={6} fill="#0f1117" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
            <circle r={2.5} fill={regimeColor} style={{ transition: 'fill 500ms ease' }} />

            {/* ── Event markers ────────────────────────────────────────── */}
            {eventMarkers.map((evt, i) => (
              <g key={i}
                onMouseEnter={() => setHoveredEvent(i)}
                onMouseLeave={() => setHoveredEvent(null)}
                style={{ cursor: 'default' }}
              >
                <circle
                  cx={evt.x} cy={evt.y}
                  r={hoveredEvent === i ? 7 : 5}
                  fill={evt.color}
                  opacity={0.9}
                  style={{ transition: 'r 0.15s ease' }}
                />
                <circle
                  cx={evt.x} cy={evt.y}
                  r={9}
                  fill="transparent"
                />
                {/* Tick line to arc */}
                {(() => {
                  const inner = polar(0, 0, OUTER_R + 4, evt.angle);
                  return (
                    <line
                      x1={inner.x} y1={inner.y}
                      x2={evt.x}   y2={evt.y}
                      stroke={evt.color}
                      strokeWidth={1}
                      opacity={0.4}
                    />
                  );
                })()}
                <title>{evt.label}: {evt.description}</title>
              </g>
            ))}

          </g>
        </svg>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div className="clock-status">
        <div className="clock-status-item">
          <span className="clock-status-label">Regime</span>
          <span className={regimeClass}>{REGIME_CONFIG[safeRegime].label}</span>
        </div>
        <div className="clock-status-divider" />
        <div className="clock-status-item">
          <span className="clock-status-label">30d Trend</span>
          <span className={trendClass}>{trendLabel}</span>
        </div>
        <div className="clock-status-divider" />
        <div className="clock-status-item">
          <span className="clock-status-label">Top Driver</span>
          <span className="clock-status-value">{dominantSource}</span>
        </div>
      </div>
    </div>
  );
};

export default ClockVisual;
