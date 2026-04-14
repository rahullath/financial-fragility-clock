import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';

// ── Static JSON imports ───────────────────────────────────────────────────────
// Model A — ISE 2009-2011 (536 obs)
import modelAClean from '../data/cleaned_data.json';
import modelAFeatures from '../data/features.json';
import modelAOutputs from '../data/model_outputs.json';

// Model B — Global 2003-2025 (5984 obs)
import modelBClean from '../data/model_b_cleaned_data.json';
import modelBFeatures from '../data/model_b_features_slim.json';
import modelBOutputs from '../data/model_b_outputs.json';

// ── Extended data types ───────────────────────────────────────────────────────
import type {
  MLModelsExtendedData,
  RegimeTransitionsData,
  DTWSimilarityData,
  CorrelationNetworksData,
  VolatilityClusteringData,
  LeadTimeStatsData,
  ModelPerformanceMetrics,
  RegimeTransitionSnapshot,
  SimilarPeriod,
  NetworkSnapshot,
  VolatilityCluster,
  LeadTimeSummary,
} from '../types';

// ── Mock data generators ──────────────────────────────────────────────────────
import {
  generateMockMLModelsExtended,
  generateMockRegimeTransitions,
  generateMockDTWSimilarity,
  generateMockCorrelationNetworks,
  generateMockVolatilityClustering,
  generateMockLeadTimeStats,
} from '../utils/mockDataGenerators';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModelSelection = 'A' | 'B';

/** A single time-series row, shared between both models. */
export interface DataRow {
  date: string;
  fragility_score?: number | null;
  regime?: string | null;
  regime_confidence?: number | null;
  mean_corr?: number | null;
  permutation_entropy?: number | null;
  rolling_volatility?: number | null;
  eigenvalue_ratio?: number | null;
  [key: string]: unknown;
}

/** Key financial events to annotate on timelines. */
export interface ModelEvent {
  date: string; // ISO date string
  label: string;
  description: string;
  severity: 'crisis' | 'correction' | 'note';
}

export interface ModelInfo {
  id: ModelSelection;
  label: string;
  description: string;
  dateRange: [string, string];
  observationCount: number;
  indices: string[];
}

export interface CurrentModelData {
  info: ModelInfo;
  cleanedData: { metadata: Record<string, unknown>; data: DataRow[] };
  featuresData: { metadata: Record<string, unknown>; data: DataRow[] };
  outputsData: Record<string, unknown>;
  keyEvents: ModelEvent[];
}

export interface ModelContextValue {
  selectedModel: ModelSelection;
  setSelectedModel: (model: ModelSelection) => void;
  modelAData: CurrentModelData;
  modelBData: CurrentModelData;
  currentModelData: CurrentModelData;
  lastUpdated: string | null;
  
  // ML model selection
  selectedMLModel: string;
  setSelectedMLModel: (modelId: string) => void;
  availableMLModels: string[];
  
  // Extended data fields
  mlModelsExtended: MLModelsExtendedData | null;
  regimeTransitions: RegimeTransitionsData | null;
  dtwSimilarity: DTWSimilarityData | null;
  correlationNetworks: CorrelationNetworksData | null;
  volatilityClusters: VolatilityClusteringData | null;
  leadTimeStats: LeadTimeStatsData | null;
  
  // Loading states
  isLoadingExtendedData: boolean;
  extendedDataError: string | null;
  
  // Helper methods
  getModelPerformance: (modelId: string) => ModelPerformanceMetrics | null;
  getRegimeTransitions: (date: string) => RegimeTransitionSnapshot | null;
  getSimilarPeriods: (date: string, topN?: number) => SimilarPeriod[];
  getNetworkSnapshot: (date: string) => NetworkSnapshot | null;
  getVolatilityClusters: (dateRange: [string, string]) => VolatilityCluster[];
  getLeadTimeStats: (modelId: string) => LeadTimeSummary | null;
}

// ── Static event definitions ──────────────────────────────────────────────────

const MODEL_A_EVENTS: ModelEvent[] = [
  {
    date: '2010-04-27',
    label: 'Greece Crisis',
    description: 'Greek debt crisis intensifies, triggering European sovereign debt concerns',
    severity: 'crisis',
  },
  {
    date: '2010-05-06',
    label: 'Flash Crash',
    description: 'US stock market flash crash — Dow Jones drops ~1000 points in minutes',
    severity: 'crisis',
  },
];

const MODEL_B_EVENTS: ModelEvent[] = [
  {
    date: '2008-09-15',
    label: 'Lehman Brothers',
    description: 'Lehman Brothers files for bankruptcy — triggers global financial crisis',
    severity: 'crisis',
  },
  {
    date: '2010-05-06',
    label: 'Flash Crash',
    description: 'US stock market flash crash — Dow Jones drops ~1000 points in minutes',
    severity: 'correction',
  },
  {
    date: '2020-03-16',
    label: 'COVID Crash',
    description: 'Global markets crash amid COVID-19 pandemic lockdowns',
    severity: 'crisis',
  },
  {
    date: '2025-04-07',
    label: 'Tariff Shock',
    description: 'Markets plunge following sweeping US tariff announcements',
    severity: 'correction',
  },
];

