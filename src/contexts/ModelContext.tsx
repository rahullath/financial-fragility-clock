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
// New pipeline outputs (results_model_a replaces model_outputs for live metrics)
import modelAResults from '../data/results_model_a.json';
// Legacy outputs kept for components that read walk_forward / SHAP structures
import modelAOutputsLegacy from '../data/model_outputs.json';

// Model B — Extended 2005-2026
import modelBClean from '../data/model_b_cleaned_data.json';
import modelBFeatures from '../data/model_b_features_slim.json';
import modelBOutputs from '../data/model_b_outputs.json';
// New pipeline outputs for Model B
import modelBResults from '../data/results_model_b.json';

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
  date: string;
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
  selectedMLModel: string;
  setSelectedMLModel: (modelId: string) => void;
  availableMLModels: string[];
  mlModelsExtended: MLModelsExtendedData | null;
  regimeTransitions: RegimeTransitionsData | null;
  dtwSimilarity: DTWSimilarityData | null;
  correlationNetworks: CorrelationNetworksData | null;
  volatilityClusters: VolatilityClusteringData | null;
  leadTimeStats: LeadTimeStatsData | null;
  isLoadingExtendedData: boolean;
  extendedDataError: string | null;
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
    date: '2018-08-10',
    label: 'TL Collapse',
    description: 'Turkish Lira loses 20% in a single day amid US sanctions and CBRT rate controversy',
    severity: 'crisis',
  },
  {
    date: '2020-03-16',
    label: 'COVID Crash',
    description: 'Global markets crash amid COVID-19 pandemic lockdowns',
    severity: 'crisis',
  },
  {
    date: '2021-09-23',
    label: 'Rate Cut Shock',
    description: 'CBRT begins unorthodox rate cuts despite 20%+ inflation — TL spiral accelerates',
    severity: 'crisis',
  },
  {
    date: '2023-02-06',
    label: 'Earthquake',
    description: 'Kahramanmaras earthquake kills 50k+, ISE suspended for first time in history',
    severity: 'crisis',
  },
];

// ── normaliseOutputs adapter ──────────────────────────────────────────────────
// results_model_*.json stores metrics under model.test_metrics.*
// Legacy components expect model.metrics.*
// This adapter hoists test_metrics → metrics non-destructively.

type RawModelBlock = Record<string, unknown> & {
  test_metrics?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  cv_auc_mean?: number;
  feature_importance?: unknown[];
  fragility_scores?: unknown[];
  y_pred?: unknown[];
  y_proba?: unknown[];
};

function hoistTestMetrics(block: RawModelBlock): Record<string, unknown> {
  if (!block || typeof block !== 'object') return block;
  const tm = block.test_metrics as Record<string, unknown> | undefined;
  if (!tm) return { ...block };
  return {
    ...block,
    metrics: {
      ...(block.metrics as Record<string, unknown> | undefined ?? {}),
      ...tm,
      cv_auc_mean: block.cv_auc_mean ?? null,
    },
  };
}

