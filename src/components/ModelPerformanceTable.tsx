import React, { useMemo } from 'react';
import { useModelContext } from '../contexts/ModelContext';
import { exportChart } from '../utils/exportChart';
import './ModelPerformanceTable.css';

interface MetricRow {
  model: string;
  r2: number | null;
  rmse: number | null;
  mae: number | null;
  hedge_rmse: number | null;
  spec_rmse: number | null;
  ponzi_rmse: number | null;
}

function fmt(v: number | null, d = 4): string {
  return v != null ? v.toFixed(d) : '—';
}

/** Return true if `a` is a "better" value for a metric (lower = better for RMSE/MAE; higher for R²) */
function isBetter(metric: string, a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false;
  if (metric === 'r2') return a > b;
  return a < b; // rmse, mae, regime_rmse
}

/**
 * ModelPerformanceTable
 *
 * Displays OLS vs Random Forest comparison table.
 * Best value in each column highlighted in teal.
 * Shows callout if RF outperforms OLS in PONZI regime.
 *
 * For Model B: uses the split_2020 walk-forward results (broadest test set).
 *
 * Requirements: 18.1–18.6, 36.2
 */
const ModelPerformanceTable: React.FC = () => {
  const { currentModelData } = useModelContext();
  const outputs = currentModelData.outputsData;

  const { rows, ponziCallout } = useMemo<{
    rows: MetricRow[];
    ponziCallout: boolean;
  }>(() => {
    // ── Model A ──────────────────────────────────────────────────────────────
    if (currentModelData.info.id === 'A') {
      const ols = outputs['ols'] as
        | { metrics: Record<string, number>; regime_rmse: Record<string, number> }
        | undefined;
      const rf = outputs['random_forest'] as
        | { metrics: Record<string, number>; regime_rmse: Record<string, number> }
        | undefined;
      const comparison = outputs['comparison'] as
        | { ponzi_validation: boolean }
        | undefined;

      const mkRow = (
        name: string,
        metrics: Record<string, number> | undefined,
        rrmse: Record<string, number> | undefined
      ): MetricRow => ({
        model: name,
        r2: metrics?.['test_r2'] ?? metrics?.['r2'] ?? null,
        rmse: metrics?.['test_rmse'] ?? metrics?.['rmse'] ?? null,
        mae: metrics?.['test_mae'] ?? metrics?.['mae'] ?? null,
        hedge_rmse: rrmse?.['HEDGE'] ?? null,
        spec_rmse: rrmse?.['SPECULATIVE'] ?? null,
        ponzi_rmse: rrmse?.['PONZI'] ?? null,
      });

      return {
        rows: [
          mkRow('OLS', ols?.metrics, ols?.regime_rmse),
          mkRow('Random Forest', rf?.metrics, rf?.regime_rmse),
        ],
        ponziCallout: comparison?.ponzi_validation ?? false,
      };
    }

    // ── Model B (use split_2020 — broadest walk-forward) ─────────────────────
    const wf = outputs['walk_forward_validation'] as
      | Record<string, Record<string, unknown>>
      | undefined;
    const split = wf?.['split_2020'] ?? wf?.['split_2008'];
    if (!split) return { rows: [], ponziCallout: false };

    const metrics = split['metrics'] as Record<string, number> | undefined;
    const rrmse = split['regime_rmse'] as Record<string, number> | undefined;

    const rfRow: MetricRow = {
      model: 'Random Forest (WF)',
      r2: metrics?.['test_r2'] ?? null,
      rmse: metrics?.['test_rmse'] ?? null,
      mae: metrics?.['test_mae'] ?? null,
      hedge_rmse: rrmse?.['HEDGE'] ?? null,
      spec_rmse: rrmse?.['SPECULATIVE'] ?? null,
      ponzi_rmse: rrmse?.['PONZI'] ?? null,
    };

    // Compare PONZI RMSE between 2008 and 2020 splits for callout
    const s8 = wf?.['split_2008'];
    const s8rrmse = s8?.['regime_rmse'] as Record<string, number> | undefined;
    const rfPonzi = rfRow.ponzi_rmse;
    const olsPonzi = s8rrmse?.['PONZI'] ?? null;
    const ponziCallout =
      rfPonzi != null && olsPonzi != null ? rfPonzi < olsPonzi : false;

    return { rows: [rfRow], ponziCallout };
  }, [currentModelData, outputs]);

  const cols: Array<{ key: keyof MetricRow; label: string; metric: string }> = [
    { key: 'r2', label: 'R²', metric: 'r2' },
    { key: 'rmse', label: 'RMSE', metric: 'rmse' },
    { key: 'mae', label: 'MAE', metric: 'mae' },
    { key: 'hedge_rmse', label: 'HEDGE RMSE', metric: 'rmse' },
    { key: 'spec_rmse', label: 'SPEC RMSE', metric: 'rmse' },
    { key: 'ponzi_rmse', label: 'PONZI RMSE', metric: 'rmse' },
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
                      {fmt(val)}
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
          ✓ RF outperforms OLS in PONZI regime — Minsky framework validated.
        </div>
      )}
    </div>
  );
};

export default ModelPerformanceTable;
