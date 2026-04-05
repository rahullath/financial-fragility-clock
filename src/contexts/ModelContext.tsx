import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
} from 'react';

// ── Static JSON imports ───────────────────────────────────────────────────────
// Model A — ISE 2009-2011 (536 obs)
import modelAClean from '../data/cleaned_data.json';
import modelAFeatures from '../data/features.json';
import modelAOutputs from '../data/model_outputs.json';

// Model B — Global 2003-2025 (5984 obs)
import modelBClean from '../data/model_b_cleaned_data.json';
import modelBFeatures from '../data/model_b_features.json';
import modelBOutputs from '../data/model_b_outputs.json';

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
 * Requirements: 36.1, 36.2
 */
export const ModelProvider: React.FC<ModelProviderProps> = ({ children }) => {
  const [selectedModel, setSelectedModel] = useState<ModelSelection>('A');

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

  const value: ModelContextValue = {
    selectedModel,
    setSelectedModel,
    modelAData,
    modelBData,
    currentModelData,
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