function normaliseModelAOutputs(
  results: Record<string, unknown>,
  legacy: Record<string, unknown>
): Record<string, unknown> {
  const clf = results.classification as Record<string, RawModelBlock> | undefined;
  const reg = results.regression as Record<string, RawModelBlock> | undefined;

  const rfClf    = clf?.['rf']      ? hoistTestMetrics(clf['rf'])      : null;
  const xgbClf   = clf?.['xgboost'] ? hoistTestMetrics(clf['xgboost']) : null;
  const olsReg   = reg?.['ols']     ? hoistTestMetrics(reg['ols'])     : null;
  const ridgeReg = reg?.['ridge']   ? hoistTestMetrics(reg['ridge'])   : null;
  const rfReg    = reg?.['rf']      ? hoistTestMetrics(reg['rf'])      : null;
  const xgbReg   = reg?.['xgboost'] ? hoistTestMetrics(reg['xgboost']) : null;
  const lstmReg  = reg?.['lstm']    ? hoistTestMetrics(reg['lstm'])    : null;

  const buildRegComparison = () =>
    ([['OLS', olsReg], ['Ridge', ridgeReg], ['RandomForest', rfReg], ['XGBoost', xgbReg], ['LSTM', lstmReg]] as [string, Record<string, unknown> | null][])
      .filter(([, v]) => v !== null)
      .map(([name, v]) => ({ model: name, ...(v!.metrics as object) }));

  const buildClfComparison = () => {
    const rows: object[] = [];
    if (rfClf)  rows.push({ model: 'RandomForestClassifier',  ...(rfClf.metrics  as object) });
    if (xgbClf) rows.push({ model: 'XGBoostClassifier',       ...(xgbClf.metrics as object) });
    return rows;
  };

  return {
    ...legacy,
    logistic_regression: ridgeReg ?? legacy['logistic_regression'],
    random_forest: rfClf ?? rfReg ?? legacy['random_forest'],
    ols:     olsReg  ?? legacy['ols'],
    ridge:   ridgeReg,
    rf:      rfReg,
    xgboost: xgbReg,
    lstm:    lstmReg,
    rf_classifier:      rfClf,
    xgboost_classifier: xgbClf,
    comparison:     buildClfComparison(),
    reg_comparison: buildRegComparison(),
    clf_comparison: buildClfComparison(),
    meta:           results.meta,
    crisis_stats:   results.crisis_stats,
    ise2_series:    results.ise2_series,
    predictions:    results.predictions,
    feature_importance: {
      rf:          rfReg?.feature_importance  ?? [],
      xgboost:     xgbReg?.feature_importance ?? [],
      rf_clf:      rfClf?.feature_importance  ?? [],
      xgboost_clf: xgbClf?.feature_importance ?? [],
    },
    roc_curves: {
      rf:      (rfClf?.test_metrics  as Record<string, unknown> | undefined)?.['roc_curve'] ?? [],
      xgboost: (xgbClf?.test_metrics as Record<string, unknown> | undefined)?.['roc_curve'] ?? [],
    },
    fragility_scores: {
      dates:   (results.predictions as Record<string, unknown> | undefined)?.['dates'] ?? [],
      rf:      rfClf?.fragility_scores  ?? [],
      xgboost: xgbClf?.fragility_scores ?? [],
    },
    crisis_windows: (results.meta as Record<string, unknown> | undefined)?.['crisis_windows'] ?? [],
  };
}

function normaliseModelBOutputs(
  results: Record<string, unknown>,
  legacy: Record<string, unknown>
): Record<string, unknown> {
  const clf = results.classification as Record<string, RawModelBlock> | undefined;
  const reg = results.regression     as Record<string, RawModelBlock> | undefined;

  const rfClf    = clf?.['rf']      ? hoistTestMetrics(clf['rf'])      : null;
  const xgbClf   = clf?.['xgboost'] ? hoistTestMetrics(clf['xgboost']) : null;
  const olsReg   = reg?.['ols']     ? hoistTestMetrics(reg['ols'])     : null;
  const ridgeReg = reg?.['ridge']   ? hoistTestMetrics(reg['ridge'])   : null;
  const rfReg    = reg?.['rf']      ? hoistTestMetrics(reg['rf'])      : null;
  const xgbReg   = reg?.['xgboost'] ? hoistTestMetrics(reg['xgboost']) : null;
  const lstmReg  = reg?.['lstm']    ? hoistTestMetrics(reg['lstm'])    : null;

  return {
    ...legacy,
    ols:     olsReg,
    ridge:   ridgeReg,
    rf:      rfReg,
    xgboost: xgbReg,
    lstm:    lstmReg,
    rf_classifier:      rfClf,
    xgboost_classifier: xgbClf,
    random_forest:      rfClf ?? rfReg ?? legacy['random_forest'],
    reg_comparison: ([['OLS', olsReg], ['Ridge', ridgeReg], ['RandomForest', rfReg], ['XGBoost', xgbReg], ['LSTM', lstmReg]] as [string, Record<string, unknown> | null][])
      .filter(([, v]) => v !== null)
      .map(([name, v]) => ({ model: name, ...(v!.metrics as object) })),
    clf_comparison: [rfClf, xgbClf]
      .filter(Boolean)
      .map((v, i) => ({ model: ['RandomForestClassifier', 'XGBoostClassifier'][i], ...(v!.metrics as object) })),
    meta:           results.meta,
    crisis_stats:   results.crisis_stats,
    ise2_series:    results.ise2_series,
    predictions:    results.predictions,
    feature_importance: {
      rf:          rfReg?.feature_importance  ?? [],
      xgboost:     xgbReg?.feature_importance ?? [],
      rf_clf:      rfClf?.feature_importance  ?? [],
      xgboost_clf: xgbClf?.feature_importance ?? [],
    },
    roc_curves: {
      rf:      (rfClf?.test_metrics  as Record<string, unknown> | undefined)?.['roc_curve'] ?? [],
      xgboost: (xgbClf?.test_metrics as Record<string, unknown> | undefined)?.['roc_curve'] ?? [],
    },
    fragility_scores: {
      dates:   (results.predictions as Record<string, unknown> | undefined)?.['dates'] ?? [],
      rf:      rfClf?.fragility_scores  ?? [],
      xgboost: xgbClf?.fragility_scores ?? [],
    },
    crisis_windows: (results.meta as Record<string, unknown> | undefined)?.['crisis_windows'] ?? [],
  };
}

