import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { toNum } from '../utils/dataUtils';
import './RegimeStatsCard.css';

type Regime = 'HEDGE' | 'SPECULATIVE' | 'PONZI';

const REGIME_CONFIG: Record<Regime, { color: string; label: string }> = {
  HEDGE: { color: '#2d6a4f', label: 'Hedge' },
  SPECULATIVE: { color: '#e9a800', label: 'Speculative' },
  PONZI: { color: '#c1121f', label: 'Ponzi' },
};

interface RegimeStats {
  count: number;
  meanReturn: number | null;
  volatility: number | null;
  meanFragility: number | null;
  sparkData: Array<{ v: number }>;
}

function computeStats(rows: DataRow[], regime: Regime): RegimeStats {
  const filtered = rows.filter((r) => r.regime === regime);
  if (!filtered.length) {
    return { count: 0, meanReturn: null, volatility: null, meanFragility: null, sparkData: [] };
  }

  // Mean ISE return (look for ISE_USD or first numeric column)
  const returnKey = filtered[0]['ISE_USD'] !== undefined ? 'ISE_USD' :
    Object.keys(filtered[0]).find((k) => k !== 'date' && k !== 'regime' && typeof filtered[0][k] === 'number' && !k.includes('corr') && !k.includes('fragility')) ?? null;

  const returns = returnKey
    ? filtered.map((r) => (r[returnKey] as number | null) ?? NaN).filter((v) => !isNaN(v))
    : [];

  const meanReturn = returns.length
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : null;

  // Volatility (std of returns)
  const volatility =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((s, v) => s + (v - (meanReturn ?? 0)) ** 2, 0) /
            (returns.length - 1)
        )
      : null;

  // Mean fragility score
  const fScores = filtered
    .map((r) => toNum(r.fragility_score))
    .filter((v): v is number => v != null);
  const meanFragility = fScores.length
    ? fScores.reduce((a, b) => a + b, 0) / fScores.length
    : null;

  // Sparkline: fragility scores for this regime
  const sparkData = fScores.slice(-40).map((v) => ({ v }));

  return { count: filtered.length, meanReturn, volatility, meanFragility, sparkData };
}

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return (v * 100).toFixed(2) + '%';
}

function fmtNum(v: number | null, d = 2): string {
  return v != null ? v.toFixed(d) : '—';
}

/**
 * RegimeStatsCard
 *
 * 3-column grid showing per-regime statistics: day count, mean return,
 * volatility, mean fragility score, and a sparkline.
 *
 * Requirements: 19.1–19.5, 36.2
 */
const RegimeStatsCard: React.FC = () => {
  const { currentModelData } = useModelContext();

  const stats = useMemo(() => {
    const rows = currentModelData.featuresData.data;
    return {
      HEDGE: computeStats(rows, 'HEDGE'),
      SPECULATIVE: computeStats(rows, 'SPECULATIVE'),
      PONZI: computeStats(rows, 'PONZI'),
    };
  }, [currentModelData]);

  return (
    <div className="regime-stats" data-testid="regime-stats-card" aria-label="Regime statistics">
      <div className="rs-title">Regime Statistics</div>
      <div className="rs-grid">
        {(['HEDGE', 'SPECULATIVE', 'PONZI'] as Regime[]).map((regime) => {
          const { color, label } = REGIME_CONFIG[regime];
          const s = stats[regime];
          return (
            <div
              key={regime}
              className="rs-card"
              style={{ borderTopColor: color }}
            >
              <div className="rs-regime-label" style={{ color }}>
                {label}
              </div>

              <div className="rs-stat-row">
                <span className="rs-stat-key">Days</span>
                <span className="rs-stat-val">{s.count.toLocaleString()}</span>
              </div>
              <div className="rs-stat-row">
                <span className="rs-stat-key">Mean Return</span>
                <span
                  className="rs-stat-val"
                  style={{
                    color:
                      s.meanReturn == null
                        ? undefined
                        : s.meanReturn >= 0
                        ? 'var(--hedge)'
                        : 'var(--ponzi)',
                  }}
                >
                  {fmtPct(s.meanReturn)}
                </span>
              </div>
              <div className="rs-stat-row">
                <span className="rs-stat-key">Volatility</span>
                <span className="rs-stat-val">{fmtPct(s.volatility)}</span>
              </div>
              <div className="rs-stat-row">
                <span className="rs-stat-key">Avg Fragility</span>
                <span className="rs-stat-val">{fmtNum(s.meanFragility, 1)}</span>
              </div>

              {/* Sparkline */}
              {s.sparkData.length > 1 && (
                <div className="rs-sparkline">
                  <ResponsiveContainer width="100%" height={40}>
                    <AreaChart
                      data={s.sparkData}
                      margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
                    >
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.2}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegimeStatsCard;
