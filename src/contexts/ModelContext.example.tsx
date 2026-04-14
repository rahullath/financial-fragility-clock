/**
 * Example usage of extended ModelContext
 * 
 * This file demonstrates how to use the new extended data and helper methods
 * in components.
 * 
 * Requirements: 11.6, 5.1, 6.1, 7.1, 8.1, 9.1
 */

import React from 'react';
import { useModelContext } from './ModelContext';

/**
 * Example component showing how to access ML model performance metrics
 */
export const MLModelPerformanceExample: React.FC = () => {
  const { mlModelsExtended, getModelPerformance, isLoadingExtendedData } = useModelContext();

  if (isLoadingExtendedData) {
    return <div>Loading extended data...</div>;
  }

  if (!mlModelsExtended) {
    return <div>Extended data unavailable</div>;
  }

  return (
    <div>
      <h2>ML Model Performance</h2>
      {mlModelsExtended.metadata.models.map((modelId) => {
        const performance = getModelPerformance(modelId);
        if (!performance) return null;

        return (
          <div key={modelId}>
            <h3>{modelId}</h3>
            <ul>
              <li>Accuracy: {(performance.accuracy * 100).toFixed(2)}%</li>
              <li>Precision: {(performance.precision * 100).toFixed(2)}%</li>
              <li>Recall: {(performance.recall * 100).toFixed(2)}%</li>
              <li>F1 Score: {(performance.f1_score * 100).toFixed(2)}%</li>
              <li>ROC AUC: {performance.roc_auc.toFixed(3)}</li>
            </ul>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Example component showing how to access regime transitions
 */
export const RegimeTransitionsExample: React.FC<{ date: string }> = ({ date }) => {
  const { getRegimeTransitions, isLoadingExtendedData } = useModelContext();

  if (isLoadingExtendedData) {
    return <div>Loading...</div>;
  }

  const transitions = getRegimeTransitions(date);
  if (!transitions) {
    return <div>No transition data available for {date}</div>;
  }

  const regimes = ['Normal', 'Stressed', 'Crisis'];

  return (
    <div>
      <h2>Regime Transitions for {date}</h2>
      <p>Current Regime: {transitions.current_regime}</p>
      <table>
        <thead>
          <tr>
            <th>From / To</th>
            {regimes.map((regime) => (
              <th key={regime}>{regime}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transitions.matrix.map((row, fromIndex) => (
            <tr key={fromIndex}>
              <td>{regimes[fromIndex]}</td>
              {row.map((prob, toIndex) => (
                <td key={toIndex}>{(prob * 100).toFixed(1)}%</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Example component showing how to access similar periods
 */
export const SimilarPeriodsExample: React.FC<{ date: string }> = ({ date }) => {
  const { getSimilarPeriods, isLoadingExtendedData } = useModelContext();

  if (isLoadingExtendedData) {
    return <div>Loading...</div>;
  }

  const similarPeriods = getSimilarPeriods(date, 5);

  return (
    <div>
      <h2>Top 5 Similar Periods to {date}</h2>
      {similarPeriods.length === 0 ? (
        <p>No similar periods found</p>
      ) : (
        <ul>
          {similarPeriods.map((period) => (
            <li key={period.date}>
              {period.date} - Similarity: {(period.score * 100).toFixed(1)}%
              <br />
              <small>Matched features: {period.features_matched.join(', ')}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Example component showing how to access network snapshots
 */
export const NetworkSnapshotExample: React.FC<{ date: string }> = ({ date }) => {
  const { getNetworkSnapshot, isLoadingExtendedData } = useModelContext();

  if (isLoadingExtendedData) {
    return <div>Loading...</div>;
  }

  const snapshot = getNetworkSnapshot(date);
  if (!snapshot) {
    return <div>No network data available for {date}</div>;
  }

  return (
    <div>
      <h2>Correlation Network for {date}</h2>
      <div>
        <h3>Network Metrics</h3>
        <ul>
          <li>Density: {snapshot.metrics.density.toFixed(3)}</li>
          <li>Clustering Coefficient: {snapshot.metrics.clustering_coefficient.toFixed(3)}</li>
          <li>Average Degree: {snapshot.metrics.avg_degree.toFixed(2)}</li>
        </ul>
      </div>
      <div>
        <h3>Network Structure</h3>
        <p>Nodes: {snapshot.nodes.length}</p>
        <p>Edges: {snapshot.edges.length}</p>
      </div>
    </div>
  );
};

/**
 * Example component showing how to access volatility clusters
 */
export const VolatilityClustersExample: React.FC<{ startDate: string; endDate: string }> = ({
  startDate,
  endDate,
}) => {
  const { getVolatilityClusters, isLoadingExtendedData } = useModelContext();

  if (isLoadingExtendedData) {
    return <div>Loading...</div>;
  }

  const clusters = getVolatilityClusters([startDate, endDate]);

  return (
    <div>
      <h2>Volatility Clusters ({startDate} to {endDate})</h2>
      {clusters.length === 0 ? (
        <p>No volatility clusters found in this period</p>
      ) : (
        <ul>
          {clusters.map((cluster) => (
            <li key={cluster.id}>
              Cluster {cluster.id}: {cluster.start_date} to {cluster.end_date}
              <br />
              Duration: {cluster.duration_days} days, Intensity: {cluster.intensity.toFixed(3)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Example component showing how to access lead time statistics
 */
export const LeadTimeStatsExample: React.FC<{ modelId: string }> = ({ modelId }) => {
  const { getLeadTimeStats, isLoadingExtendedData } = useModelContext();

  if (isLoadingExtendedData) {
    return <div>Loading...</div>;
  }

  const stats = getLeadTimeStats(modelId);
  if (!stats) {
    return <div>No lead time statistics available for {modelId}</div>;
  }

  return (
    <div>
      <h2>Lead Time Statistics for {modelId}</h2>
      <ul>
        <li>Mean Lead Time: {stats.mean_lead_time.toFixed(1)} days</li>
        <li>Median Lead Time: {stats.median_lead_time.toFixed(1)} days</li>
        <li>Min Lead Time: {stats.min_lead_time} days</li>
        <li>Max Lead Time: {stats.max_lead_time} days</li>
        <li>Actionable Predictions: {stats.actionable_percentage.toFixed(1)}%</li>
      </ul>
    </div>
  );
};