// ── Normalised singletons (computed once at module load) ──────────────────────
const normalisedModelAOutputs = normaliseModelAOutputs(
  modelAResults as unknown as Record<string, unknown>,
  modelAOutputsLegacy as unknown as Record<string, unknown>
);

const normalisedModelBOutputs = normaliseModelBOutputs(
  modelBResults as unknown as Record<string, unknown>,
  modelBOutputs as unknown as Record<string, unknown>
);

// ── Model info objects ────────────────────────────────────────────────────────

const MODEL_A_INFO: ModelInfo = {
  id: 'A',
  label: 'Model A — ISE 2009-2011',
  description: 'Baseline: 7 global indices predicting ISE USD returns (Group_5.csv)',
  dateRange: [
    (modelAClean as { metadata: { date_range: string[] } }).metadata.date_range[0],
    (modelAClean as { metadata: { date_range: string[] } }).metadata.date_range[1],
  ],
  observationCount: (modelAClean as { data: unknown[] }).data.length,
  indices: ['ise2', 'sp', 'dax', 'ftse', 'nikkei', 'bovespa', 'eu', 'em'],
};

const MODEL_B_INFO: ModelInfo = {
  id: 'B',
  label: 'Model B — Extended 2005-2026',
  description: 'Extended: adds TRY/USD, CBRT rate, CPI — trained pre-2018, tested on Turkey crisis',
  dateRange: ['2005-01-04', '2026-04-15'],
  observationCount: 5549,
  indices: ['ise2', 'sp', 'dax', 'ftse', 'nikkei', 'bovespa', 'eu', 'em',
            'try_usd_ret', 'cbrt_rate', 'cbrt_delta', 'cpi_yoy', 'cds_proxy'],
};

// ── Context ───────────────────────────────────────────────────────────────────

const ModelContext = createContext<ModelContextValue | null>(null);

interface ModelProviderProps {
  children: ReactNode;
}

