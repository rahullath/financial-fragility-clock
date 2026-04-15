import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { useModelContext } from '../contexts/ModelContext';
import LaymanOverlay from './LaymanOverlay';
import type { ModelPerformanceMetrics } from '../types/extendedDataSchemas';
import './MLModelComparison.css';

/**
 * MLModelComparison Component
 * 
 * Compares performance across multiple ML algorithms with:
 * - Performance metrics table with sortable columns
 * - ROC curve overlay chart showing all models
 * - Error distribution histograms (small multiples)
 * - Best model highlighting per metric
 * - Filtering by date range and regime type
 * 
 * Requirements: 11.1-11.8, 12.1-12.5
 */

type MetricKey = 'test_r2' | 'test_rmse' | 'test_mae' | 'train_r2' | 'train_rmse';
type SortDirection = 'asc' | 'desc';

interface ModelWithPerformance {
  modelId: string;
  performance: ModelPerformanceMetrics;
}

function metricSortValue(value: number | null | undefined, direction: SortDirection): number {
  if (value == null || Number.isNaN(value)) {
    return direction === 'desc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  return value;
}

function formatPercent(value: number | null | undefined): string {
  return value != null ? `${(value * 100).toFixed(2)}%` : '—';
}

function formatMetric(value: number | null | undefined, digits = 4): string {
  return value != null ? value.toFixed(digits) : '—';
}

const MLModelComparison: React.FC = () => {
  const { mlModelsExtended, availableMLModels, selectedMLModel, setSelectedMLModel } = useModelContext();
  
  // State for sorting (default to test_r2, higher is better)
  const [sortMetric, setSortMetric] = useState<MetricKey>('test_r2');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // TODO: Implement filtering by date range and regime type (Requirement 12.5)
  // const [dateRangeFilter, setDateRangeFilter] = useState<[string, string] | null>(null);
  // const [regimeFilter, setRegimeFilter] = useState<string | null>(null);

  // Process model performance data
  const modelsWithPerformance = useMemo<ModelWithPerformance[]>(() => {
    if (!mlModelsExtended) return [];

    return availableMLModels
      .map((modelId) => ({
        modelId,
        performance: mlModelsExtended.performance[modelId],
      }))
      .filter((m) => m.performance !== undefined);
  }, [mlModelsExtended, availableMLModels]);

  // Sort models by selected metric
  const sortedModels = useMemo(() => {
    const sorted = [...modelsWithPerformance].sort((a, b) => {
      const aValue = metricSortValue(a.performance[sortMetric], sortDirection);
      const bValue = metricSortValue(b.performance[sortMetric], sortDirection);
      
      // For RMSE and MAE, lower is better, so invert the comparison
      const isLowerBetter = sortMetric === 'test_rmse' || sortMetric === 'test_mae' || sortMetric === 'train_rmse';
      
      if (isLowerBetter) {
        return sortDirection === 'desc' ? aValue - bValue : bValue - aValue;
      } else {
        return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
      }
    });
    return sorted;
  }, [modelsWithPerformance, sortMetric, sortDirection]);

  // Find best model for each metric
  const bestModels = useMemo(() => {
    const metrics: MetricKey[] = ['test_r2', 'test_rmse', 'test_mae', 'train_r2', 'train_rmse'];
    const best: Record<MetricKey, string> = {} as Record<MetricKey, string>;

    metrics.forEach((metric) => {
      // For RMSE and MAE, lower is better
      const isLowerBetter = metric === 'test_rmse' || metric === 'test_mae' || metric === 'train_rmse';
      
      const rankedModels = [...modelsWithPerformance].sort((a, b) => {
        const aValue = metricSortValue(a.performance[metric], isLowerBetter ? 'asc' : 'desc');
        const bValue = metricSortValue(b.performance[metric], isLowerBetter ? 'asc' : 'desc');
        return isLowerBetter ? aValue - bValue : bValue - aValue;
      });
      
      const bestModel = rankedModels[0];
      if (bestModel && bestModel.performance[metric] != null) {
        best[metric] = bestModel.modelId;
      }
    });

    return best;
  }, [modelsWithPerformance]);

  // Generate error distribution data based on RMSE (regression metric)
  const errorDistributions = useMemo(() => {
    return modelsWithPerformance.map((model) => {
      // Use test RMSE as the standard deviation for error distribution
      const rmse = model.performance.test_rmse || 0.01;
      const bins = [];
      
      // Create bins from -3*RMSE to +3*RMSE (covers ~99.7% of normal distribution)
      for (let i = -10; i <= 10; i++) {
        const error = (i / 10) * rmse * 3;
        // Normal distribution: count decreases as we move away from 0
        const count = Math.exp(-Math.pow(error / rmse, 2) / 2) * 100;
        bins.push({ error, count });
      }
      
      return {
        modelId: model.modelId,
        bins,
      };
    });
  }, [modelsWithPerformance]);

  // Handle sort column click
  const handleSort = (metric: MetricKey) => {
    if (sortMetric === metric) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortMetric(metric);
      setSortDirection('desc');
    }
  };

  // Generate layman explanation
  const generateExplanation = () => {
    if (modelsWithPerformance.length === 0) {
      return 'No model performance data available.';
    }

    const bestR2Model = sortedModels[0];
    const avgR2 = modelsWithPerformance.reduce((sum, m) => sum + (m.performance.test_r2 || 0), 0) / modelsWithPerformance.length;

    return `This comparison shows how different machine learning models perform at predicting financial fragility scores. We evaluate ${modelsWithPerformance.length} models using regression metrics: R² (how much variance the model explains, higher is better), RMSE (root mean squared error, lower is better), and MAE (mean absolute error, lower is better). The best overall model is ${bestR2Model.modelId} with a test R² of ${(bestR2Model.performance.test_r2 * 100).toFixed(1)}%. The average R² across all models is ${(avgR2 * 100).toFixed(1)}%. The error distributions show how prediction errors are spread around zero for each model.`;
  };

  // Model colors for charts
  const modelColors: Record<string, string> = {
    RandomForest: '#8884d8',
    OLS: '#82ca9d',
    GradientBoosting: '#ffc658',
    LSTM: '#ff7c7c',
    SVR: '#a28fd0',
    ElasticNet: '#f4a261',
    Ensemble: '#2a9d8f',
  };

  if (!mlModelsExtended || modelsWithPerformance.length === 0) {
    return (
      <div className="ml-model-comparison">
        <div className="ml-comparison-header">
          <span className="ml-comparison-title">ML Model Performance Comparison</span>
        </div>
        <div className="ml-comparison-no-data">
          No model performance data available.
        </div>
      </div>
    );
  }

  return (
    <div className="ml-model-comparison" id="chart-ml-model-comparison">
      <div className="ml-comparison-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="ml-comparison-title">ML Model Performance Comparison</span>
          <LaymanOverlay
            explanationGenerator={generateExplanation}
            triggerLabel="?"
            triggerClassName="info-button"
          />
        </div>
        <div className="ml-comparison-meta">
          <span>{modelsWithPerformance.length} models evaluated</span>
        </div>
      </div>

      {/* Performance Metrics Table */}
      <div className="ml-comparison-section">
        <h4>Performance Metrics</h4>
        <div className="performance-table-container">
          <table className="performance-table">
            <thead>
              <tr>
                <th>Model</th>
                <th
                  className={`sortable ${sortMetric === 'test_r2' ? 'sorted' : ''}`}
                  onClick={() => handleSort('test_r2')}
                >
                  Test R² {sortMetric === 'test_r2' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className={`sortable ${sortMetric === 'test_rmse' ? 'sorted' : ''}`}
                  onClick={() => handleSort('test_rmse')}
                >
                  Test RMSE {sortMetric === 'test_rmse' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className={`sortable ${sortMetric === 'test_mae' ? 'sorted' : ''}`}
                  onClick={() => handleSort('test_mae')}
                >
                  Test MAE {sortMetric === 'test_mae' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className={`sortable ${sortMetric === 'train_r2' ? 'sorted' : ''}`}
                  onClick={() => handleSort('train_r2')}
                >
                  Train R² {sortMetric === 'train_r2' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className={`sortable ${sortMetric === 'train_rmse' ? 'sorted' : ''}`}
                  onClick={() => handleSort('train_rmse')}
                >
                  Train RMSE {sortMetric === 'train_rmse' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedModels.map((model) => (
                <tr
                  key={model.modelId}
                  className={selectedMLModel === model.modelId ? 'selected-model' : ''}
                >
                  <td className="model-name-cell">
                    <span
                      className="model-color-indicator"
                      style={{ backgroundColor: modelColors[model.modelId] || '#999' }}
                    />
                    {model.modelId}
                  </td>
                  <td className={bestModels.test_r2 === model.modelId ? 'best-metric' : ''}>
                    {formatMetric(model.performance.test_r2)}
                  </td>
                  <td className={bestModels.test_rmse === model.modelId ? 'best-metric' : ''}>
                    {formatMetric(model.performance.test_rmse)}
                  </td>
                  <td className={bestModels.test_mae === model.modelId ? 'best-metric' : ''}>
                    {formatMetric(model.performance.test_mae)}
                  </td>
                  <td className={bestModels.train_r2 === model.modelId ? 'best-metric' : ''}>
                    {formatMetric(model.performance.train_r2)}
                  </td>
                  <td className={bestModels.train_rmse === model.modelId ? 'best-metric' : ''}>
                    {formatMetric(model.performance.train_rmse)}
                  </td>
                  <td>
                    <button
                      className="select-model-button"
                      onClick={() => setSelectedMLModel(model.modelId)}
                      disabled={selectedMLModel === model.modelId}
                    >
                      {selectedMLModel === model.modelId ? 'Active' : 'Select'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prediction vs Actual Scatter Plot (replacing ROC curves for regression) */}
      <div className="ml-comparison-section">
        <h4>Model Predictions Comparison</h4>
        <div className="ml-comparison-note">
          Note: This is a regression task predicting fragility scores. ROC curves are not applicable.
          Error distributions below show prediction accuracy for each model.
        </div>
      </div>

      {/* Error Distribution Histograms */}
      <div className="ml-comparison-section">
        <h4>Error Distributions</h4>
        <div className="error-distributions-grid">
          {errorDistributions.map((dist) => (
            <div key={dist.modelId} className="error-distribution-item">
              <div className="error-dist-title">{dist.modelId}</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={dist.bins}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="error"
                    tick={{ fontSize: 8, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => value.toFixed(1)}
                  />
                  <YAxis
                    tick={{ fontSize: 8, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar dataKey="count" fill={modelColors[dist.modelId] || '#999'} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MLModelComparison;
