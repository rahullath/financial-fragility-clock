import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { useModelContext } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import LaymanOverlay from './LaymanOverlay';
import type { VolatilityCluster } from '../types/extendedDataSchemas';
import './VolatilityClusteringChart.css';

/**
 * VolatilityClusteringChart Component
 * 
 * Visualizes volatility over time with identified clusters highlighted.
 * Shows shaded regions for clusters with color intensity representing strength.
 * Displays comparison line for historical average.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
const VolatilityClusteringChart: React.FC = () => {
  const { volatilityClusters } = useModelContext();
  const { selectedDate } = useDateContext();

  // Process volatility data
  const { chartData, historicalAverage, currentVolatility, activeClusters } = useMemo(() => {
    if (!volatilityClusters) {
      return {
        chartData: [],
        historicalAverage: 0,
        currentVolatility: 0,
        activeClusters: [],
      };
    }

    const { time_series, clusters } = volatilityClusters;

    // Calculate historical average
    const avgVolatility =
      time_series.reduce((sum, point) => sum + point.volatility, 0) / time_series.length;

    // Find current volatility
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const currentPoint = time_series.find((p) => p.date === selectedDateStr);
    const currentVol = currentPoint?.volatility || 0;

    // Find active clusters (clusters containing the selected date)
    const selectedTime = selectedDate.getTime();
    const active = clusters.filter((cluster) => {
      const startTime = new Date(cluster.start_date).getTime();
      const endTime = new Date(cluster.end_date).getTime();
      return selectedTime >= startTime && selectedTime <= endTime;
    });

    // Prepare chart data with historical average
    const data = time_series.map((point) => ({
      date: point.date,
      volatility: point.volatility,
      average: avgVolatility,
    }));

    return {
      chartData: data,
      historicalAverage: avgVolatility,
      currentVolatility: currentVol,
      activeClusters: active,
    };
  }, [volatilityClusters, selectedDate]);

  // Generate layman explanation
  const generateExplanation = () => {
    const comparison =
      currentVolatility > historicalAverage
        ? `${((currentVolatility / historicalAverage - 1) * 100).toFixed(0)}% above`
        : `${((1 - currentVolatility / historicalAverage) * 100).toFixed(0)}% below`;

    const clusterInfo =
      activeClusters.length > 0
        ? ` You're currently in a high-volatility cluster that started on ${activeClusters[0].start_date} and has lasted ${activeClusters[0].duration_days} days with intensity ${(activeClusters[0].intensity * 100).toFixed(1)}%.`
        : ' No active volatility cluster at this date.';

    return `This chart shows market volatility over time. Current volatility is ${(currentVolatility * 100).toFixed(1)}%, which is ${comparison} the historical average of ${(historicalAverage * 100).toFixed(1)}%.${clusterInfo} Shaded regions indicate periods of sustained high volatility (clusters). The darker the shading, the more intense the volatility cluster.`;
  };

  // Custom tooltip
  const CustomTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{ dataKey: string; value: number; color: string }>;
    label?: string;
  }> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    const volatility = payload.find((p) => p.dataKey === 'volatility')?.value || 0;
    const average = payload.find((p) => p.dataKey === 'average')?.value || 0;

    // Check if this date is in a cluster
    const dateTime = new Date(label).getTime();
    const cluster = volatilityClusters?.clusters.find((c) => {
      const startTime = new Date(c.start_date).getTime();
      const endTime = new Date(c.end_date).getTime();
      return dateTime >= startTime && dateTime <= endTime;
    });

    return (
      <div className="volatility-tooltip">
        <div className="tooltip-date">{label}</div>
        <div className="tooltip-entry">
          <span className="tooltip-label">Volatility:</span>
          <span className="tooltip-value">{(volatility * 100).toFixed(2)}%</span>
        </div>
        <div className="tooltip-entry">
          <span className="tooltip-label">Historical Avg:</span>
          <span className="tooltip-value">{(average * 100).toFixed(2)}%</span>
        </div>
        {cluster && (
          <div className="tooltip-cluster-info">
            <div className="tooltip-cluster-badge">Cluster #{cluster.id}</div>
            <div className="tooltip-entry">
              <span className="tooltip-label">Duration:</span>
              <span className="tooltip-value">{cluster.duration_days} days</span>
            </div>
            <div className="tooltip-entry">
              <span className="tooltip-label">Intensity:</span>
              <span className="tooltip-value">{(cluster.intensity * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!volatilityClusters || chartData.length === 0) {
    return (
      <div className="volatility-clustering-chart">
        <div className="volatility-header">
          <span className="volatility-title">Volatility Clustering</span>
        </div>
        <div className="volatility-no-data">
          No volatility clustering data available.
        </div>
      </div>
    );
  }

  const clusters = volatilityClusters.clusters;

  return (
    <div className="volatility-clustering-chart" data-testid="volatility-clustering-chart" id="chart-volatility-clustering">
      <div className="volatility-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="volatility-title">Volatility Clustering</span>
          <LaymanOverlay
            explanationGenerator={generateExplanation}
            triggerLabel="?"
            triggerClassName="info-button"
          />
        </div>
        <div className="volatility-meta">
          <span>Algorithm: {volatilityClusters.metadata.clustering_algorithm}</span>
          <span className="volatility-separator">•</span>
          <span>Min Duration: {volatilityClusters.metadata.min_cluster_duration} days</span>
        </div>
      </div>

      <div className="volatility-stats">
        <div className="volatility-stat">
          <span className="stat-label">Current Volatility</span>
          <span className="stat-value">{(currentVolatility * 100).toFixed(2)}%</span>
        </div>
        <div className="volatility-stat">
          <span className="stat-label">Historical Average</span>
          <span className="stat-value">{(historicalAverage * 100).toFixed(2)}%</span>
        </div>
        <div className="volatility-stat">
          <span className="stat-label">Total Clusters</span>
          <span className="stat-value">{clusters.length}</span>
        </div>
        {activeClusters.length > 0 && (
          <div className="volatility-stat active-cluster">
            <span className="stat-label">Active Cluster</span>
            <span className="stat-value">
              #{activeClusters[0].id} ({activeClusters[0].duration_days}d)
            </span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          
          {/* Render cluster shaded regions */}
          {clusters.map((cluster) => {
            // Calculate opacity based on intensity (0.2 to 0.5)
            const opacity = 0.2 + (cluster.intensity * 0.3);
            
            return (
              <ReferenceArea
                key={cluster.id}
                x1={cluster.start_date}
                x2={cluster.end_date}
                fill="var(--ponzi)"
                fillOpacity={opacity}
                strokeOpacity={0}
                label={{
                  value: `#${cluster.id}`,
                  position: 'top',
                  fontSize: 10,
                  fill: 'var(--text-muted)',
                }}
              />
            );
          })}

          {/* Current date indicator */}
          <ReferenceLine
            x={selectedDate.toISOString().split('T')[0]}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            tickFormatter={(date) => {
              const d = new Date(date);
              return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            label={{
              value: 'Volatility',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11 },
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Historical average line */}
          <Line
            type="monotone"
            dataKey="average"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="Historical Average"
            isAnimationActive={false}
          />

          {/* Volatility line */}
          <Line
            type="monotone"
            dataKey="volatility"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            name="Volatility"
            isAnimationActive={true}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>

      {clusters.length > 0 && (
        <div className="volatility-clusters-list">
          <h4>Identified Clusters</h4>
          <div className="clusters-grid">
            {clusters.slice(0, 6).map((cluster) => (
              <div
                key={cluster.id}
                className={`cluster-card ${
                  activeClusters.some((c) => c.id === cluster.id) ? 'active' : ''
                }`}
              >
                <div className="cluster-id">Cluster #{cluster.id}</div>
                <div className="cluster-detail">
                  <span className="cluster-label">Period:</span>
                  <span className="cluster-value">
                    {cluster.start_date} to {cluster.end_date}
                  </span>
                </div>
                <div className="cluster-detail">
                  <span className="cluster-label">Duration:</span>
                  <span className="cluster-value">{cluster.duration_days} days</span>
                </div>
                <div className="cluster-detail">
                  <span className="cluster-label">Intensity:</span>
                  <span className="cluster-value">{(cluster.intensity * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
          {clusters.length > 6 && (
            <div className="clusters-more">
              +{clusters.length - 6} more clusters
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VolatilityClusteringChart;
