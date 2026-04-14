/**
 * DoomsdayClock — spec v2 §4
 *
 * A genuine doomsday clock face with literal clock hands:
 *  - 12 o'clock = MIDNIGHT (crisis threshold at score=70)
 *  - Clock shows actual time: "1h 20m to midnight" = 10:40pm
 *  - Three hands like a real clock:
 *    - Hour hand (short, thick) - moves smoothly with minutes
 *    - Minute hand (long, thin) - shows exact minutes
 *    - Second hand (medium, dim red) - ambient rotation showing time passing
 *  - "X:XX to/past midnight" is the primary display (derived from fragility score)
 *  - Regime label below in regime colour
 *  - Regime-coloured radial glow behind face
 *
 * Time mapping:
 *  - Score 0-69 (HEDGE/SPECULATIVE): 10:00pm - 11:59pm (approaching midnight)
 *  - Score 70-100 (PONZI): 12:00am - 2:00am (past midnight, crisis mode)
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { toNum } from '../utils/dataUtils';
import { findAnalogue } from '../data/historicalAnalogues';
import { generateClockExplanation } from '../utils/laymanExplanations';
import LaymanOverlay from './LaymanOverlay';
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

/** Convert score to actual clock time (hours and minutes) */
const scoreToTime = (score: number): { hours: number; minutes: number } => {
  if (score >= 70) {
    // PONZI regime: past midnight (12:00am - 2:00am)
    const minsPast = Math.round((score - 70) / 30 * 120); // 0-120 minutes past midnight
    const hours = Math.floor(minsPast / 60);
    const minutes = minsPast % 60;
    return { hours, minutes }; // 0-2 hours
  } else {
    // HEDGE/SPECULATIVE: before midnight (10:00pm - 11:59pm)
    const minsToMidnight = Math.round((1 - score / 100) * 120); // 0-120 minutes to midnight
    const totalMinutes = 24 * 60 - minsToMidnight; // Convert to minutes from midnight
    const hours = Math.floor(totalMinutes / 60) % 12 || 12;
    const minutes = totalMinutes % 60;
    return { hours: hours === 0 ? 12 : hours, minutes }; // 10-11 hours (pm)
  }
};

/** Convert hours and minutes to clock angle (0° = 12 o'clock) */
const timeToAngle = (hours: number, minutes: number, isHourHand: boolean): number => {
  if (isHourHand) {
    // Hour hand: moves smoothly based on hour + fraction of hour from minutes
    // Each hour = 30° (360° / 12 hours)
    return ((hours % 12) + minutes / 60) * 30;
  } else {
    // Minute hand: each minute = 6° (360° / 60 minutes)
    return minutes * 6;
  }
};

/** clock-degrees → polar (x,y) centred on (cx, cy) */
const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

// ── Minutes-to-midnight formatter ─────────────────────────────────────────────

