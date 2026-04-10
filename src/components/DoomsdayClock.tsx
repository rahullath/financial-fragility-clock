/**
 * DoomsdayClock — spec v2 §4
 *
 * A genuine doomsday clock face:
 *  - 12 o'clock = CRASH
 *  - 6 o'clock  = SAFE
 *  - Needle moves counterclockwise from 6 toward 12 as risk rises
 *  - "X:XX to midnight" is the primary display  (derived from fragility score)
 *  - Regime label below in regime colour
 *  - Regime-coloured radial glow behind face
 *
 * Needle angle:  0 score → 6 o'clock (180°), 100 score → 12 o'clock (0°/360°)
 * Going counterclockwise:  angle = 180 + (score / 100) * 180
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { toNum } from '../utils/dataUtils';
import './DoomsdayClock.css';

// ── Types + constants ──────────────────────────────────────────────────────────

const REGIME_CFG = {
  HEDGE:       { color: '#22c55e', label: 'HEDGE' },
  SPECULATIVE: { color: '#f59e0b', label: 'SPECULATIVE' },
  PONZI:       { color: '#ef4444', label: 'PONZI' },
} as const;

type Regime = keyof typeof REGIME_CFG;

// SVG viewport
const W = 320;
const H = 340;
const CX = W / 2;
const CY = H / 2 - 10;  // clock centre slightly above SVG centre
const R_OUTER = 130;     // outer ring
const R_INNER = 100;     // inner clock face
const R_NEEDLE = 88;     // needle tip radius

// ── Angle helpers ─────────────────────────────────────────────────────────────

/** score 0–100 → angle in clock-degrees where 0° = 12 o'clock */
const scoreToAngle = (score: number): number => 180 + (score / 100) * 180;

/** clock-degrees → polar (x,y) centred on (cx, cy) */
const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

// ── Minutes-to-midnight formatter ─────────────────────────────────────────────

