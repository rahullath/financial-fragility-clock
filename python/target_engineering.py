"""
target_engineering.py — Turkey ISE2 Pipeline (turkey branch)

Builds forward-looking crisis labels for classification models.

Design
------
- Target: ise2 (ISE in USD = log( BIST100_TRY * TRY/USD ) daily return)
- Crisis label: 1 if cumulative ise2 return < threshold in next `horizon` days
- Default: horizon=20, threshold=-0.02 (-2% cumulative)

This is intentionally tighter than naive -5% or -10% thresholds.
The goal is to detect the ONSET of fragility (Minsky SPECULATIVE→PONZI
transition), not wait for a full crash to be evident.

Turkey Crisis Windows
---------------------
Used for annotation on dashboard charts and for per-window accuracy reporting.
"""

import warnings
from typing import Optional

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ── Target configuration ──────────────────────────────────────────────────
DEFAULT_HORIZON   = 20     # trading days
DEFAULT_THRESHOLD = -0.02  # cumulative log-return threshold

# ── Turkey crisis windows (for dashboard annotations) ─────────────────────
TURKEY_CRISIS_WINDOWS = [
    {"label": "GFC",                "start": "2008-01-01", "end": "2009-06-30"},
    {"label": "2013 Taper Tantrum", "start": "2013-05-01", "end": "2013-12-31"},
    {"label": "2016 Coup Attempt",  "start": "2016-07-01", "end": "2016-12-31"},
    {"label": "2018 TL Collapse",   "start": "2018-01-01", "end": "2019-06-30"},
    {"label": "COVID",              "start": "2020-02-01", "end": "2020-12-31"},
    {"label": "2021 Rate Cut Shock","start": "2021-09-01", "end": "2022-06-30"},
    {"label": "2023 Earthquake",    "start": "2023-02-01", "end": "2023-06-30"},
]


def create_crash_target(
    df: pd.DataFrame,
    col: str = "ise2",
    horizon: int = DEFAULT_HORIZON,
    threshold: float = DEFAULT_THRESHOLD,
) -> pd.Series:
    """
    Create forward-looking binary crash target.

    Parameters
    ----------
    df        : DataFrame with date index and ise2 column
    col       : column name for ISE USD return (default: 'ise2')
    horizon   : look-ahead window in trading days (default: 20)
    threshold : cumulative log-return threshold (default: -0.02)

    Returns
    -------
    pd.Series of {0, 1} — 1 = crisis imminent, 0 = normal
    Last `horizon` rows will be NaN (no future to look at)
    """
    future_ret = df[col].rolling(window=horizon).sum().shift(-horizon)
    label = (future_ret < threshold).astype(float)  # float to preserve NaN
    label[future_ret.isna()] = np.nan
    label.name = "crash_label"
    return label


def attach_labels(
    df: pd.DataFrame,
    col: str = "ise2",
    forward_window: int = DEFAULT_HORIZON,
    threshold: float = DEFAULT_THRESHOLD,
) -> pd.DataFrame:
    """
    Attach crash_label column to DataFrame in-place.
    Drops rows where label is NaN (tail of series).
    """
    df = df.copy()
    df["crash_label"] = create_crash_target(df, col=col, horizon=forward_window, threshold=threshold)
    df = df.dropna(subset=["crash_label"])
    df["crash_label"] = df["crash_label"].astype(int)
    return df


def crisis_stats(y: pd.Series) -> dict:
    """
    Summary statistics about the crisis label distribution.
    Used by train_pipeline.py to populate dashboard metadata.
    """
    n_total  = int(len(y))
    n_crisis = int(y.sum())
    n_normal = n_total - n_crisis
    return {
        "n_total":        n_total,
        "n_crisis":       n_crisis,
        "n_normal":       n_normal,
        "crisis_rate":    float(n_crisis / n_total) if n_total > 0 else 0.0,
        "class_balance":  f"{n_normal}:{n_crisis} (normal:crisis)",
    }


def label_crisis_windows(
    df: pd.DataFrame,
    windows: Optional[list] = None,
) -> pd.Series:
    """
    Create a string-label series marking each date with its crisis window name.
    Returns 'Normal' for dates outside all crisis windows.

    Used for per-regime accuracy breakdown in the dashboard.
    """
    if windows is None:
        windows = TURKEY_CRISIS_WINDOWS

    labels = pd.Series("Normal", index=df.index, name="crisis_window")
    for w in windows:
        mask = (df.index >= w["start"]) & (df.index <= w["end"])
        labels[mask] = w["label"]
    return labels


def minsky_regime(
    fragility_score: pd.Series,
    hedge_upper: float = 33.0,
    ponzi_lower: float = 67.0,
) -> pd.Series:
    """
    Map a fragility score (0-100) to a Minsky regime label.

    0-33    → HEDGE        (stable, self-sustaining)
    33-67   → SPECULATIVE  (borrowing to service debt)
    67-100  → PONZI        (borrowing to repay principal — crisis zone)

    Threshold values are configurable.
    """
    conditions = [
        fragility_score < hedge_upper,
        (fragility_score >= hedge_upper) & (fragility_score < ponzi_lower),
    ]
    choices = ["HEDGE", "SPECULATIVE"]
    regime = pd.Series(
        np.select(conditions, choices, default="PONZI"),
        index=fragility_score.index,
        name="minsky_regime",
    )
    return regime
