import React, { useMemo } from 'react';
import { useModelContext } from '../contexts/ModelContext';
import { exportChart } from '../utils/exportChart';
import './ModelPerformanceTable.css';

interface MetricRow {
  model: string;
  // Classification metrics (Model A — v2 pipeline)
  accuracy: number | null;
  roc_auc: number | null;
  cv_auc_mean: number | null;
  avg_lead_time_days: number | null;
  // Regression metrics (Model B — walk-forward)
  r2: number | null;
  rmse: number | null;
  mae: number | null;
  hedge_rmse: number | null;
  spec_rmse: number | null;
  ponzi_rmse: number | null;
}

interface RegimeMetric {
  rmse?: number | null;
  mae?: number | null;
  r2?: number | null;
}

function fmt(v: number | null, d = 4): string {
  return v != null ? v.toFixed(d) : '—';
}

function fmtPct(v: number | null): string {
  return v != null ? `${(v * 100).toFixed(1)}%` : '—';
}

/** Return true if `a` is a "better" value for a metric */
function isBetter(metric: string, a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false;
  if (metric === 'r2' || metric === 'accuracy' || metric === 'roc_auc' || metric === 'cv_auc_mean') return a > b;
  return a < b; // rmse, mae, regime_rmse
}

/**
 * ModelPerformanceTable
 *
 * Model A (classification v2): shows LogisticRegression vs RandomForest
 * with Accuracy and ROC-AUC columns. PONZI callout fires when RF beats LR.
 *
 * Model B (regression walk-forward): unchanged — split_2020 RMSE/R² table.
 *
 * Requirements: 18.1–18.6, 36.2
 */
