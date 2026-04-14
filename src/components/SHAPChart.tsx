import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { useModelContext } from '../contexts/ModelContext';
import { exportChart } from '../utils/exportChart';
import LaymanOverlay from './LaymanOverlay';
import './SHAPChart.css';

type Regime = 'HEDGE' | 'SPECULATIVE' | 'PONZI';

const REGIME_COLORS: Record<Regime, string> = {
  HEDGE: '#22c55e',
  SPECULATIVE: '#f59e0b',
  PONZI: '#ef4444',
};

interface ShapRow {
  feature: string;
  value: number;
}

function extractShapData(
  outputsData: Record<string, unknown>,
  regime: Regime
): ShapRow[] {
  const shap = outputsData['shap'] as Record<string, unknown> | undefined;
  if (!shap) return [];

  // Model A: shap.mean_abs_shap + shap.regime_shap
  if (shap['mean_abs_shap']) {
    const source =
      regime === 'HEDGE' || regime === 'SPECULATIVE' || regime === 'PONZI'
        ? ((shap['regime_shap'] as Record<string, Record<string, number>>)?.[
            regime
          ] ?? (shap['mean_abs_shap'] as Record<string, number>))
        : (shap['mean_abs_shap'] as Record<string, number>);

    return Object.entries(source)
      .map(([feature, value]) => ({ feature, value: Math.abs(value as number) }))
      .sort((a, b) => b.value - a.value);
  }

  // Model B: shap.regime_comparison - extract from nested mean_abs_shap object
  const regimeComp = shap['regime_comparison'] as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (regimeComp?.[regime]) {
    const regimeData = regimeComp[regime];

    // Extract features from nested mean_abs_shap object
    const meanAbsShap = regimeData['mean_abs_shap'] as Record<string, number> | undefined;
    if (!meanAbsShap) return [];

    // Expected features from assignment (SP500 may be named 'SP' in data)
    const expectedFeatures = ['SP500', 'SP', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];

    return Object.entries(meanAbsShap)
      .filter(([feature]) => expectedFeatures.includes(feature))
      .map(([feature, value]) => ({ feature, value: Math.abs(value as number) }))
      .sort((a, b) => b.value - a.value);
  }

  return [];
}

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number; payload: ShapRow }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { feature, value } = payload[0].payload;
  return (
    <div className="shap-tooltip">
      <div className="shap-tt-feature">{feature}</div>
      <div className="shap-tt-val">|SHAP| = {value.toFixed(6)}</div>
    </div>
  );
};

/**
 * SHAPChart
 *
 * Horizontal bar chart showing mean absolute SHAP feature importances.
 * Regime toggle switches between HEDGE / SPECULATIVE / PONZI breakdowns.
 * Auto-generated caption states dominant feature and its share.
 *
 * Requirements: 16.1–16.6, 36.2
 */
const SHAPChart: React.FC = () => {
  const { currentModelData } = useModelContext();
  const [regime, setRegime] = useState<Regime>('SPECULATIVE');
  const [showLayman, setShowLayman] = useState(false);

  const LAYMAN_EXPLANATION = "This chart shows which factors are pushing the fragility score up or down. Red bars push toward crisis, blue bars push toward safety. The longer the bar, the stronger the effect. This helps us understand what's driving today's risk level.";

  const data = useMemo(
    () => extractShapData(currentModelData.outputsData, regime),
    [currentModelData.outputsData, regime]
  );

  // Calculate regime percentage from regime_comparison/regime_shap or features data
  const regimePercentage = useMemo(() => {
    // First, try to get regime distribution from shap.regime_comparison (Model B) or shap.regime_shap (Model A)
    const shap = currentModelData.outputsData['shap'] as Record<string, unknown> | undefined;
    const regimeComp = (shap?.['regime_comparison'] || shap?.['regime_shap']) as Record<string, Record<string, unknown>> | undefined;
    
    if (regimeComp) {
      // Extract n_observations for each regime
      const regimeCounts: Record<string, number> = {};
      let totalObservations = 0;
      
      for (const [regimeName, regimeData] of Object.entries(regimeComp)) {
        // Handle both 'n_observations' (Model A) and 'observations' (Model B)
        const nObs = ((regimeData['n_observations'] || regimeData['observations']) as number) || 0;
        regimeCounts[regimeName] = nObs;
        totalObservations += nObs;
      }
      
      if (totalObservations > 0) {
        const regimeCount = regimeCounts[regime] || 0;
        return ((regimeCount / totalObservations) * 100).toFixed(1);
      }
    }
    
    // Fallback: calculate from non-null regime labels in features data
    const rows = currentModelData.featuresData.data;
    const rowsWithRegime = rows.filter(row => row.regime != null);
    const totalRows = rowsWithRegime.length;
    
    if (totalRows === 0) return '0.0';
    
    const regimeRows = rowsWithRegime.filter(row => row.regime === regime).length;
    return ((regimeRows / totalRows) * 100).toFixed(1);
  }, [currentModelData.outputsData, currentModelData.featuresData.data, regime]);

  // Auto-generated caption
  const caption = useMemo(() => {
    if (!data.length) return null;
    const top = data[0];
    const total = data.reduce((s, r) => s + r.value, 0);
    const pct = total > 0 ? ((top.value / total) * 100).toFixed(1) : '?';
    return `In the ${regime} regime (${regimePercentage}% observations), ${top.feature} is the dominant driver (${pct}% of total |SHAP|).`;
  }, [data, regime, regimePercentage]);

  return (
    <div className="shap-chart" data-testid="shap-chart" id="chart-shap" aria-label="SHAP feature importance chart">
      <div className="shap-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="shap-title">SHAP Feature Importance</span>
          <button 
            onClick={() => setShowLayman(true)}
            style={{ fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer' }}
            aria-label="?"
          >
            ?
          </button>
          <button 
            onClick={() => exportChart('chart-shap', 'shap_importance')}
            style={{ fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer' }}
          >
            Export PNG
          </button>
        </div>
        <div className="shap-regime-toggle" role="group" aria-label="Regime filter">
          {(['HEDGE', 'SPECULATIVE', 'PONZI'] as Regime[]).map((r) => (
            <button
              key={r}
              className={`shap-regime-btn ${regime === r ? 'active' : ''}`}
              style={regime === r ? { background: REGIME_COLORS[r], borderColor: REGIME_COLORS[r] } : {}}
              onClick={() => setRegime(r)}
              aria-pressed={regime === r}
            >
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="shap-empty">No SHAP data for this regime.</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 26 + 20)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 90 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v.toFixed(4)}
            />
            <YAxis
              type="category"
              dataKey="feature"
              width={85}
              tick={{ fontSize: 10, fill: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={300}>
              {data.map((_, i) => (
                <Cell key={i} fill={REGIME_COLORS[regime]} fillOpacity={1 - i * 0.06} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {caption && <p className="shap-caption">{caption}</p>}

      <LaymanOverlay 
        isVisible={showLayman} 
        explanation={LAYMAN_EXPLANATION}
        onClose={() => setShowLayman(false)}
      />
    </div>
  );
};

export default SHAPChart;