/** score 0–100 → "Xh Xm to midnight" or "XX minutes to midnight", where 100 = "1 minute to midnight" and 0 = "2h 0m to midnight" */
const minutesToMidnight = (score: number): string => {
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

// ── Component ─────────────────────────────────────────────────────────────────

const DoomsdayClock: React.FC = () => {
  const { currentModelData, lastUpdated } = useModelContext();
  const { selectedDate } = useDateContext();

  // ── Derive display values ──────────────────────────────────────────────────
  const { score, regime, formattedDate } = useMemo(() => {
    const rows = currentModelData.featuresData.data;
    const row = findRowForDate(rows, selectedDate);
    const score = row ? (toNum(row.fragility_score) ?? 0) : 0;
    
    // Determine regime based on score (not from data, as data might not have it)
    let regime: Regime = 'HEDGE';
    if (score >= 70) {
      regime = 'PONZI';
    } else if (score >= 40) {
      regime = 'SPECULATIVE';
    }
    
    const formattedDate = selectedDate.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    return { score, regime, formattedDate };
  }, [currentModelData, selectedDate]);

  const safeRegime: Regime = regime in REGIME_CFG ? regime : 'SPECULATIVE';
  const regimeColor = REGIME_CFG[safeRegime].color;
  const timeDisplay = minutesToMidnight(score);
  const analogue = findAnalogue(score);

  // Check if selectedDate is within historical data range to avoid circular analogues
  const [startDateStr, endDateStr] = currentModelData.info.dateRange;
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const isHistoricalDate = selectedDate >= startDate && selectedDate <= endDate;
  const showAnalogue = !isHistoricalDate && analogue;

  // ── Animated clock hands ──────────────────────────────────────────────────
  const { hours, minutes } = useMemo(() => scoreToTime(score), [score]);
  const targetHourAngle = timeToAngle(hours, minutes, true);
  const targetMinuteAngle = timeToAngle(hours, minutes, false);
  
  const [displayHourAngle, setDisplayHourAngle] = useState(targetHourAngle);
  const [displayMinuteAngle, setDisplayMinuteAngle] = useState(targetMinuteAngle);
  
  // Ambient second hand rotation (completes full rotation every 60 seconds)
  const [secondAngle, setSecondAngle] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setDisplayHourAngle(targetHourAngle);
      setDisplayMinuteAngle(targetMinuteAngle);
    });
    return () => cancelAnimationFrame(id);
  }, [targetHourAngle, targetMinuteAngle]);
  
  // Ambient second hand animation
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondAngle((prev) => (prev + 6) % 360); // 6° per second
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Drive CSS custom property so App.css animations react to score ──────
  useEffect(() => {
    document.documentElement.style.setProperty('--fragility-score', String(Math.round(score)));
  }, [score]);

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

  // Clock hand geometry
  const hourHandTip = polar(CX, CY, R_NEEDLE * 0.6, displayHourAngle); // Shorter hour hand
  const hourHandBase = polar(CX, CY, 12, displayHourAngle + 180);
  
  const minuteHandTip = polar(CX, CY, R_NEEDLE, displayMinuteAngle); // Longer minute hand
  const minuteHandBase = polar(CX, CY, 12, displayMinuteAngle + 180);
  
  const secondHandTip = polar(CX, CY, R_NEEDLE * 0.85, secondAngle); // Medium second hand
  const secondHandBase = polar(CX, CY, 16, secondAngle + 180);

  return (
    <div className="doomsday-clock" data-testid="doomsday-clock" aria-label={`Doomsday clock: ${timeDisplay} to midnight, fragility ${score.toFixed(1)}, ${safeRegime} regime`}>
      {/* Layman overlay trigger */}
      <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10 }}>
        <LaymanOverlay 
          explanationGenerator={() => {
            const rows = currentModelData.featuresData.data;
            const row = findRowForDate(rows, selectedDate);
            return generateClockExplanation(row);
          }}
        />
      </div>

      {/* Breathing glow ring — speed + size driven by --fragility-score CSS var */}
      <div className="clock-glow-ring" aria-hidden="true" />
      {/* ── Clock SVG ──────────────────────────────────────────────────── */}
      <svg viewBox={`0 0 ${W} ${H}`} className="doomsday-svg" role="img">
        <defs>
          {/* Regime glow gradient */}
          <radialGradient id="regimeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={regimeColor} stopOpacity="0.12" />
            <stop offset="100%" stopColor={regimeColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* ── Hover title for literal time display ────────────────────────── */}
        <title>
          {`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${score >= 70 ? 'AM' : 'PM'}`}
        </title>

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

        {/* ── CRASH label ───────────────────────────────────────── */}
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
          x={CX} y={CY + R_OUTER + 32}
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

        {/* ── Last updated label (if live data exists) ──────────────────── */}
        {lastUpdated && (
          <text
            x={CX} y={CY - 30}
            textAnchor="middle"
            fontSize={7}
            fontFamily="var(--font-mono)"
            fill="rgba(34,197,94,0.4)"
            letterSpacing="0.08em"
          >
            LAST UPDATED: {new Date(lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase()}
          </text>
        )}

        {/* ── Raw score ─────────────────────────────────────────────────── */}
        <text
          x={CX} y={CY + 28}
          textAnchor="middle"
          fontSize={11}
          fontFamily="var(--font-mono)"
          fill={regimeColor}
          letterSpacing="0.04em"
          style={{ transition: 'fill 600ms ease' }}
        >
          {score.toFixed(1)} / 100
        </text>

        {/* ── Clock hands ────────────────────────────────────────────────── */}
        
        {/* Second hand (ambient rotation) - always dim red */}
        <g style={{ transition: 'transform 1000ms linear' }}>
          <line
            x1={secondHandBase.x} y1={secondHandBase.y}
            x2={secondHandTip.x}  y2={secondHandTip.y}
            stroke="rgba(239, 68, 68, 0.4)"
            strokeWidth={0.8}
            strokeLinecap="round"
          />
        </g>

        {/* Minute hand - colored by regime */}
        <g style={{ transition: 'transform 800ms ease' }}>
          {/* PONZI: Add glow effect */}
          {score >= 70 && (
            <line
              x1={minuteHandBase.x} y1={minuteHandBase.y}
              x2={minuteHandTip.x}  y2={minuteHandTip.y}
              stroke={regimeColor}
              strokeWidth={8}
              strokeLinecap="round"
              opacity={0.3}
              filter="blur(4px)"
            />
          )}
          {/* SPECULATIVE: Add subtle glow */}
          {score >= 40 && score < 70 && (
            <line
              x1={minuteHandBase.x} y1={minuteHandBase.y}
              x2={minuteHandTip.x}  y2={minuteHandTip.y}
              stroke={regimeColor}
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.2}
              filter="blur(2px)"
            />
          )}
          {/* Shadow */}
          <line
            x1={minuteHandBase.x + 1} y1={minuteHandBase.y + 1}
            x2={minuteHandTip.x + 1}  y2={minuteHandTip.y + 1}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={score >= 70 ? 3.5 : 3}
            strokeLinecap="round"
          />
          {/* Body */}
          <line
            x1={minuteHandBase.x} y1={minuteHandBase.y}
            x2={minuteHandTip.x}  y2={minuteHandTip.y}
            stroke={regimeColor}
            strokeWidth={score >= 70 ? 2.5 : 2}
            strokeLinecap="round"
            style={{ transition: 'stroke 600ms ease, stroke-width 600ms ease' }}
          />
        </g>

        {/* Hour hand - colored by regime */}
        <g style={{ transition: 'transform 800ms ease' }}>
          {/* PONZI: Add strong glow effect */}
          {score >= 70 && (
            <line
              x1={hourHandBase.x} y1={hourHandBase.y}
              x2={hourHandTip.x}  y2={hourHandTip.y}
              stroke={regimeColor}
              strokeWidth={10}
              strokeLinecap="round"
              opacity={0.4}
              filter="blur(6px)"
            />
          )}
          {/* SPECULATIVE: Add subtle glow */}
          {score >= 40 && score < 70 && (
            <line
              x1={hourHandBase.x} y1={hourHandBase.y}
              x2={hourHandTip.x}  y2={hourHandTip.y}
              stroke={regimeColor}
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.25}
              filter="blur(3px)"
            />
          )}
          {/* Shadow */}
          <line
            x1={hourHandBase.x + 1} y1={hourHandBase.y + 1}
            x2={hourHandTip.x + 1}  y2={hourHandTip.y + 1}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={score >= 70 ? 5 : 4}
            strokeLinecap="round"
          />
          {/* Body */}
          <line
            x1={hourHandBase.x} y1={hourHandBase.y}
            x2={hourHandTip.x}  y2={hourHandTip.y}
            stroke={regimeColor}
            strokeWidth={score >= 70 ? 4 : 3.5}
            strokeLinecap="round"
            style={{ transition: 'stroke 600ms ease, stroke-width 600ms ease' }}
          />
        </g>

        {/* ── Pivot ─────────────────────────────────────────────────────── */}
        <circle cx={CX} cy={CY} r={5} fill="#070a10" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={2.5} fill={regimeColor} style={{ transition: 'fill 600ms ease' }} />
      </svg>

      {/* ── Time display below clock ──────────────────────────────────────── */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '16px',
        fontSize: '32px',
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: '#ffffff',
        letterSpacing: '-0.02em'
      }}>
        {timeDisplay}
      </div>

      {/* ── Regime label below clock ────────────────────────────────────── */}
      <div className="doomsday-regime" style={{ color: regimeColor }}>
        {REGIME_CFG[safeRegime].label} FINANCE REGIME
      </div>

      {/* ── Historical analogue panel ─────────────────────────────────────── */}
      {showAnalogue && (
        <div className="doomsday-analogue" style={{ borderColor: regimeColor + '40' }}>
          <div className="doomsday-analogue-period">
            <span className="doomsday-analogue-label">Historically similar to</span>
            <span className="doomsday-analogue-value" style={{ color: regimeColor }}>
              {analogue.period}
            </span>
          </div>
          <p className="doomsday-analogue-event">{analogue.event}</p>
          <p className="doomsday-analogue-consequence">{analogue.consequence}</p>
        </div>
      )}
    </div>
  );
};

export default DoomsdayClock;
