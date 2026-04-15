"""
target_engineering.py — Turkey ISE2 Pipeline (turkey branch)

Builds BOTH target types used across the pipeline:

1. Regression target   : raw ise2 daily return (already in dataset)
   Used by: OLS, Ridge, Random Forest (regressor), XGBoost (regressor)

2. Classification target : binary crisis label
   Definition: a "crisis day" is a day where the forward 20-day cumulative
   ISE2 return drops below -2 standard deviations of the full rolling 60-day
   return distribution.  This is regime-aware — it adapts to the
   volatility environment rather than using a fixed threshold.

   Concretely:
     crisis_label_t = 1  if  sum(ise2[t+1:t+21]) < mu_60 - 2*sigma_60
                     0  otherwise

   Used by: Random Forest (classifier), XGBoost (classifier),
            and for the Fragility Score (probability output * 100)

Turkey-specific crisis dates for validation annotation:
  2018-08: TL currency crisis (USD/TRY peak)
  2021-12: Surprise rate cuts → TL collapse
  2023-02: Earthquake + economic shock
  2024-01: Disinflation shock
"""

import pandas as pd
import numpy as np

# Known Turkey crisis windows for dashboard annotation
TURKEY_CRISIS_WINDOWS = [
    {"label": "2018 Currency Crisis",    "start": "2018-03-01", "end": "2018-12-31", "severity": "severe"},
    {"label": "COVID Shock",             "start": "2020-02-01", "end": "2020-06-30", "severity": "moderate"},
    {"label": "2021 Rate Cut Shock",     "start": "2021-09-01", "end": "2022-01-31", "severity": "severe"},
    {"label": "2023 Earthquake Shock",   "start": "2023-02-01", "end": "2023-05-31", "severity": "moderate"},
    {"label": "2024 Disinflation Shock", "start": "2024-01-01", "end": "2024-04-30", "severity": "mild"},
]


def build_regression_target(df: pd.DataFrame) -> pd.Series:
    """Return the raw ise2 series as the regression target."""
    return df["ise2"].copy()


def build_crisis_label(
    ise2: pd.Series,
    forward_window: int = 20,
    sigma_multiplier: float = 2.0,
    rolling_window: int = 60,
) -> pd.Series:
    """
    Binary crisis label based on forward cumulative ISE2 return.

    Parameters
    ----------
    ise2            : Raw daily ISE2 return series (NOT cumulative).
    forward_window  : Days ahead to sum returns (default 20 trading days ≈ 1 month).
    sigma_multiplier: How many std deviations below rolling mean = "crisis".
    rolling_window  : Window for rolling mean/std baseline.

    Returns
    -------
    pd.Series of int (0/1), same index as ise2.
    Last `forward_window` rows will be NaN and should be dropped before training.
    """
    # Forward cumulative return over `forward_window` days
    fwd_cum = ise2.rolling(forward_window).sum().shift(-forward_window)

    # Rolling baseline (mean and std of forward return distribution)
    roll_mean = fwd_cum.rolling(rolling_window, min_periods=20).mean()
    roll_std  = fwd_cum.rolling(rolling_window, min_periods=20).std()

    # Crisis if forward return is more than sigma_multiplier std devs below mean
    threshold = roll_mean - sigma_multiplier * roll_std
    label = (fwd_cum < threshold).astype(float)
    label[fwd_cum.isna()] = np.nan

    n_crisis = int(label.dropna().sum())
    n_total  = int(label.dropna().count())
    pct = n_crisis / n_total * 100 if n_total else 0
    print(
        f"[target_engineering] Crisis labels: {n_crisis}/{n_total}  ({pct:.1f}%)  "
        f"| forward={forward_window}d  sigma={sigma_multiplier}x"
    )
    return label


def attach_labels(df: pd.DataFrame, forward_window: int = 20) -> pd.DataFrame:
    """
    Add 'crisis_label' column to df in-place.
    Rows where label is NaN (tail of series) are dropped.
    """
    df = df.copy()
    df["crisis_label"] = build_crisis_label(df["ise2"], forward_window=forward_window)
    before = len(df)
    df = df.dropna(subset=["crisis_label"])
    df["crisis_label"] = df["crisis_label"].astype(int)
    print(f"[target_engineering] Dropped {before - len(df)} tail rows (unlabelled future window)")
    return df


def crisis_stats(label: pd.Series) -> dict:
    """Return a stats dict for dashboard metadata."""
    vc = label.value_counts()
    return {
        "n_crisis":  int(vc.get(1, 0)),
        "n_normal":  int(vc.get(0, 0)),
        "crisis_pct": float(vc.get(1, 0) / len(label) * 100),
    }
