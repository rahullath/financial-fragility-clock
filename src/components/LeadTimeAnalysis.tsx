import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useModelContext } from '../contexts/ModelContext';
import LaymanOverlay from './LaymanOverlay';
import type { CrisisPrediction } from '../types/extendedDataSchemas';
import './LeadTimeAnalysis.css';

/**
 * LeadTimeAnalysis Component
 * 
 * Analyzes how far in advance the model predicts crises.
 * Shows histogram of lead time distribution, box plot comparing models,
 * scatter plot of crisis date vs lead time, and summary statistics.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
const LeadTimeAnalysis: React.FC = () => {
  const { leadTimeStats } = useModelContext();

  // Process lead time data
  const {
    histogramData,
    scatterData,
    boxPlotData,
    summaryStats,
    actionableThreshold,
  } = useMemo(() => {
    if (!leadTimeStats) {
      return {
        histogramData: [],
        scatterData: [],
        boxPlotData: [],
        summaryStats: [],
        actionableThreshold: 30,
      };
    }

    const { predictions, summary, metadata } = leadTimeStats;
    const threshold = metadata.actionable_lead_time;

    // 1. Histogram data: Group predictions into bins
    const binSize = 10; // days per bin
    const maxLeadTime = Math.max(...predictions.map((p) => p.lead_time_days));
    const numBins = Math.ceil(maxLeadTime / binSize);
    
    const bins: { range: string; count: number; insufficient: number }[] = [];
    for (let i = 0; i < numBins; i++) {
      const start = i * binSize;
      const end = (i + 1) * binSize;
      const inBin = predictions.filter(
        (p) => p.lead_time_days >= start && p.lead_time_days < end
      );
      const insufficient = inBin.filter((p) => !p.was_actionable).length;
      
      bins.push({
        range: `${start}-${end}`,
        count: inBin.length,
        insufficient,
      });
    }

    // 2. Scatter data: Crisis date vs lead time
    const scatter = predictions.map((p) => ({
      crisisDate: new Date(p.crisis_date).getTime(),
      leadTime: p.lead_time_days,
      modelId: p.model_id,
      wasActionable: p.was_actionable,
      crisisDateStr: p.crisis_date,
    }));

    // 3. Box plot data: Summary stats per model
    const boxPlot = Object.entries(summary).map(([modelId, stats]) => ({
      modelId,
      mean: stats.mean_lead_time,
      median: stats.median_lead_time,
      min: stats.min_lead_time,
      max: stats.max_lead_time,
      actionablePercentage: stats.actionable_percentage,
    }));

    // 4. Summary stats for display
    const statsArray = Object.entries(summary).map(([modelId, stats]) => ({
      modelId,
      ...stats,
    }));

    return {
      histogramData: bins,
      scatterData: scatter,
      boxPlotData: boxPlot,
      summaryStats: statsArray,
      actionableThreshold: threshold,
    };
  }, [leadTimeStats]);

  // Generate layman explanation
  const generateExplanation = () => {
    if (!leadTimeStats || summaryStats.length === 0) {
      return 'No lead time data available.';
    }

    const avgLeadTime = summaryStats.reduce((sum, s) => sum + s.mean_lead_time, 0) / summaryStats.length;
    const avgActionable = summaryStats.reduce((sum, s) => sum + s.actionable_percentage, 0) / summaryStats.length;

    return `This analysis shows how far in advance our models predict financial crises. On average, models provide ${avgLeadTime.toFixed(0)} days of warning before a crisis. ${avgActionable.toFixed(0)}% of predictions give at least ${actionableThreshold} days of lead time, which is considered actionable for portfolio adjustments. The histogram shows the distribution of lead times, the scatter plot shows when predictions were made relative to actual crises, and the box plot compares model performance.`;
  };

  // Custom tooltip for histogram
  const HistogramTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{ dataKey: string; value: number; payload: { range: string; insufficient: number } }>;
  }> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;
    const total = data.count;
    const insufficient = data.insufficient;
    const actionable = total - insufficient;

    return (
      <div className="lead-time-tooltip">
        <div className="tooltip-title">{data.range} days</div>
        <div className="tooltip-entry">
          <span className="tooltip-label">Total Predictions:</span>
          <span className="tooltip-value">{total}</span>
        </div>
        <div className="tooltip-entry actionable">
          <span className="tooltip-label">Actionable:</span>
          <span className="tooltip-value">{actionable}</span>
        </div>
        <div className="tooltip-entry insufficient">
          <span className="tooltip-label">Insufficient:</span>
          <span className="tooltip-value">{insufficient}</span>
        </div>
      </div>
    );
  };

  // Custom tooltip for scatter plot
  const ScatterTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{ payload: { crisisDateStr: string; leadTime: number; modelId: string; wasActionable: boolean } }>;
  }> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;

    return (
      <div className="lead-time-tooltip">
        <div className="tooltip-title">Crisis: {data.crisisDateStr}</div>
        <div className="tooltip-entry">
          <span className="tooltip-label">Model:</span>
          <span className="tooltip-value">{data.modelId}</span>
        </div>
        <div className="tooltip-entry">
          <span className="tooltip-label">Lead Time:</span>
          <span className="tooltip-value">{data.leadTime} days</span>
        </div>
        <div className={`tooltip-entry ${data.wasActionable ? 'actionable' : 'insufficient'}`}>
          <span className="tooltip-label">Status:</span>
          <span className="tooltip-value">
            {data.wasActionable ? 'Actionable' : 'Insufficient'}
          </span>
        </div>
      </div>
    );
  };

  if (!leadTimeStats || histogramData.length === 0) {
    return (
      <div className="lead-time-analysis">
        <div className="lead-time-header">
          <span className="lead-time-title">Crisis Prediction Lead Time Analysis</span>
        </div>
        <div className="lead-time-no-data">
          No lead time analysis data available.
        </div>
      </div>
    );
  }

  return (
    <div className="lead-time-analysis" id="chart-lead-time-analysis">
      <div className="lead-time-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="lead-time-title">Crisis Prediction Lead Time Analysis</span>
          <LaymanOverlay
            explanationGenerator={generateExplanation}
            triggerLabel="?"
            triggerClassName="info-button"
          />
        </div>
        <div className="lead-time-meta">
          <span>Crisis Threshold: {leadTimeStats.metadata.crisis_threshold}</span>
          <span className="lead-time-separator">•</span>
          <span>Actionable Lead Time: {actionableThreshold} days</span>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="lead-time-summary">
        <h4>Summary Statistics by Model</h4>
        <div className="summary-grid">
          {summaryStats.map((stats) => (
            <div key={stats.modelId} className="summary-card">
              <div className="summary-model-id">{stats.modelId}</div>
              <div className="summary-stats">
                <div className="summary-stat">
                  <span className="stat-label">Mean:</span>
                  <span className="stat-value">{stats.mean_lead_time.toFixed(1)} days</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Median:</span>
                  <span className="stat-value">{stats.median_lead_time.toFixed(1)} days</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Range:</span>
                  <span className="stat-value">
                    {stats.min_lead_time}–{stats.max_lead_time} days
                  </span>
                </div>
                <div className="summary-stat actionable-stat">
                  <span className="stat-label">Actionable:</span>
                  <span className="stat-value">{stats.actionable_percentage.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Histogram: Lead Time Distribution */}
      <div className="lead-time-chart-section">
        <h4>Lead Time Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={histogramData}
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              label={{
                value: 'Lead Time (days)',
                position: 'insideBottom',
                offset: -5,
                style: { fontSize: 11 },
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              label={{
                value: 'Count',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11 },
              }}
            />
            <Tooltip content={<HistogramTooltip />} />
            <ReferenceLine
              x={`${Math.floor(actionableThreshold / 10) * 10}-${Math.ceil(actionableThreshold / 10) * 10}`}
              stroke="var(--accent)"
              strokeDasharray="3 3"
              label={{
                value: 'Actionable Threshold',
                position: 'top',
                fontSize: 10,
                fill: 'var(--accent)',
              }}
            />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Box Plot: Model Comparison */}
      <div className="lead-time-chart-section">
        <h4>Model Comparison (Box Plot)</h4>
        <div className="box-plot-container">
          {boxPlotData.map((model) => (
            <div key={model.modelId} className="box-plot-item">
              <div className="box-plot-label">{model.modelId}</div>
              <div className="box-plot-visual">
                <div className="box-plot-line" style={{ left: '0%', width: '100%' }}>
                  <span className="box-plot-whisker" style={{ left: `${(model.min / model.max) * 100}%` }} />
                  <div
                    className="box-plot-box"
                    style={{
                      left: `${(model.min / model.max) * 100}%`,
                      width: `${((model.max - model.min) / model.max) * 100}%`,
                    }}
                  >
                    <div
                      className="box-plot-median"
                      style={{
                        left: `${((model.median - model.min) / (model.max - model.min)) * 100}%`,
                      }}
                    />
                    <div
                      className="box-plot-mean"
                      style={{
                        left: `${((model.mean - model.min) / (model.max - model.min)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="box-plot-whisker" style={{ left: '100%' }} />
                </div>
                <div className="box-plot-scale">
                  <span>{model.min}d</span>
                  <span>{model.median.toFixed(0)}d</span>
                  <span>{model.max}d</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scatter Plot: Crisis Date vs Lead Time */}
      <div className="lead-time-chart-section">
        <h4>Crisis Date vs Lead Time</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="crisisDate"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(timestamp) => {
                const date = new Date(timestamp);
                return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
              }}
              label={{
                value: 'Crisis Date',
                position: 'insideBottom',
                offset: -5,
                style: { fontSize: 11 },
              }}
            />
            <YAxis
              dataKey="leadTime"
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              label={{
                value: 'Lead Time (days)',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11 },
              }}
            />
            <Tooltip content={<ScatterTooltip />} />
            <ReferenceLine
              y={actionableThreshold}
              stroke="var(--accent)"
              strokeDasharray="3 3"
              label={{
                value: 'Actionable Threshold',
                position: 'right',
                fontSize: 10,
                fill: 'var(--accent)',
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              formatter={(value) => (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{value}</span>
              )}
            />
            <Scatter name="Actionable" data={scatterData.filter((d) => d.wasActionable)}>
              {scatterData
                .filter((d) => d.wasActionable)
                .map((entry, index) => (
                  <Cell key={`cell-actionable-${index}`} fill="var(--safe)" />
                ))}
            </Scatter>
            <Scatter name="Insufficient" data={scatterData.filter((d) => !d.wasActionable)}>
              {scatterData
                .filter((d) => !d.wasActionable)
                .map((entry, index) => (
                  <Cell key={`cell-insufficient-${index}`} fill="var(--ponzi)" />
                ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LeadTimeAnalysis;
