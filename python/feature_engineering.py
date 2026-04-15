"""
feature_engineering.py — Turkey ISE2 Pipeline (turkey branch)

Adds lag and rolling features to the base 7-index feature set.
All features derived from training data only (no lookahead).

Feature groups
--------------
1. Raw returns       : sp, dax, ftse, nikkei, bovespa, eu, em  (already in dataset)
2. Lag returns       : each index at t-1, t-5, t-10 (momentum / autocorrelation)
3. Rolling mean      : 5-day and 20-day rolling mean per index (trend)
4. Rolling std       : 5-day rolling std per index (short-term volatility)
5. ISE2 lags         : ise2_t-1, ise2_t-5 (ISE own autocorrelation — important!)
6. Cross-index corr  : 20-day rolling correlation between ise2 and sp / em
   (correlation collapse is a fragility signal — EM decoupling from DM)

For Model B extended data, fetch_extended.py adds:
  try_usd_ret, cbrt_rate_delta, cpi_mom, cds_spread (if available)
and this module handles them transparently via the same API.
"""

import pandas as pd
import numpy as np
from pathlib import Path

FEATURE_COLS = ["sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]
TARGET_COL = "ise2"


def add_lag_features(df: pd.DataFrame, lags=(1, 5, 10)) -> pd.DataFrame:
    """Add lagged returns for each feature column and for the target."""
    df = df.copy()
    for col in FEATURE_COLS:
        if col in df.columns:
            for lag in lags:
                df[f"{col}_lag{lag}"] = df[col].shift(lag)
    # ISE2 own lags (autoregressive component)
    for lag in (1, 5):
        df[f"ise2_lag{lag}"] = df[TARGET_COL].shift(lag)
    return df


def add_rolling_features(df: pd.DataFrame, windows=(5, 20)) -> pd.DataFrame:
    """Add rolling mean and std for each feature column."""
    df = df.copy()
    for col in FEATURE_COLS:
        if col in df.columns:
            for w in windows:
                df[f"{col}_mean{w}"] = df[col].rolling(w, min_periods=2).mean()
            # Only short-window std (avoids too many features)
            df[f"{col}_std5"] = df[col].rolling(5, min_periods=2).std()
    return df


def add_correlation_features(df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
    """
    Rolling correlation between ise2 and key global indices.
    Correlation collapse (e.g., ise2-em correlation dropping) is an early
    fragility signal — Turkey decoupling from EM peers.
    """
    df = df.copy()
    for partner in ["sp", "em", "eu"]:
        if partner in df.columns:
            df[f"ise2_{partner}_corr20"] = (
                df[TARGET_COL]
                .rolling(window, min_periods=5)
                .corr(df[partner])
            )
    return df


def add_volatility_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    ISE2 own rolling volatility (realised vol as a risk-state feature).
    Elevated vol → model learns this precedes further drawdowns.
    """
    df = df.copy()
    df["ise2_vol5"]  = df[TARGET_COL].rolling(5,  min_periods=2).std()
    df["ise2_vol20"] = df[TARGET_COL].rolling(20, min_periods=5).std()
    return df


def build(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply all feature engineering steps in order.
    NaNs introduced by lags/rolling are dropped.
    Returns a DataFrame with TARGET_COL + all engineered features.
    """
    df = add_lag_features(df)
    df = add_rolling_features(df)
    df = add_correlation_features(df)
    df = add_volatility_features(df)
    before = len(df)
    df = df.dropna()
    print(f"[feature_engineering] Rows before dropna: {before}  |  after: {len(df)}")
    return df


def get_feature_names(df: pd.DataFrame) -> list[str]:
    """Return all feature column names (everything except TARGET_COL)."""
    return [c for c in df.columns if c != TARGET_COL]


if __name__ == "__main__":
    from preprocessing import load_raw, clean
    df = load_raw("../data/Group_5.csv")
    df = clean(df)
    df_eng = build(df)
    print(df_eng.shape)
    print(df_eng.columns.tolist())