/** score 0–100 → "HH:MM" string, where 100 = "00:00" and 0 = "12:00" */
const minutesToMidnight = (score: number): string => {
  const mins = Math.round((1 - score / 100) * 720); // 720 min = 12 hours
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// ── Data resolver ─────────────────────────────────────────────────────────────

function findRowForDate(rows: DataRow[], date: Date): DataRow | null {
  const target = date.getTime();
  let best: DataRow | null = null;
  for (const r of rows) {
    const t = new Date(r.date as string).getTime();
    if (t <= target && toNum(r.fragility_score) != null) best = r;
  }
  return best ?? null;
}

// ── Needle tip colour ─────────────────────────────────────────────────────────

function needleTipColor(score: number): string {
  if (score < 33) return '#22c55e';
  if (score < 67) return '#f59e0b';
  if (score < 85) return '#ef4444';
  return '#ff2020';
}

// ── Component ─────────────────────────────────────────────────────────────────

const DoomsdayClock: React.FC = () => {
  const { currentModelData } = useModelContext();
  const { selectedDate } = useDateContext();

  // ── Derive display values ──────────────────────────────────────────────────
  const { score, regime, formattedDate } = useMemo(() => {
    const rows = currentModelData.featuresData.data;
    const row = findRowForDate(rows, selectedDate);
    const score = row ? (toNum(row.fragility_score) ?? 0) : 0;
    const regime = ((row?.regime as string) ?? 'SPECULATIVE') as Regime;
    const formattedDate = selectedDate.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    return { score, regime, formattedDate };
  }, [currentModelData, selectedDate]);

  const safeRegime: Regime = regime in REGIME_CFG ? regime : 'SPECULATIVE';
  const regimeColor = REGIME_CFG[safeRegime].color;
  const timeDisplay = minutesToMidnight(score);

  // ── Animated needle angle ──────────────────────────────────────────────────
  const targetAngle = scoreToAngle(score);
  const [displayAngle, setDisplayAngle] = useState(targetAngle);

  useEffect(() => {
    // requestAnimationFrame gives CSS transition time to notice the new value
    const id = requestAnimationFrame(() => setDisplayAngle(targetAngle));
    return () => cancelAnimationFrame(id);
  }, [targetAngle]);

  // ── Build SVG elements ────────────────────────────────────────────────────

  // Hour markers at 12 (0°), 3 (90°), 6 (180°), 9 (270°)
  const hourMarkers = [0, 90, 180, 270].map((deg) => {
    const outer = polar(CX, CY, R_OUTER, deg);
    const inner = polar(CX, CY, R_OUTER - 12, deg);
    const label = polar(CX, CY, R_OUTER + 18, deg);
    const text = deg === 0 ? '12' : deg === 90 ? '3' : deg === 180 ? '6' : '9';
    return { outer, inner, label, text, deg };
  });

  // Minute tick marks (every 6° = 60 points total)
  const minuteTicks = Array.from({ length: 60 }, (_, i) => {
    const deg = i * 6;
    const isHour = i % 5 === 0;
    const r1 = R_OUTER - (isHour ? 12 : 6);
    const r2 = R_OUTER - (isHour ? 0 : 2);
    return {
      p1: polar(CX, CY, r1, deg),
      p2: polar(CX, CY, r2, deg),
      isHour,
    };
  });

  // Needle geometry
  const needleTip = polar(CX, CY, R_NEEDLE, displayAngle);
  const needleBase = polar(CX, CY, 16, displayAngle + 180);
  const tColor = needleTipColor(score);

  return (
    <div className="doomsday-clock" aria-label={`Doomsday clock: ${timeDisplay} to midnight, fragility ${score.toFixed(1)}, ${safeRegime} regime`}>
      {/* ── Clock SVG ──────────────────────────────────────────────────── */}
      <svg viewBox={`0 0 ${W} ${H}`} className="doomsday-svg" role="img">
        <defs>
          {/* Regime glow gradient */}
          <radialGradient id="regimeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={regimeColor} stopOpacity="0.12" />
            <stop offset="100%" stopColor={regimeColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Regime radial glow ────────────────────────────────────────── */}
        <circle
          cx={CX} cy={CY} r={R_INNER}
          fill="url(#regimeGlow)"
          style={{ transition: 'fill 800ms ease' }}
        />

        {/* ── Outer ring ────────────────────────────────────────────────── */}
        <circle
          cx={CX} cy={CY} r={R_OUTER}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        {/* ── Minute ticks ─────────────────────────────────────────────── */}
        {minuteTicks.map((t, i) => (
          <line
            key={i}
            x1={t.p1.x} y1={t.p1.y}
            x2={t.p2.x} y2={t.p2.y}
            stroke={t.isHour ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}
            strokeWidth={t.isHour ? 1.5 : 0.8}
          />
        ))}

        {/* ── Hour markers ─────────────────────────────────────────────── */}
        {hourMarkers.map((m) => (
          <g key={m.deg}>
            <line
              x1={m.inner.x} y1={m.inner.y}
              x2={m.outer.x} y2={m.outer.y}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={2}
            />
            <text
              x={m.label.x}
              y={m.label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontFamily="var(--font-mono)"
              fill="rgba(255,255,255,0.25)"
              letterSpacing="0.05em"
            >
              {m.text}
            </text>
          </g>
        ))}

        {/* ── CRASH / SAFE labels ───────────────────────────────────────── */}
        <text
          x={CX} y={CY - R_OUTER - 8}
          textAnchor="middle"
          fontSize={8}
          fontFamily="var(--font-mono)"
          fill={score > 80 ? '#ef4444' : 'rgba(255,255,255,0.25)'}
          letterSpacing="0.2em"
          style={{ transition: 'fill 600ms ease' }}
        >
          CRASH
        </text>
        <text
          x={CX} y={CY + R_OUTER + 18}
          textAnchor="middle"
          fontSize={8}
          fontFamily="var(--font-mono)"
          fill="rgba(255,255,255,0.15)"
          letterSpacing="0.2em"
        >
          SAFE
        </text>

        {/* ── Clock face (dark inner circle) ────────────────────────────── */}
        <circle
          cx={CX} cy={CY}
          r={R_INNER}
          fill="#070a10"
        />
        <circle
          cx={CX} cy={CY}
          r={R_INNER}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />

        {/* ── Date (small, top of face) ──────────────────────────────────── */}
        <text
          x={CX} y={CY - 42}
          textAnchor="middle"
          fontSize={8}
          fontFamily="var(--font-mono)"
          fill="rgba(255,255,255,0.2)"
          letterSpacing="0.08em"
        >
          {formattedDate.toUpperCase()}
        </text>

        {/* ── "X:XX" — primary display ──────────────────────────────────── */}
        <text
          x={CX} y={CY - 4}
          textAnchor="middle"
          fontSize={38}
          fontWeight={700}
          fontFamily="var(--font-display)"
          fill="#ffffff"
          letterSpacing="-0.02em"
        >
          {timeDisplay}
        </text>

        {/* ── "to midnight" label ───────────────────────────────────────── */}
        <text
          x={CX} y={CY + 20}
          textAnchor="middle"
          fontSize={8}
          fontFamily="var(--font-mono)"
          fill="rgba(255,255,255,0.3)"
          letterSpacing="0.15em"
        >
          TO MIDNIGHT
        </text>

        {/* ── Raw score ─────────────────────────────────────────────────── */}
        <text
          x={CX} y={CY + 38}
          textAnchor="middle"
          fontSize={11}
          fontFamily="var(--font-mono)"
          fill={regimeColor}
          letterSpacing="0.04em"
          style={{ transition: 'fill 600ms ease' }}
        >
          {score.toFixed(1)} / 100
        </text>

        {/* ── Needle ────────────────────────────────────────────────────── */}
        <g className="clock-needle-group" style={{ transform: `rotate(${displayAngle - 180}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
          {/* Shadow */}
          <line
            x1={needleBase.x + 1} y1={needleBase.y + 1}
            x2={needleTip.x + 1}  y2={needleTip.y + 1}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Body */}
          <line
            x1={needleBase.x} y1={needleBase.y}
            x2={needleTip.x}  y2={needleTip.y}
            stroke="#e8eaf0"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* Tip colour accent — last third of needle */}
          {(() => {
            const mid = polar(CX, CY, R_NEEDLE * 0.55, displayAngle);
            return (
              <line
                x1={mid.x} y1={mid.y}
                x2={needleTip.x} y2={needleTip.y}
                stroke={tColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.9}
                style={{ transition: 'stroke 600ms ease' }}
              />
            );
          })()}
        </g>

        {/* ── Pivot ─────────────────────────────────────────────────────── */}
        <circle cx={CX} cy={CY} r={5} fill="#070a10" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={2.5} fill={regimeColor} style={{ transition: 'fill 600ms ease' }} />
      </svg>

      {/* ── Regime label below clock ────────────────────────────────────── */}
      <div className="doomsday-regime" style={{ color: regimeColor }}>
        {REGIME_CFG[safeRegime].label}
      </div>
    </div>
  );
};

export default DoomsdayClock;