export const ModelProvider: React.FC<ModelProviderProps> = ({ children }) => {
  const [selectedModel, setSelectedModel] = useState<ModelSelection>('A');
  const [selectedMLModel, setSelectedMLModel] = useState<string>('RandomForest');
  const [availableMLModels, setAvailableMLModels] = useState<string[]>([
    'RandomForest', 'OLS', 'Ridge', 'XGBoost', 'LSTM', 'Ensemble',
  ]);

  const [mlModelsExtended,   setMLModelsExtended]   = useState<MLModelsExtendedData | null>(null);
  const [regimeTransitions,  setRegimeTransitions]  = useState<RegimeTransitionsData | null>(null);
  const [dtwSimilarity,      setDTWSimilarity]      = useState<DTWSimilarityData | null>(
    () => generateMockDTWSimilarity('2020-01-01', '2023-12-31')
  );
  const [correlationNetworks,  setCorrelationNetworks]  = useState<CorrelationNetworksData | null>(null);
  const [volatilityClusters,   setVolatilityClusters]   = useState<VolatilityClusteringData | null>(null);
  const [leadTimeStats,        setLeadTimeStats]        = useState<LeadTimeStatsData | null>(null);
  const [isLoadingExtendedData, setIsLoadingExtendedData] = useState(true);
  const [extendedDataError,     setExtendedDataError]     = useState<string | null>(null);

  const modelAData: CurrentModelData = useMemo(() => ({
    info:        MODEL_A_INFO,
    cleanedData: modelAClean    as CurrentModelData['cleanedData'],
    featuresData: modelAFeatures as CurrentModelData['featuresData'],
    outputsData: normalisedModelAOutputs,
    keyEvents:   MODEL_A_EVENTS,
  }), []);

  const modelBData: CurrentModelData = useMemo(() => ({
    info:        MODEL_B_INFO,
    cleanedData: modelBClean    as CurrentModelData['cleanedData'],
    featuresData: modelBFeatures as CurrentModelData['featuresData'],
    outputsData: normalisedModelBOutputs,
    keyEvents:   MODEL_B_EVENTS,
  }), []);

  const currentModelData = selectedModel === 'A' ? modelAData : modelBData;

  const lastUpdated = useMemo(() => {
    const metadata = currentModelData.featuresData.metadata as Record<string, unknown>;
    return (metadata?.live_data_through as string | undefined) ?? null;
  }, [currentModelData]);

  useEffect(() => {
    const loadExtendedData = async () => {
      setIsLoadingExtendedData(true);
      setExtendedDataError(null);
      try {
        const buildUrl = (p: string) =>
          typeof window !== 'undefined' ? new URL(p, window.location.origin).toString() : p;

        const tryFetch = async <T,>(url: string, fallback: () => T): Promise<T> => {
          try {
            const r = await fetch(buildUrl(url));
            if (!r.ok) throw new Error(`${r.status}`);
            return await r.json() as T;
          } catch {
            return fallback();
          }
        };

        const mlModels = await tryFetch<MLModelsExtendedData>(
          '/data/ml_models_extended.json',
          generateMockMLModelsExtended
        );
        setMLModelsExtended(mlModels);
        if (mlModels?.metadata?.models) {
          setAvailableMLModels(['RandomForest', 'OLS', 'Ridge', ...mlModels.metadata.models]);
        }

        const [regimes, dtw, networks, volatility, leadTime] = await Promise.all([
          tryFetch<RegimeTransitionsData>('/data/regime_transitions.json',
            () => generateMockRegimeTransitions('2020-01-01', '2023-12-31')),
          tryFetch<DTWSimilarityData>('/data/dtw_similarity.json',
            () => generateMockDTWSimilarity('2020-01-01', '2023-12-31')),
          tryFetch<CorrelationNetworksData>('/data/correlation_networks.json',
            () => generateMockCorrelationNetworks('2020-01-01', '2023-12-31')),
          tryFetch<VolatilityClusteringData>('/data/volatility_clustering.json',
            () => generateMockVolatilityClustering('2020-01-01', '2023-12-31')),
          tryFetch<LeadTimeStatsData>('/data/lead_time_stats.json',
            generateMockLeadTimeStats),
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

  const getModelPerformance = (modelId: string): ModelPerformanceMetrics | null =>
    mlModelsExtended?.performance[modelId] ?? null;

  const getRegimeTransitions = (date: string): RegimeTransitionSnapshot | null => {
    if (!regimeTransitions) return null;
    const sorted = [...regimeTransitions.transitions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const t = new Date(date).getTime();
    for (let i = sorted.length - 1; i >= 0; i--)
      if (new Date(sorted[i].date).getTime() <= t) return sorted[i];
    return sorted[0] ?? null;
  };

  const getSimilarPeriods = (date: string, topN = 5): SimilarPeriod[] => {
    if (!dtwSimilarity) return [];
    const sorted = [...dtwSimilarity.similarities].sort(
      (a, b) => new Date(a.reference_date).getTime() - new Date(b.reference_date).getTime()
    );
    const t = new Date(date).getTime();
    for (let i = sorted.length - 1; i >= 0; i--)
      if (new Date(sorted[i].reference_date).getTime() <= t)
        return sorted[i].similar_periods.slice(0, topN);
    return sorted[0]?.similar_periods.slice(0, topN) ?? [];
  };

  const getNetworkSnapshot = (date: string): NetworkSnapshot | null => {
    if (!correlationNetworks) return null;
    const sorted = [...correlationNetworks.snapshots].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const t = new Date(date).getTime();
    for (let i = sorted.length - 1; i >= 0; i--)
      if (new Date(sorted[i].date).getTime() <= t) return sorted[i];
    return sorted[0] ?? null;
  };

  const getVolatilityClusters = (dateRange: [string, string]): VolatilityCluster[] => {
    if (!volatilityClusters) return [];
    const [s, e] = dateRange.map(d => new Date(d).getTime());
    return volatilityClusters.clusters.filter(c => {
      const cs = new Date(c.start_date).getTime();
      const ce = new Date(c.end_date).getTime();
      return cs <= e && ce >= s;
    });
  };

  const getLeadTimeStats = (modelId: string): LeadTimeSummary | null =>
    leadTimeStats?.summary[modelId] ?? null;

  const value: ModelContextValue = {
    selectedModel, setSelectedModel,
    modelAData, modelBData, currentModelData,
    lastUpdated,
    selectedMLModel, setSelectedMLModel, availableMLModels,
    mlModelsExtended, regimeTransitions, dtwSimilarity,
    correlationNetworks, volatilityClusters, leadTimeStats,
    isLoadingExtendedData, extendedDataError,
    getModelPerformance, getRegimeTransitions, getSimilarPeriods,
    getNetworkSnapshot, getVolatilityClusters, getLeadTimeStats,
  };

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
};

export const useModelContext = (): ModelContextValue => {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error('useModelContext must be used within a ModelProvider');
  return ctx;
};

export default ModelContext;
