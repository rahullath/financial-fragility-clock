"""
target_engineering.py — Turkey ISE2 Pipeline (turkey branch)

Creates the binary crisis_label used for classification models, and
provides Turkey Crisis metadata for dashboard annotations.

crisis_label definition
------------------------
A day is labelled as a crisis day (1) if at any point in the next
`forward_window` trading days, the ISE2 return falls below -2 standard
deviations (computed on a rolling 60-day window).

This is a FORWARD-LOOKING label from the prediction standpoint — i.e.,
"given today's features, will a stress event occur in the next N days?"
This framing is appropriate for early-warning system models.

Why -2 sigma (rolling)?
- -2 sigma captures the bottom ~2.5% of the return distribution
- Rolling 60d window adapts to changing market regimes
- Daily returns are fat-tailed; a fixed threshold would miss regime-dependent crises
- Base rate ~4-8%, which is sufficient for classifier training with class_weight balancing

Turkey Crisis windows (hard-coded for annotation, NOT used in feature creation)
---------------------------------------------------------------------------------
These are reference dates for dashboard visualisation only.  The model
learns from patterns, not from these labels directly.
"""

import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ------------------------------------------------------------------ #
# Turkey crisis window annotations
# Used for: dashboard shaded bands, meta.crisis_windows in JSON output
# ------------------------------------------------------------------ #

TURKEY_CRISIS_WINDOWS = [
    {
        "id":    "2018_currency_crisis",
        "label": "TL Currency Crisis",
        "start": "2018-08-01",
        "end":   "2018-11-30",
        "desc":  "TRY lost 45% vs USD in 2018 amid US sanctions, "
                 "Erdogan's anti-rate-hike stance, and current account deficit.",
    },
    {
        "id":    "2021_rate_cut_shock",
        "label": "CBRT Rate Cut Shock",
        "start": "2021-09-01",
        "end":   "2022-02-28",
        "desc":  "CBRT cut rates 500bp while inflation exceeded 80%, causing "
                 "TRY collapse and ISE USD returns to crater despite nominal gains.",
    },
    {
        "id":    "2023_earthquake_aftermath",
        "label": "Earthquake + Election Uncertainty",
        "start": "2023-02-01",
        "end":   "2023-06-30",
        "desc":  "February 2023 earthquake (46,000 deaths, $34B damage) "
                 "combined with May 2023 election uncertainty.",
    },
    {
        "id":    "2024_continued_tightening",
        "label": "Post-Election Orthodox Tightening",
        "start": "2023-06-01",
        "end":   "2024-12-31",
        "desc":  "Return to orthodox monetary policy (rates raised to 50%) "
                 "stabilises TRY but squeezes equity valuations.",
    },
]


# ------------------------------------------------------------------ #
# Label creator
# ------------------------------------------------------------------ #

def attach_labels(
    df: pd.DataFrame,
    forward_window: int = 20,
    sigma_threshold: float = 2.0,
    rolling_window: int = 60,
) -> pd.DataFrame:
    """
    Attach a binary crisis_label column to the DataFrame.

    Parameters
    ----------
    df              : DataFrame with ise2 column
    forward_window  : number of future trading days to look ahead (default 20 ≋ 1 month)
    sigma_threshold : how many rolling sigma below mean counts as crisis (default 2.0)
    rolling_window  : window for rolling mean + std computation (default 60 days)

    Returns
    -------
    DataFrame with new `crisis_label` column (int 0/1).
    The last `forward_window` rows will be labelled 0 (no future data).
    """
    df = df.copy()

    ise2 = df["ise2"]

    # Rolling stats on the UNSHIFTED series (uses past data only per row)
    rolling_mean = ise2.rolling(rolling_window, min_periods=20).mean()
    rolling_std  = ise2.rolling(rolling_window, min_periods=20).std()

    # Crisis threshold: mean - sigma_threshold * std
    crisis_floor = rolling_mean - sigma_threshold * rolling_std

    # A day is a 'stress day' if ise2 falls below the crisis floor
    is_stress = (ise2 < crisis_floor).astype(int)

    # Forward-looking label: 1 if any stress day occurs in next forward_window days
    # Use a rolling max on the reversed series to look forward without leakage
    label = (
        is_stress
        .iloc[::-1]
        .rolling(forward_window, min_periods=1)
        .max()
        .iloc[::-1]
        .astype(int)
    )

    # Zero out the last forward_window rows (no valid future window)
    label.iloc[-forward_window:] = 0

    df["crisis_label"] = label.values

    base_rate = label.mean()
    print(f"[target_eng] crisis_label base rate: {base_rate:.2%}  "
          f"(forward_window={forward_window}d, threshold=-{sigma_threshold}σ rolling {rolling_window}d)")

    return df


def crisis_stats(y_series: pd.Series) -> dict:
    """
    Summary statistics about the crisis label distribution.
    Used for the dashboard 'dataset overview' panel.
    """
    total   = len(y_series)
    n_crisis = int(y_series.sum())
    n_normal = total - n_crisis
    return {
        "total_days":   total,
        "crisis_days":  n_crisis,
        "normal_days":  n_normal,
        "base_rate":    float(n_crisis / total) if total > 0 else 0.0,
        "imbalance_ratio": float(n_normal / n_crisis) if n_crisis > 0 else None,
    }