// ── Model info objects ────────────────────────────────────────────────────────

const MODEL_A_INFO: ModelInfo = {
  id: 'A',
  label: 'Model A (ISE 2009–2011)',
  description: 'Turkish ISE-based fragility model over 536 trading days',
  dateRange: [
    (modelAClean as { metadata: { date_range: string[] } }).metadata.date_range[0],
    (modelAClean as { metadata: { date_range: string[] } }).metadata.date_range[1],
  ],
  observationCount: (modelAClean as { data: unknown[] }).data.length,
  indices: ['ISE', 'SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'],
};

const MODEL_B_INFO: ModelInfo = {
  id: 'B',
  label: 'Model B (Global 2003–2025)',
  description: 'Extended global fragility model with 13 indices across 22 years',
  dateRange: [
    (modelBClean as { metadata: { date_range: string[] } }).metadata.date_range[0],
    (modelBClean as { metadata: { date_range: string[] } }).metadata.date_range[1],
  ],
  observationCount: (modelBClean as { data: unknown[] }).data.length,
  indices: ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM',
            'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200', 'VIX'],
};

// ── Context ───────────────────────────────────────────────────────────────────

const ModelContext = createContext<ModelContextValue | null>(null);

interface ModelProviderProps {
  children: ReactNode;
}

/**
 * ModelContext Provider
 *
 * Holds model selection state and provides fully-typed data for both Model A
 * and Model B to all child components.  Components should read from
 * `currentModelData` for the active model, or from `modelAData`/`modelBData`
 * for side-by-side comparisons.
 *
 * Extended with additional ML models, regime transitions, DTW similarity,
 * correlation networks, volatility clustering, and lead time statistics.
 *
 * Requirements: 36.1, 36.2, 11.6, 5.1, 6.1, 7.1, 8.1, 9.1
 */
