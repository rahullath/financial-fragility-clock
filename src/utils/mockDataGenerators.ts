/**
 * Mock data generators for extended dashboard data schemas
 * 
 * These functions generate realistic mock data for development and testing
 * purposes before the Python backend implementation is complete.
 * 
 * Requirements: 11.1-11.5, 5.1, 6.1, 7.1, 8.1, 9.1
 */

import type {
  MLModelsExtendedData,
  MLModelPrediction,
  ModelPerformanceMetrics,
  ROCPoint,
  RegimeTransitionsData,
  RegimeTransitionSnapshot,
  DTWSimilarityData,
  DTWSimilaritySnapshot,
  SimilarPeriod,
  CorrelationNetworksData,
  NetworkSnapshot,
  NetworkNode,
  NetworkEdge,
  NetworkMetrics,
  VolatilityClusteringData,
  VolatilityDataPoint,
  VolatilityCluster,
  LeadTimeStatsData,
  CrisisPrediction,
  LeadTimeSummary,
} from '../types/extendedDataSchemas';

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Generate a random number between min and max
 */
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generate a date range between start and end dates
 */
function generateDateRange(startDate: string, endDate: string, stepDays: number = 1): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + stepDays);
  }
  
  return dates;
}

/**
 * Pick a random regime based on weighted probabilities
 */
function randomRegime(): string {
  const rand = Math.random();
  if (rand < 0.6) return 'normal';
  if (rand < 0.9) return 'stressed';
  return 'crisis';
}

// ── ML Models Extended Mock Data ──────────────────────────────────────────────

/**
 * Generate mock predictions for a single ML model
 */
function generateModelPredictions(
  dates: string[],
  baseFragility: number = 50
): MLModelPrediction[] {
  return dates.map((date) => {
    const noise = randomBetween(-15, 15);
    const fragility_score = Math.max(0, Math.min(100, baseFragility + noise));
    
    let regime: string;
    if (fragility_score < 40) regime = 'normal';
    else if (fragility_score < 70) regime = 'stressed';
    else regime = 'crisis';
    
    return {
      date,
      fragility_score,
      regime,
      confidence: randomBetween(0.7, 0.95),
    };
  });
}

/**
 * Generate mock ROC curve data
 */
function generateROCCurve(): ROCPoint[] {
  const points: ROCPoint[] = [];
  for (let i = 0; i <= 20; i++) {
    const fpr = i / 20;
    // Generate a realistic ROC curve (concave, above diagonal)
    const tpr = Math.min(1, fpr + Math.sqrt(fpr) * 0.5 + randomBetween(0, 0.1));
    points.push({ fpr, tpr });
  }
  return points;
}

/**
 * Generate mock performance metrics for a model
 */
function generatePerformanceMetrics(): ModelPerformanceMetrics {
  return {
    accuracy: randomBetween(0.75, 0.92),
    precision: randomBetween(0.70, 0.88),
    recall: randomBetween(0.72, 0.90),
    f1_score: randomBetween(0.73, 0.89),
    roc_auc: randomBetween(0.80, 0.95),
    roc_curve: generateROCCurve(),
  };
}

/**
 * Generate complete mock ML models extended data
 */
export function generateMockMLModelsExtended(
  startDate: string = '2020-01-01',
  endDate: string = '2023-12-31'
): MLModelsExtendedData {
  const dates = generateDateRange(startDate, endDate, 7); // Weekly data
  const models = ['GradientBoosting', 'LSTM', 'SVR', 'ElasticNet', 'Ensemble'];
  
  const predictions: { [key: string]: MLModelPrediction[] } = {};
  const performance: { [key: string]: ModelPerformanceMetrics } = {};
  
  models.forEach((modelId, index) => {
    // Vary base fragility slightly per model
    const baseFragility = 45 + index * 3;
    predictions[modelId] = generateModelPredictions(dates, baseFragility);
    performance[modelId] = generatePerformanceMetrics();
  });
  
  return {
    metadata: {
      generated_at: new Date().toISOString(),
      models,
    },
    predictions,
    performance,
  };
}

// ── Regime Transitions Mock Data ──────────────────────────────────────────────

/**
 * Generate a random transition probability matrix (3x3)
 */
function generateTransitionMatrix(): number[][] {
  const matrix: number[][] = [];
  
  for (let from = 0; from < 3; from++) {
    const row: number[] = [];
    let remaining = 1.0;
    
    for (let to = 0; to < 2; to++) {
      // Higher probability to stay in same regime
      const isSameRegime = from === to;
      const prob = isSameRegime 
        ? randomBetween(0.6, 0.8) 
        : randomBetween(0.05, remaining * 0.4);
      
      row.push(Math.min(prob, remaining));
      remaining -= row[to];
    }
    
    // Last column gets remaining probability
    row.push(Math.max(0, remaining));
    matrix.push(row);
  }
  
  return matrix;
}