const ModelPerformanceTable: React.FC = () => {
  const { currentModelData } = useModelContext();
  const outputs = currentModelData.outputsData;

  const isClassification = !!(outputs['logistic_regression'] || outputs['random_forest']?.['metrics']?.['roc_auc']);

  const { rows, ponziCallout, isClassif } = useMemo<{
    rows: MetricRow[];
    ponziCallout: boolean;
    isClassif: boolean;
  }>(() => {
    // ── Model A — classification pipeline (v2) ───────────────────────────────
    if (currentModelData.info.id === 'A' && isClassification) {
      const lr = outputs['logistic_regression'] as
        | { metrics: Record<string, number | null> }
        | undefined;
      const rf = outputs['random_forest'] as
        | { metrics: Record<string, number | null>; feature_importance: Record<string, number> }
        | undefined;
      const comparison = outputs['comparison'] as
        | { ponzi_validation?: { rf_better?: boolean } | boolean }
        | undefined;

      const mkRow = (
        name: string,
        metrics: Record<string, number | null> | undefined
      ): MetricRow => ({
        model: name,
        accuracy:    (metrics?.['accuracy'] as number | null) ?? null,
        roc_auc:     (metrics?.['roc_auc']  as number | null) ?? null,
        cv_auc_mean: (metrics?.['cv_auc_mean'] as number | null) ?? null,
        avg_lead_time_days: (metrics?.['avg_lead_time_days'] as number | null) ?? null,
        r2: null, rmse: null, mae: null,
        hedge_rmse: null, spec_rmse: null, ponzi_rmse: null,
      });

      let ponziOk = false;
      const pv = comparison?.ponzi_validation;
      if (typeof pv === 'boolean') ponziOk = pv;
      else if (pv && typeof pv === 'object') ponziOk = !!(pv as {rf_better?: boolean}).rf_better;

      return {
        rows: [
          mkRow('Logistic Regression', lr?.metrics),
          mkRow('Random Forest', rf?.metrics),
        ],
        ponziCallout: ponziOk,
        isClassif: true,
      };
    }

    // ── Model A — legacy regression branch (fallback if old JSON) ────────────
    if (currentModelData.info.id === 'A') {
      const normalizedModelMetrics = outputs['model_regime_metrics'] as
        | Record<string, Record<string, RegimeMetric>>
        | undefined;
      const normalizedRegimeMetrics = outputs['regime_metrics'] as
        | Record<string, RegimeMetric>
        | undefined;

      const getRegimeRmse = (
        modelKey: string,
        regime: 'HEDGE' | 'SPECULATIVE' | 'PONZI',
        fallback?: Record<string, number>
      ): number | null => {
        const n = normalizedModelMetrics?.[modelKey]?.[regime]?.rmse;
        if (n != null) return n;
        const a = normalizedRegimeMetrics?.[regime]?.rmse;
        if (a != null && modelKey === 'RandomForest') return a;
        return fallback?.[regime] ?? null;
      };

      const olsOut = outputs['ols'] as
        | { metrics: Record<string, number>; regime_rmse: Record<string, number> }
        | undefined;
      const rfOut = outputs['random_forest'] as
        | { metrics: Record<string, number>; regime_rmse: Record<string, number> }
        | undefined;
      const comparison = outputs['comparison'] as
        | { ponzi_validation: boolean }
        | undefined;

      const mkRow = (
        name: string,
        key: string,
        metrics: Record<string, number> | undefined,
        rrmse: Record<string, number> | undefined
      ): MetricRow => ({
        model: name,
        accuracy: null, roc_auc: null, cv_auc_mean: null, avg_lead_time_days: null,
        r2:    metrics?.['test_r2']   ?? metrics?.['r2']   ?? null,
        rmse:  metrics?.['test_rmse'] ?? metrics?.['rmse'] ?? null,
        mae:   metrics?.['test_mae']  ?? metrics?.['mae']  ?? null,
        hedge_rmse: getRegimeRmse(key, 'HEDGE', rrmse),
        spec_rmse:  getRegimeRmse(key, 'SPECULATIVE', rrmse),
        ponzi_rmse: getRegimeRmse(key, 'PONZI', rrmse),
      });

      return {
        rows: [
          mkRow('OLS', 'OLS', olsOut?.metrics, olsOut?.regime_rmse),
          mkRow('Random Forest', 'RandomForest', rfOut?.metrics, rfOut?.regime_rmse),
        ],
        ponziCallout: comparison?.ponzi_validation ?? false,
        isClassif: false,
      };
    }

    // ── Model B — regression walk-forward ────────────────────────────────────
    const normalizedModelMetrics = outputs['model_regime_metrics'] as
      | Record<string, Record<string, RegimeMetric>>
      | undefined;
    const normalizedRegimeMetrics = outputs['regime_metrics'] as
      | Record<string, RegimeMetric>
      | undefined;

    const getModelRegimeRmse = (
      modelKey: string,
      regime: 'HEDGE' | 'SPECULATIVE' | 'PONZI',
      fallback?: Record<string, number>
    ): number | null => {
      const n = normalizedModelMetrics?.[modelKey]?.[regime]?.rmse;
      if (n != null) return n;
      const a = normalizedRegimeMetrics?.[regime]?.rmse;
      if (a != null && modelKey === 'RandomForest') return a;
      return fallback?.[regime] ?? null;
    };

    const wf = outputs['walk_forward_validation'] as
      | Record<string, Record<string, unknown>>
      | undefined;
    const split = wf?.['split_2020'] ?? wf?.['split_2008'];
    if (!split) return { rows: [], ponziCallout: false, isClassif: false };

    const metrics = split['metrics'] as Record<string, number> | undefined;
    const rrmse = split['regime_rmse'] as Record<string, number> | undefined;

    const rfRow: MetricRow = {
      model: 'Random Forest (WF)',
      accuracy: null, roc_auc: null, cv_auc_mean: null, avg_lead_time_days: null,
      r2:    metrics?.['test_r2']   ?? null,
      rmse:  metrics?.['test_rmse'] ?? null,
      mae:   metrics?.['test_mae']  ?? null,
      hedge_rmse: getModelRegimeRmse('RandomForest', 'HEDGE', rrmse),
      spec_rmse:  getModelRegimeRmse('RandomForest', 'SPECULATIVE', rrmse),
      ponzi_rmse: getModelRegimeRmse('RandomForest', 'PONZI', rrmse),
    };

    const s8 = wf?.['split_2008'];
    const s8rrmse = s8?.['regime_rmse'] as Record<string, number> | undefined;
    const rfPonzi = rfRow.ponzi_rmse;
    const olsPonzi = s8rrmse?.['PONZI'] ?? null;
    const ponziCallout = rfPonzi != null && olsPonzi != null ? rfPonzi < olsPonzi : false;

    return { rows: [rfRow], ponziCallout, isClassif: false };
  }, [currentModelData, outputs, isClassification]);

  // Column definitions differ by pipeline type
  const cols: Array<{ key: keyof MetricRow; label: string; metric: string; fmt: (v: number | null) => string }> =
    isClassif
      ? [
          { key: 'accuracy',    label: 'Accuracy',    metric: 'accuracy',    fmt: fmtPct },
          { key: 'roc_auc',     label: 'ROC-AUC',     metric: 'roc_auc',     fmt: (v) => fmt(v, 4) },
          { key: 'cv_auc_mean', label: 'CV ROC-AUC',  metric: 'cv_auc_mean', fmt: (v) => fmt(v, 4) },
          { key: 'avg_lead_time_days', label: 'Avg Lead Time', metric: 'avg_lead_time_days', fmt: (v) => v != null ? `${v.toFixed(0)} days` : '—' },
        ]
      : [
          { key: 'r2',         label: 'R²',         metric: 'r2',   fmt: (v) => fmt(v, 4) },
          { key: 'rmse',       label: 'RMSE',       metric: 'rmse', fmt: (v) => fmt(v, 4) },
          { key: 'mae',        label: 'MAE',        metric: 'mae',  fmt: (v) => fmt(v, 4) },
          { key: 'hedge_rmse', label: 'HEDGE RMSE', metric: 'rmse', fmt: (v) => fmt(v, 4) },
          { key: 'spec_rmse',  label: 'SPEC RMSE',  metric: 'rmse', fmt: (v) => fmt(v, 4) },
          { key: 'ponzi_rmse', label: 'PONZI RMSE', metric: 'rmse', fmt: (v) => fmt(v, 4) },
        ];

  return (
    <div className="perf-table-wrapper" data-testid="model-performance-table" id="chart-model-perf" aria-label="Model performance comparison">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="perf-table-title">Model Performance</div>
        <button 
          onClick={() => exportChart('chart-model-perf', 'model_performance')}
          style={{ fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer', marginBottom: '8px' }}
        >
          Export PNG
        </button>
      </div>
      <div className="perf-table-scroll">
        <table className="perf-table">
          <thead>
            <tr>
              <th>Model</th>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'alt-row' : ''}>
                <td className="model-name">{row.model}</td>
                {cols.map((col) => {
                  const val = row[col.key] as number | null;
                  const other = rows.find((_r, i) => i !== ri)?.[col.key] as
                    | number
                    | null;
                  const best = isBetter(col.metric, val, other);
                  return (
                    <td
                      key={col.key}
                      className={best ? 'best-cell' : ''}
                    >
                      {col.fmt(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ponziCallout && (
        <div className="ponzi-callout" role="alert">
          ✓ RF outperforms {isClassif ? 'Logistic Regression' : 'OLS'} in PONZI regime — Minsky framework validated.
        </div>
      )}
    </div>
  );
};

export default ModelPerformanceTable;
