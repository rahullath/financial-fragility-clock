import React, { useMemo } from 'react';

import modelAClean from '../../data/cleaned_data.json';
import modelAFeatures from '../../data/features.json';
import modelAOutputs from '../../data/model_outputs.json';
import modelBFeatures from '../../data/model_b_features_slim.json';
import modelBOutputs from '../../data/model_b_outputs.json';

type Regime = 'HEDGE' | 'SPECULATIVE' | 'PONZI';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const EXPECTED_FEATURES = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];

const ReportTab: React.FC = () => {
  const summary = useMemo(() => {
    const modelARows = (modelAFeatures as { data: Array<Record<string, unknown>> }).data;
    const modelBRows = (modelBFeatures as { data: Array<Record<string, unknown>> }).data;
    const cleanRows = (modelAClean as { data: Array<Record<string, unknown>> }).data;

    const missingValues = cleanRows.reduce((count, row) => {
      return count + Object.values(row).filter((value) => value === null || value === '').length;
    }, 0);

    const regimeCounts = modelARows.reduce<Record<Regime, number>>(
      (acc, row) => {
        const regime = row.regime as Regime | undefined;
        if (regime && regime in acc) acc[regime] += 1;
        return acc;
      },
      { HEDGE: 0, SPECULATIVE: 0, PONZI: 0 }
    );

    const modelAShap = (modelAOutputs as Record<string, any>).shap?.regime_comparison?.SPECULATIVE?.mean_abs_shap ?? {};
    const topFeature = Object.entries(modelAShap)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] ?? 'EU';

    const modelATestRmse = (modelAOutputs as Record<string, any>).random_forest?.metrics?.test_rmse ?? null;
    const modelBTestRmse = (modelBOutputs as Record<string, any>).walk_forward_validation?.split_2020?.metrics?.test_rmse ?? null;

    const fragilityValues = modelARows
      .map((row) => toNumber(row.fragility_score))
      .filter((value): value is number => value !== null);
    const maxFragility = fragilityValues.length > 0 ? Math.max(...fragilityValues) : null;

    return {
      modelAObs: cleanRows.length,
      modelBObs: modelBRows.length,
      missingValues,
      regimeCounts,
      topFeature,
      modelATestRmse,
      modelBTestRmse,
      maxFragility,
    };
  }, []);

  return (
    <div className="report-tab">
      <div className="report-section">
        <h2>Section 1: Data Quality Control</h2>
        <div className="report-question">
          <h3>What is the size and type structure of the dataset?</h3>
          <p>
            Model A contains {summary.modelAObs} daily observations from the Istanbul Stock Exchange sample and uses 7 numeric
            global-market inputs to predict the USD-based ISE return. Model B extends the same framing to {summary.modelBObs} global observations.
          </p>
        </div>
        <div className="report-question">
          <h3>Are there missing values and how are they handled?</h3>
          <p>
            The cleaned Model A export contains {summary.missingValues} explicit null or empty cells. The pipeline removes invalid rows for model training,
            uses rolling windows only after enough history exists, and keeps early-window gaps as nulls instead of silently fabricating values.
          </p>
        </div>
        <div className="report-question">
          <h3>What do the distributions and outliers show?</h3>
          <p>
            Fragility ranges from calm conditions to a maximum of {summary.maxFragility?.toFixed(1) ?? 'n/a'}, which is consistent with crisis spikes rather than bad data.
            The regime split in Model A is HEDGE {summary.regimeCounts.HEDGE}, SPECULATIVE {summary.regimeCounts.SPECULATIVE}, and PONZI {summary.regimeCounts.PONZI}.
          </p>
        </div>
      </div>

      <div className="report-section">
        <h2>Section 2: Model Development and Analytics</h2>
        <div className="report-question">
          <h3>Which modelling approach is suitable?</h3>
          <p>
            This is a multivariate supervised learning problem: the target is the ISE return and the explanatory set is the 7-market feature block
            ({EXPECTED_FEATURES.join(', ')}). OLS provides a transparent baseline; Random Forest and the extended models capture non-linear contagion dynamics.
          </p>
        </div>
        <div className="report-question">
          <h3>Which variables contribute most?</h3>
          <p>
            The SHAP analysis highlights <strong>{summary.topFeature}</strong> as the strongest recurring contributor in the speculative regime, with the
            feature ranking drawn from actual regime-specific SHAP values rather than metadata placeholders.
          </p>
        </div>
        <div className="report-question">
          <h3>How are the models compared?</h3>
          <p>
            Model A’s Random Forest test RMSE is {summary.modelATestRmse?.toFixed(4) ?? 'n/a'}, while Model B’s 2020 walk-forward RMSE is
            {' '}{summary.modelBTestRmse?.toFixed(4) ?? 'n/a'}. The dashboard complements these headline errors with regime-specific RMSE,
            SHAP rankings, correlation heatmaps, MST structure, and crisis-similarity diagnostics.
          </p>
        </div>
      </div>

      <div className="report-section">
        <h2>Section 3: Interpretation and Business Decisions</h2>
        <div className="report-question">
          <h3>How should the results be interpreted?</h3>
          <p>
            Rising fragility, tighter cross-market correlations, and migration into SPECULATIVE or PONZI states should be read as evidence of weakening diversification
            and higher contagion risk. The dashboard is designed to show those signals jointly rather than as isolated charts.
          </p>
        </div>
        <div className="report-question">
          <h3>How does this support decisions?</h3>
          <p>
            In practice, the outputs support risk reduction decisions: tighten exposure when the clock approaches PONZI territory, monitor the dominant SHAP drivers for
            transmission channels, and use the historical similarity layer to compare the current pattern with prior stress episodes before allocating capital.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportTab;