/**
 * Generate mock regime transition data
 */
export function generateMockRegimeTransitions(
  startDate: string = '2020-01-01',
  endDate: string = '2023-12-31'
): RegimeTransitionsData {
  const dates = generateDateRange(startDate, endDate, 30); // Monthly snapshots
  const regimes = ['normal', 'stressed', 'crisis'];
  
  const transitions: RegimeTransitionSnapshot[] = dates.map((date) => ({
    date,
    matrix: generateTransitionMatrix(),
    current_regime: randomRegime(),
  }));
  
  return {
    metadata: { regimes },
    transitions,
  };
}

// ── DTW Similarity Mock Data ──────────────────────────────────────────────────

/**
 * Generate mock similar periods for a reference date
 */
function generateSimilarPeriods(
  allDates: string[],
  referenceDate: string,
  features: string[]
): SimilarPeriod[] {
  return allDates
    .filter((d) => d !== referenceDate)
    .map((date) => ({
      date,
      score: randomBetween(0.3, 0.95),
      features_matched: features.slice(0, Math.floor(Math.random() * features.length) + 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50); // Keep top 50 most similar
}

/**
 * Generate mock DTW similarity data
 */
export function generateMockDTWSimilarity(
  startDate: string = '2020-01-01',
  endDate: string = '2023-12-31'
): DTWSimilarityData {
  const dates = generateDateRange(startDate, endDate, 30); // Monthly reference points
  const features = [
    'mean_corr',
    'permutation_entropy',
    'rolling_volatility',
    'eigenvalue_ratio',
    'fragility_score',
  ];
  
  const similarities: DTWSimilaritySnapshot[] = dates.map((referenceDate) => ({
    reference_date: referenceDate,
    similar_periods: generateSimilarPeriods(dates, referenceDate, features),
  }));
  
  return {
    metadata: {
      window_size: 30,
      feature_set: features,
    },
    similarities,
  };
}

// ── Correlation Networks Mock Data ────────────────────────────────────────────

/**
 * Generate mock network nodes
 */
function generateNetworkNodes(indices: string[]): NetworkNode[] {
  return indices.map((index) => ({
    id: index,
    label: index,
  }));
}

/**
 * Generate mock network edges
 */
function generateNetworkEdges(nodes: NetworkNode[], threshold: number): NetworkEdge[] {
  const edges: NetworkEdge[] = [];
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const weight = randomBetween(0, 1);
      if (weight >= threshold) {
        edges.push({
          source: nodes[i].id,
          target: nodes[j].id,
          weight,
        });
      }
    }
  }
  
  return edges;
}

/**
 * Calculate mock network metrics
 */
function calculateNetworkMetrics(nodes: NetworkNode[], edges: NetworkEdge[]): NetworkMetrics {
  const maxEdges = (nodes.length * (nodes.length - 1)) / 2;
  const density = edges.length / maxEdges;
  
  return {
    density,
    clustering_coefficient: randomBetween(0.3, 0.7),
    avg_degree: (2 * edges.length) / nodes.length,
  };
}

/**
 * Generate mock correlation network data
 */
export function generateMockCorrelationNetworks(
  startDate: string = '2020-01-01',
  endDate: string = '2023-12-31'
): CorrelationNetworksData {
  const dates = generateDateRange(startDate, endDate, 60); // Bi-monthly snapshots
  const indices = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM', 'VIX'];
  const threshold = 0.5;
  
  const nodes = generateNetworkNodes(indices);
  
  const snapshots: NetworkSnapshot[] = dates.map((date) => {
    const edges = generateNetworkEdges(nodes, threshold);
    const metrics = calculateNetworkMetrics(nodes, edges);
    
    return {
      date,
      nodes,
      edges,
      metrics,
    };
  });
  
  return {
    metadata: {
      indices,
      threshold,
    },
    snapshots,
  };
}

// ── Volatility Clustering Mock Data ───────────────────────────────────────────

/**
 * Generate mock volatility time series
 */
function generateVolatilityTimeSeries(dates: string[]): VolatilityDataPoint[] {
  let baseVolatility = 0.15;
  
  return dates.map((date) => {
    // Add some autocorrelation
    baseVolatility = baseVolatility * 0.9 + randomBetween(0.05, 0.35) * 0.1;
    
    return {
      date,
      volatility: baseVolatility,
    };
  });
}

/**
 * Identify mock volatility clusters
 */
function identifyVolatilityClusters(
  timeSeries: VolatilityDataPoint[],
  minDuration: number
): VolatilityCluster[] {
  const clusters: VolatilityCluster[] = [];
  const highVolThreshold = 0.25;
  
  let clusterId = 0;
  let clusterStart: string | null = null;
  let clusterIntensity = 0;
  let clusterDays = 0;
  
  timeSeries.forEach((point, index) => {
    if (point.volatility > highVolThreshold) {
      if (!clusterStart) {
        clusterStart = point.date;
        clusterIntensity = point.volatility;
        clusterDays = 1;
      } else {
        clusterIntensity = Math.max(clusterIntensity, point.volatility);
        clusterDays++;
      }
    } else if (clusterStart && clusterDays >= minDuration) {
      clusters.push({
        id: clusterId++,
        start_date: clusterStart,
        end_date: timeSeries[index - 1].date,
        intensity: clusterIntensity,
        duration_days: clusterDays,
      });
      clusterStart = null;
      clusterIntensity = 0;
      clusterDays = 0;
    } else {
      clusterStart = null;
      clusterIntensity = 0;
      clusterDays = 0;
    }
  });
  
  return clusters;
}

/**
 * Generate mock volatility clustering data
 */
export function generateMockVolatilityClustering(
  startDate: string = '2020-01-01',
  endDate: string = '2023-12-31'
): VolatilityClusteringData {
  const dates = generateDateRange(startDate, endDate, 1); // Daily data
  const minClusterDuration = 5;
  
  const timeSeries = generateVolatilityTimeSeries(dates);
  const clusters = identifyVolatilityClusters(timeSeries, minClusterDuration);
  
  return {
    metadata: {
      clustering_algorithm: 'DBSCAN',
      min_cluster_duration: minClusterDuration,
    },
    time_series: timeSeries,
    clusters,
  };
}

// ── Lead Time Stats Mock Data ─────────────────────────────────────────────────

/**
 * Generate mock crisis predictions
 */
function generateCrisisPredictions(
  models: string[],
  crisisDates: string[],
  actionableThreshold: number
): CrisisPrediction[] {
  const predictions: CrisisPrediction[] = [];
  
  crisisDates.forEach((crisisDate) => {
    models.forEach((modelId) => {
      const leadTimeDays = Math.floor(randomBetween(5, 90));
      const predictionDate = new Date(crisisDate);
      predictionDate.setDate(predictionDate.getDate() - leadTimeDays);
      
      predictions.push({
        crisis_date: crisisDate,
        prediction_date: predictionDate.toISOString().split('T')[0],
        lead_time_days: leadTimeDays,
        model_id: modelId,
        was_actionable: leadTimeDays >= actionableThreshold,
      });
    });
  });
  
  return predictions;
}

/**
 * Calculate lead time summary statistics
 */
function calculateLeadTimeSummary(
  predictions: CrisisPrediction[],
  modelId: string
): LeadTimeSummary {
  const modelPredictions = predictions.filter((p) => p.model_id === modelId);
  const leadTimes = modelPredictions.map((p) => p.lead_time_days).sort((a, b) => a - b);
  
  const mean = leadTimes.reduce((sum, val) => sum + val, 0) / leadTimes.length;
  const median = leadTimes[Math.floor(leadTimes.length / 2)];
  const min = Math.min(...leadTimes);
  const max = Math.max(...leadTimes);
  const actionableCount = modelPredictions.filter((p) => p.was_actionable).length;
  const actionablePercentage = (actionableCount / modelPredictions.length) * 100;
  
  return {
    mean_lead_time: mean,
    median_lead_time: median,
    min_lead_time: min,
    max_lead_time: max,
    actionable_percentage: actionablePercentage,
  };
}

/**
 * Generate mock lead time statistics data
 */
export function generateMockLeadTimeStats(): LeadTimeStatsData {
  const models = ['RandomForest', 'OLS', 'GradientBoosting', 'LSTM', 'Ensemble'];
  const crisisDates = [
    '2020-03-16', // COVID crash
    '2022-02-24', // Ukraine invasion
    '2023-03-10', // Banking crisis
  ];
  const crisisThreshold = 70;
  const actionableLeadTime = 30;
  
  const predictions = generateCrisisPredictions(models, crisisDates, actionableLeadTime);
  
  const summary: { [key: string]: LeadTimeSummary } = {};
  models.forEach((modelId) => {
    summary[modelId] = calculateLeadTimeSummary(predictions, modelId);
  });
  
  return {
    metadata: {
      crisis_threshold: crisisThreshold,
      actionable_lead_time: actionableLeadTime,
    },
    predictions,
    summary,
  };
}
