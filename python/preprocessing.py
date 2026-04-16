"""
preprocessing.py — Turkey ISE2 Pipeline (turkey branch)

Handles everything from raw CSV → scaled feature matrix ready for modelling.

Key design decisions
---------------------
1.  TARGET = ise2 (USD-based ISE return).  ISE (TL-based) is DROPPED to
    prevent data leakage: ise ≈ ise2 × forex, so including it would make
    predictions trivially easy but useless for the crisis narrative.

2.  RobustScaler instead of StandardScaler.  Daily equity returns are
    fat-tailed (kurtosis >> 3).  StandardScaler is distorted by crisis
    outliers.  RobustScaler uses median ± IQR and is robust to them.

3.  Missing value strategy: forward-fill first (market holiday carry-forward
    is the correct financial interpretation), then mean-impute any remaining
    NaNs (should be <1% of values in practice).

4.  All splits are time-aware (chronological).  No random shuffling ever.
    This file only does the 80/20 baseline split; the pipeline also does a
    hard 2018-split for Model B.

5.  The raw CSV columns beyond ise2 are treated as INPUTS, not targets.
    sp (S&P 500) is one of seven equal features, not the dominant signal.
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import RobustScaler

warnings.filterwarnings("ignore")

# ------------------------------------------------------------------ #
# Column definitions
# ------------------------------------------------------------------ #

# Raw CSV columns from Group_5.csv
RAW_DATE_COL = "date"          # date column name (varies by CSV)
TARGET_COL   = "ise2"          # USD-based ISE return = our prediction target
DROP_COLS    = ["ISE"]         # TL-based ISE — too correlated with target, causes leakage

# The 7 global market features in the original dataset
FEATURE_COLS = ["sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]

# Extended-mode additional columns (present only after fetch_extended.py)
EXT_FEATURE_COLS = [
    "try_usd_ret",    # USD/TRY daily log-return (key TL depreciation signal)
    "cbrt_rate",      # CBRT overnight rate (unorthodox cuts signal crisis)
    "cbrt_delta",     # 1-day change in CBRT rate
    "cds_proxy",      # EM CDS spread proxy (turkey risk premium)
]


# ------------------------------------------------------------------ #
# Main preprocessing function
# ------------------------------------------------------------------ #

def run(
    csv_path: Path,
    out_dir: Path = None,
    test_ratio: float = 0.20,
) -> dict:
    """
    Load, clean, and scale the raw ISE dataset.

    Returns
    -------
    dict with keys:
      df          — cleaned + scaled DataFrame (index = date)
      df_unscaled — cleaned but unscaled DataFrame (for inspection)
      scaler      — fitted RobustScaler (persist to inverse-transform preds)
      feature_cols— list of feature column names after cleaning
      meta        — provenance dict (written to preprocessing_meta.json)
    """
    print(f"[preprocessing] Loading {csv_path.name}")
    df = _load_csv(csv_path)
    print(f"[preprocessing] Raw shape: {df.shape}  "
          f"({df.index[0].date()} → {df.index[-1].date()})")

    df = _drop_leakage_cols(df)
    df = _fill_missing(df)
    feature_cols = _active_feature_cols(df)

    print(f"[preprocessing] Features: {feature_cols}")
    print(f"[preprocessing] Target  : {TARGET_COL}")
    print(f"[preprocessing] NaN after fill: {df.isnull().sum().sum()}")

    df_unscaled = df.copy()

    # Scale features + target together (RobustScaler)
    scaler = RobustScaler()
    all_numeric = feature_cols + [TARGET_COL]
    df[all_numeric] = scaler.fit_transform(df[all_numeric])

    meta = {
        "csv": str(csv_path.name),
        "n_rows": len(df),
        "n_features": len(feature_cols),
        "feature_cols": feature_cols,
        "target_col": TARGET_COL,
        "dropped_cols": DROP_COLS,
        "scaler": "RobustScaler",
        "date_range": [str(df.index[0].date()), str(df.index[-1].date())],
        "target_stats": {
            "mean":  float(df_unscaled[TARGET_COL].mean()),
            "std":   float(df_unscaled[TARGET_COL].std()),
            "min":   float(df_unscaled[TARGET_COL].min()),
            "max":   float(df_unscaled[TARGET_COL].max()),
            "kurtosis": float(df_unscaled[TARGET_COL].kurtosis()),
            "skewness":  float(df_unscaled[TARGET_COL].skew()),
        },
    }

    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        with open(out_dir / "preprocessing_meta.json", "w") as f:
            json.dump(meta, f, indent=2)
        print(f"[preprocessing] Wrote preprocessing_meta.json")

    print(f"[preprocessing] ✓ Done  |  "
          f"train ≈80%: {int(len(df)*0.8)}  test ≈20%: {int(len(df)*0.2)}")

    return {
        "df":           df,
        "df_unscaled":  df_unscaled,
        "scaler":       scaler,
        "feature_cols": feature_cols,
        "meta":         meta,
    }


# ------------------------------------------------------------------ #
# Internal helpers
# ------------------------------------------------------------------ #

def _load_csv(csv_path: Path) -> pd.DataFrame:
    """
    Load CSV robustly.  Handles:
    - 'date' or first column as index
    - Various date formats (ISO, US month/day/year)
    - Extra whitespace in column names
    """
    df = pd.read_csv(csv_path)
    df.columns = [c.strip().lower() for c in df.columns]

    # Find the date column
    date_col = None
    for candidate in ["date", "fecha", "datum", df.columns[0]]:
        if candidate in df.columns:
            date_col = candidate
            break

    df[date_col] = pd.to_datetime(df[date_col], infer_datetime_format=True)
    df = df.set_index(date_col).sort_index()

    # Normalise column names: lowercase + strip
    df.columns = [c.strip().lower() for c in df.columns]

    # Convert all columns to numeric (non-numeric become NaN)
    df = df.apply(pd.to_numeric, errors="coerce")
    return df


def _drop_leakage_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Drop ISE (TL-based) — it is derived from ise2 × exchange rate."""
    to_drop = [c for c in DROP_COLS if c.lower() in df.columns]
    if to_drop:
        df = df.drop(columns=[c.lower() for c in to_drop])
        print(f"[preprocessing] Dropped leakage columns: {to_drop}")
    # Also drop any near-duplicate columns (correlation > 0.99 with ise2)
    if TARGET_COL in df.columns:
        high_corr = [
            c for c in df.columns
            if c != TARGET_COL and abs(df[c].corr(df[TARGET_COL])) > 0.99
        ]
        if high_corr:
            df = df.drop(columns=high_corr)
            print(f"[preprocessing] Dropped near-duplicate columns: {high_corr}")
    return df


def _fill_missing(df: pd.DataFrame) -> pd.DataFrame:
    """
    Forward-fill first (correct interpretation for market holiday carry-forward),
    then mean-impute any remaining NaNs.
    """
    n_before = df.isnull().sum().sum()
    df = df.ffill()
    n_after_ffill = df.isnull().sum().sum()
    if n_after_ffill > 0:
        df = df.fillna(df.mean())
    n_after = df.isnull().sum().sum()
    if n_before > 0:
        print(f"[preprocessing] NaN fill: {n_before} → {n_after_ffill} (ffill) → {n_after} (mean)")
    return df


def _active_feature_cols(df: pd.DataFrame) -> list:
    """
    Return which of the known feature columns are actually in the DataFrame.
    Includes extended features if present (from fetch_extended.py output).
    """
    all_possible = FEATURE_COLS + EXT_FEATURE_COLS
    return [c for c in all_possible if c in df.columns]
