import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
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
  const { timeSeriesData, topFeatures, significantChanges } = useMemo(() => {
    // Read from feature_importance_timeseries field in model outputs
    const timeseriesData = currentModelData.outputsData.feature_importance_timeseries;
    
    if (!timeseriesData || timeseriesData.length === 0) {
      return { timeSeriesData: [], topFeatures: [], significantChanges: new Set<string>() };
    }

    // Expected 7 input features
    const expectedFeatures = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];
    
    // Calculate average importance for each feature across all time points
    const featureAvgs: Record<string, number> = {};
    expectedFeatures.forEach(feature => {
      const values = timeseriesData
        .map(point => point.feature_importance[feature] || 0)
        .filter(v => !isNaN(v));
      featureAvgs[feature] = values.reduce((sum, v) => sum + v, 0) / values.length;
    });

    // Get top N features by average importance
    const sortedFeatures = Object.entries(featureAvgs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([name]) => name);

    // Filter out any features not in the expected 7 (remove made-up variables like "regime_confidence")
    const validFeatures = sortedFeatures.filter(f => expectedFeatures.includes(f));

    // Build time series data
    let filteredData = timeseriesData;
    
    // Apply date range filter if provided
    if (dateRange) {
      const [startDate, endDate] = dateRange;
      const startTime = new Date(startDate).getTime();
      const endTime = new Date(endDate).getTime();
      
      filteredData = timeseriesData.filter(point => {
        const pointTime = new Date(point.timestamp).getTime();
        return pointTime >= startTime && pointTime <= endTime;
      });
    }

    const tsData: FeatureImportanceDataPoint[] = filteredData.map(point => {
      const dataPoint: FeatureImportanceDataPoint = { date: point.timestamp };
      validFeatures.forEach(feature => {
        dataPoint[feature] = point.feature_importance[feature] || 0;
      });
      return dataPoint;
    });

    // Detect significant changes (features with >50% change in importance)
    const changes = new Set<string>();
    validFeatures.forEach(feature => {
      const values = tsData.map(d => Number(d[feature]));
      if (values.length < 2) return;
      
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      const range = maxVal - minVal;
      const avgVal = values.reduce((sum, v) => sum + v, 0) / values.length;
      
      // If range is more than 50% of average, mark as significant
      if (range > avgVal * 0.5) {
        changes.add(feature);
      }
    });

    return {
      timeSeriesData: tsData,
      topFeatures: validFeatures,
      significantChanges: changes,
    };
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
          <span className="feature-importance-title">Feature Importance Over Time</span>
          <LaymanOverlay 
            explanationGenerator={() => LAYMAN_EXPLANATION}
            triggerLabel="?"
            triggerClassName="info-button"
          />
        </div>
        <div className="feature-importance-meta">
          <span>Top {topN} features</span>
          {dateRange && (
            <span className="date-range">
              {dateRange[0]} to {dateRange[1]}
            </span>
          )}
        </div>
      </div>

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
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
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

      {significantChanges.size > 0 && (
        <div className="feature-importance-note">
          <strong>!</strong> Features with significant changes: {Array.from(significantChanges).join(', ')}
        </div>
      )}
    </div>
  );
};

export default FeatureImportanceTimeSeries;