export const ModelProvider: React.FC<ModelProviderProps> = ({ children }) => {
  const [selectedModel, setSelectedModel] = useState<ModelSelection>('A');
  
  // ML model selection state
  const [selectedMLModel, setSelectedMLModel] = useState<string>('RandomForest');
  const [availableMLModels, setAvailableMLModels] = useState<string[]>([
    'RandomForest',
    'OLS',
    'GradientBoosting',
    'LSTM',
    'SVR',
    'ElasticNet',
    'Ensemble',
  ]);
  
  // Extended data state
  const [mlModelsExtended, setMLModelsExtended] = useState<MLModelsExtendedData | null>(null);
  const [regimeTransitions, setRegimeTransitions] = useState<RegimeTransitionsData | null>(null);
  const [dtwSimilarity, setDTWSimilarity] = useState<DTWSimilarityData | null>(null);
  const [correlationNetworks, setCorrelationNetworks] = useState<CorrelationNetworksData | null>(null);
  const [volatilityClusters, setVolatilityClusters] = useState<VolatilityClusteringData | null>(null);
  const [leadTimeStats, setLeadTimeStats] = useState<LeadTimeStatsData | null>(null);
  
  const [isLoadingExtendedData, setIsLoadingExtendedData] = useState(true);
  const [extendedDataError, setExtendedDataError] = useState<string | null>(null);

  const modelAData: CurrentModelData = useMemo(
    () => ({
      info: MODEL_A_INFO,
      cleanedData: modelAClean as CurrentModelData['cleanedData'],
      featuresData: modelAFeatures as CurrentModelData['featuresData'],
      outputsData: modelAOutputs as Record<string, unknown>,
      keyEvents: MODEL_A_EVENTS,
    }),
    []
  );

  const modelBData: CurrentModelData = useMemo(
    () => ({
      info: MODEL_B_INFO,
      cleanedData: modelBClean as CurrentModelData['cleanedData'],
      featuresData: modelBFeatures as CurrentModelData['featuresData'],
      outputsData: modelBOutputs as Record<string, unknown>,
      keyEvents: MODEL_B_EVENTS,
    }),
    []
  );

  const currentModelData = selectedModel === 'A' ? modelAData : modelBData;

  // Extract last_updated from current model's metadata
  const lastUpdated = useMemo(() => {
    const metadata = currentModelData.featuresData.metadata as Record<string, unknown>;
    const liveDataThrough = metadata?.live_data_through as string | undefined;
    return liveDataThrough || null;
  }, [currentModelData]);
  
  // Load extended data on mount
  useEffect(() => {
    const loadExtendedData = async () => {
      setIsLoadingExtendedData(true);
      setExtendedDataError(null);
      
      try {
        // Load ML models extended data via fetch
        const mlModelsResponse = await fetch('/data/ml_models_extended.json');
        if (!mlModelsResponse.ok) {
          throw new Error('Failed to load ML models extended data');
        }
        const mlModels = await mlModelsResponse.json() as MLModelsExtendedData;
        setMLModelsExtended(mlModels);
        
        // Update available models list from the loaded data
        if (mlModels && mlModels.metadata && mlModels.metadata.models) {
          setAvailableMLModels([
            'RandomForest',
            'OLS',
            ...mlModels.metadata.models,
          ]);
        }
        
        // Load other extended data (use mock generators for now)
        const [regimes, dtw, networks, volatility, leadTime] = await Promise.all([
          Promise.resolve(generateMockRegimeTransitions('2020-01-01', '2023-12-31')),
          Promise.resolve(generateMockDTWSimilarity('2020-01-01', '2023-12-31')),
          Promise.resolve(generateMockCorrelationNetworks('2020-01-01', '2023-12-31')),
          Promise.resolve(generateMockVolatilityClustering('2020-01-01', '2023-12-31')),
          Promise.resolve(generateMockLeadTimeStats()),
        ]);
        
        setRegimeTransitions(regimes);
        setDTWSimilarity(dtw);
        setCorrelationNetworks(networks);
        setVolatilityClusters(volatility);
        setLeadTimeStats(leadTime);
      } catch (error) {
        console.error('Failed to load extended data:', error);
        setExtendedDataError('Unable to load extended model data. Some features may be unavailable.');
      } finally {
        setIsLoadingExtendedData(false);
      }
    };
    
    loadExtendedData();
  }, []);
  
  // Helper method: Get model performance metrics
  const getModelPerformance = (modelId: string): ModelPerformanceMetrics | null => {
    if (!mlModelsExtended) return null;
    return mlModelsExtended.performance[modelId] || null;
  };
  
  // Helper method: Get regime transitions for a specific date
  const getRegimeTransitions = (date: string): RegimeTransitionSnapshot | null => {
    if (!regimeTransitions) return null;
    
    // Find the closest date (or exact match)
    const snapshot = regimeTransitions.transitions.find((t) => t.date === date);
    if (snapshot) return snapshot;
    
    // If no exact match, find the closest earlier date
    const sortedTransitions = [...regimeTransitions.transitions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const targetTime = new Date(date).getTime();
    for (let i = sortedTransitions.length - 1; i >= 0; i--) {
      if (new Date(sortedTransitions[i].date).getTime() <= targetTime) {
        return sortedTransitions[i];
      }
    }
    
    return sortedTransitions[0] || null;
  };
  
  // Helper method: Get similar periods for a date
  const getSimilarPeriods = (date: string, topN: number = 5): SimilarPeriod[] => {
    if (!dtwSimilarity) return [];
    
    const snapshot = dtwSimilarity.similarities.find((s) => s.reference_date === date);
    if (!snapshot) return [];
    
    return snapshot.similar_periods.slice(0, topN);
  };
  
  // Helper method: Get network snapshot for a date
  const getNetworkSnapshot = (date: string): NetworkSnapshot | null => {
    if (!correlationNetworks) return null;
    
    // Find the closest date
    const snapshot = correlationNetworks.snapshots.find((s) => s.date === date);
    if (snapshot) return snapshot;
    
    // Find closest earlier date
    const sortedSnapshots = [...correlationNetworks.snapshots].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const targetTime = new Date(date).getTime();
    for (let i = sortedSnapshots.length - 1; i >= 0; i--) {
      if (new Date(sortedSnapshots[i].date).getTime() <= targetTime) {
        return sortedSnapshots[i];
      }
    }
    
    return sortedSnapshots[0] || null;
  };
  
  // Helper method: Get volatility clusters within a date range
  const getVolatilityClusters = (dateRange: [string, string]): VolatilityCluster[] => {
    if (!volatilityClusters) return [];
    
    const [startDate, endDate] = dateRange;
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    
    return volatilityClusters.clusters.filter((cluster) => {
      const clusterStart = new Date(cluster.start_date).getTime();
      const clusterEnd = new Date(cluster.end_date).getTime();
      
      // Include cluster if it overlaps with the date range
      return clusterStart <= endTime && clusterEnd >= startTime;
    });
  };
  
  // Helper method: Get lead time statistics for a model
  const getLeadTimeStats = (modelId: string): LeadTimeSummary | null => {
    if (!leadTimeStats) return null;
    return leadTimeStats.summary[modelId] || null;
  };

  const value: ModelContextValue = {
    selectedModel,
    setSelectedModel,
    modelAData,
    modelBData,
    currentModelData,
    lastUpdated,
    
    // ML model selection
    selectedMLModel,
    setSelectedMLModel,
    availableMLModels,
    
    // Extended data
    mlModelsExtended,
    regimeTransitions,
    dtwSimilarity,
    correlationNetworks,
    volatilityClusters,
    leadTimeStats,
    
    // Loading states
    isLoadingExtendedData,
    extendedDataError,
    
    // Helper methods
    getModelPerformance,
    getRegimeTransitions,
    getSimilarPeriods,
    getNetworkSnapshot,
    getVolatilityClusters,
    getLeadTimeStats,
  };

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
};

/**
 * Hook to access the ModelContext.
 * Must be used inside a <ModelProvider>.
 */
export const useModelContext = (): ModelContextValue => {
  const ctx = useContext(ModelContext);
  if (!ctx) {
    throw new Error('useModelContext must be used within a ModelProvider');
  }
  return ctx;
};

export default ModelContext;
