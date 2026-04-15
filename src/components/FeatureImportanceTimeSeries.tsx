import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useModelContext } from '../contexts/ModelContext';
import LaymanOverlay from './LaymanOverlay';
import './FeatureImportanceTimeSeries.css';

interface FeatureImportanceDataPoint {
  date: string;
  [featureName: string]: number | string;
}

interface FeatureImportanceTimeSeriesProps {
  topN?: number; // Show top N features (default: 10)
  dateRange?: [string, string]; // Optional date range filter
}

// Color palette for features
const FEATURE_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
];

/**
 * FeatureImportanceTimeSeries Component
 * 
 * Visualizes how SHAP feature importance evolves over time.
 * Shows top N features as line series with interactive legend.
 * Highlights features with significant importance changes.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
const FeatureImportanceTimeSeries: React.FC<FeatureImportanceTimeSeriesProps> = ({
  topN = 10,
  dateRange,
}) => {
  const { currentModelData } = useModelContext();
  const [hiddenFeatures, setHiddenFeatures] = useState<Set<string>>(new Set());

  const LAYMAN_EXPLANATION = "This chart shows how the importance of different factors changes over time. Each line represents a financial indicator. When a line goes up, that factor is becoming more important in predicting market fragility. Watch for sudden spikes - they indicate a factor that's suddenly driving risk.";

  // Extract SHAP values over time from model outputs
  const { timeSeriesData, topFeatures, significantChanges, isStatic } = useMemo(() => {
    // Primary: read from feature_importance_timeseries field in model outputs
    const timeseriesRaw = currentModelData.outputsData.feature_importance_timeseries as
      | Array<{ timestamp: string; feature_importance: Record<string, number> }>
      | undefined;

    // ── Time-series path ────────────────────────────────────────────────────
    if (timeseriesRaw && timeseriesRaw.length > 0) {
      const expectedFeatures = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];

      const featureAvgs: Record<string, number> = {};
      expectedFeatures.forEach(feature => {
        const values = timeseriesRaw
          .map(point => point.feature_importance[feature] || 0)
          .filter(v => !isNaN(v));
        featureAvgs[feature] = values.reduce((sum, v) => sum + v, 0) / values.length;
      });

      const sortedFeatures = Object.entries(featureAvgs)
        .sort(([, a], [, b]) => b - a)
        .slice(0, topN)
        .map(([name]) => name)
        .filter(f => expectedFeatures.includes(f));

      let filteredData = timeseriesRaw;
      if (dateRange) {
        const [startDate, endDate] = dateRange;
        const startTime = new Date(startDate).getTime();
        const endTime   = new Date(endDate).getTime();
        filteredData = timeseriesRaw.filter(point => {
          const t = new Date(point.timestamp).getTime();
          return t >= startTime && t <= endTime;
        });
      }

      const tsData: FeatureImportanceDataPoint[] = filteredData.map(point => {
        const dp: FeatureImportanceDataPoint = { date: point.timestamp };
        sortedFeatures.forEach(f => { dp[f] = point.feature_importance[f] || 0; });
        return dp;
      });

      const changes = new Set<string>();
      sortedFeatures.forEach(feature => {
        const values = tsData.map(d => Number(d[feature]));
        if (values.length < 2) return;
        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);
        const avgVal = values.reduce((s, v) => s + v, 0) / values.length;
        if (maxVal - minVal > avgVal * 0.5) changes.add(feature);
      });

      return { timeSeriesData: tsData, topFeatures: sortedFeatures, significantChanges: changes, isStatic: false };
    }

    // ── Static fallback: random_forest.feature_importance ──────────────────
    // Used when the classification pipeline produces a single importance dict
    // rather than a time-series.
    const rf = currentModelData.outputsData['random_forest'] as
      | { feature_importance?: Record<string, number> }
      | undefined;
    const staticImportance = rf?.feature_importance;

    if (staticImportance && Object.keys(staticImportance).length > 0) {
      const sorted = Object.entries(staticImportance)
        .sort(([, a], [, b]) => b - a)
        .slice(0, topN);

      const features  = sorted.map(([f]) => f);
      const staticRow: FeatureImportanceDataPoint = { date: 'Model Average' };
      sorted.forEach(([f, v]) => { staticRow[f] = v; });

      return {
        timeSeriesData:    [staticRow],
        topFeatures:       features,
        significantChanges: new Set<string>(),
        isStatic: true,
      };
    }

    return { timeSeriesData: [], topFeatures: [], significantChanges: new Set<string>(), isStatic: false };
  }, [currentModelData.outputsData, topN, dateRange]);

  // Toggle feature visibility
  const handleLegendClick = (dataKey: string) => {
    setHiddenFeatures(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  // Custom tooltip
  const CustomTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{ dataKey: string; value: number; color: string }>;
    label?: string;
  }> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="feature-importance-tooltip">
        <div className="tooltip-date">{label}</div>
        {payload
          .sort((a, b) => b.value - a.value)
          .map((entry, index) => (
            <div key={index} className="tooltip-entry">
              <span className="tooltip-color" style={{ backgroundColor: entry.color }} />
              <span className="tooltip-feature">{entry.dataKey}:</span>
              <span className="tooltip-value">{entry.value.toFixed(4)}</span>
              {significantChanges.has(entry.dataKey) && (
                <span className="tooltip-badge">!</span>
              )}
            </div>
          ))}
      </div>
    );
  };

  if (timeSeriesData.length === 0) {
    return (
      <div className="feature-importance-empty">
        <p>No feature importance data available for the selected date range.</p>
      </div>
    );
  }

  return (
    <div className="feature-importance-timeseries" id="chart-feature-importance">
      <div className="feature-importance-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="feature-importance-title">
            {isStatic ? 'Feature Importance (Gini)' : 'Feature Importance Over Time'}
          </span>
          <LaymanOverlay 
            explanationGenerator={() => LAYMAN_EXPLANATION}
            triggerLabel="?"
            triggerClassName="info-button"
          />
        </div>
        <div className="feature-importance-meta">
          <span>Top {topN} features</span>
          {isStatic && (
            <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: 8 }}>
              Gini importance from Random Forest Classifier
            </span>
          )}
          {!isStatic && dateRange && (
            <span className="date-range">
              {dateRange[0]} to {dateRange[1]}
            </span>
          )}
        </div>
      </div>

      {isStatic ? (
        // Static bar chart for classification pipeline (single importance snapshot)
        <ResponsiveContainer width="100%" height={Math.max(200, topFeatures.length * 32 + 40)}>
          <BarChart
            data={topFeatures.map(f => ({ feature: f, value: Number(timeSeriesData[0]?.[f] ?? 0) }))}
            layout="vertical"
            margin={{ top: 4, right: 40, bottom: 4, left: 110 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false} tickLine={false}
              tickFormatter={(v: number) => v.toFixed(3)}
            />
            <YAxis
              type="category"
              dataKey="feature"
              width={105}
              tick={{ fontSize: 11, fill: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
              axisLine={false} tickLine={false}
            />
            <Tooltip formatter={(v: number) => v.toFixed(4)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={400}>
              {topFeatures.map((_, i) => (
                <Cell key={i} fill={FEATURE_COLORS[i % FEATURE_COLORS.length]} fillOpacity={1 - i * 0.04} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        // Time-series line chart
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={timeSeriesData}
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              tickFormatter={(date) => {
                const d = new Date(date);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false} tickLine={false}
              label={{ value: 'Importance', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              onClick={(e) => handleLegendClick(e.dataKey as string)}
              wrapperStyle={{ cursor: 'pointer', fontSize: '11px' }}
              formatter={(value: string) => (
                <span style={{ opacity: hiddenFeatures.has(value) ? 0.5 : 1 }}>
                  {value}
                  {significantChanges.has(value) && (
                    <span className="legend-badge" title="Significant change">!</span>
                  )}
                </span>
              )}
            />
            {topFeatures.map((feature, index) => (
              <Line
                key={feature}
                type="monotone"
                dataKey={feature}
                stroke={FEATURE_COLORS[index % FEATURE_COLORS.length]}
                strokeWidth={significantChanges.has(feature) ? 2.5 : 1.5}
                dot={false}
                hide={hiddenFeatures.has(feature)}
                isAnimationActive={true}
                animationDuration={300}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {significantChanges.size > 0 && (
        <div className="feature-importance-note">
          <strong>!</strong> Features with significant changes: {Array.from(significantChanges).join(', ')}
        </div>
      )}
    </div>
  );
};

export default FeatureImportanceTimeSeries;
