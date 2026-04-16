"""
feature_engineering.py — Turkey ISE2 Pipeline (turkey branch)

Transforms a cleaned DataFrame (from preprocessing.py) into a richer
feature matrix for modelling.

Feature groups
--------------
1.  Raw global index returns (sp, dax, ftse, nikkei, bovespa, eu, em)
    All 7 treated symmetrically — no special-casing of S&P 500.

2.  Momentum features (rolling means)
    5-day and 20-day rolling mean return for each index.
    Captures short-term momentum vs. medium-term trend reversal.

3.  Lagged ISE2 returns (autoregressive features)
    t-1, t-5, t-10 lags of the ISE2 return.
    Turkey's market has autocorrelated daily returns during crises.

4.  Divergence features (ISE2 vs each global index)
    ISE2_ret - index_ret for each index.
    When Turkey decouples from peers, this divergence spikes — key crisis signal.

5.  Rolling correlation decay (ISE2 vs each index, 20d window)
    Correlation breakdown is a fragility signal.
    Low or sign-flipping correlations precede contagion.

6.  Realised volatility of ISE2 (20d rolling std)
    Regime-change indicator; spikes during crisis entry/exit.

7.  Extended features (only when columns present from fetch_extended.py)
    - TRY/USD return and 5d rolling mean
    - CBRT rate delta (rate cuts vs inflation = crisis signal)
    - CDS proxy divergence vs EM average

All features use only past data (no look-ahead).
NaN values introduced by rolling windows are forward-filled.
"""

import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# Global index columns present in both Model A and B datasets
INDEX_COLS = ["sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]

# Extended-mode columns (only available after fetch_extended.py)
EXT_COLS = ["try_usd_ret", "cbrt_rate", "cbrt_delta", "cds_proxy"]


def build(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build full feature matrix from cleaned DataFrame.

    Parameters
    ----------
    df : DataFrame with date index, ise2 target, and at least some INDEX_COLS

    Returns
    -------
    DataFrame with all original + engineered features, NaNs filled.
    """
    df = df.copy()
    available_index_cols = [c for c in INDEX_COLS if c in df.columns]
    extended_mode = any(c in df.columns for c in EXT_COLS)

    print(f"[feature_eng] Input shape: {df.shape}")
    print(f"[feature_eng] Index cols available: {available_index_cols}")
    print(f"[feature_eng] Extended mode: {extended_mode}")

    df = _add_momentum(df, available_index_cols)
    df = _add_ise2_lags(df)
    df = _add_divergence(df, available_index_cols)
    df = _add_rolling_correlation(df, available_index_cols)
    df = _add_ise2_volatility(df)

    if extended_mode:
        df = _add_extended_features(df)

    # Fill NaNs introduced by rolling windows (inherent at start of series)
    # Use forward-fill to preserve temporal order, then backfill for leading NaNs
    df = df.ffill().bfill()

    print(f"[feature_eng] Output shape: {df.shape}")
    print(f"[feature_eng] Features added: {df.shape[1] - len(available_index_cols) - 1}")
    return df


def get_feature_names(df: pd.DataFrame) -> list:
    """
    Return the list of column names to use as model inputs.
    Excludes the target (ise2) and label (crisis_label) columns.
    """
    exclude = {"ise2", "crisis_label", "ise"}  # target + label + leakage
    return [c for c in df.columns if c not in exclude]


# ------------------------------------------------------------------ #
# Feature builders
# ------------------------------------------------------------------ #

def _add_momentum(df: pd.DataFrame, index_cols: list) -> pd.DataFrame:
    """
    5d and 20d rolling mean return for each global index.
    Captures short-term momentum (5d) and medium-term trend (20d).
    """
    for col in index_cols:
        df[f"{col}_mean5"]  = df[col].rolling(5,  min_periods=2).mean()
        df[f"{col}_mean20"] = df[col].rolling(20, min_periods=5).mean()
    return df


def _add_ise2_lags(df: pd.DataFrame) -> pd.DataFrame:
    """
    Lagged ISE2 returns: t-1, t-5, t-10.
    Autoregressive structure — ISE2 momentum and mean-reversion signals.
    """
    for lag in [1, 5, 10]:
        df[f"ise2_lag{lag}"] = df["ise2"].shift(lag)
    return df


def _add_divergence(df: pd.DataFrame, index_cols: list) -> pd.DataFrame:
    """
    ISE2 return minus each global index return.
    Divergence = Turkey decoupling from global peers = fragility signal.
    A large positive divergence means ISE2 moving independently of global risk.
    """
    for col in index_cols:
        df[f"div_{col}"] = df["ise2"] - df[col]
    # Composite divergence: ISE2 vs average of all peer indices
    df["div_composite"] = df["ise2"] - df[index_cols].mean(axis=1)
    return df


def _add_rolling_correlation(df: pd.DataFrame, index_cols: list,
                              window: int = 20) -> pd.DataFrame:
    """
    Rolling 20-day correlation of each global index vs ISE2.

    Why this matters:
    - During normal periods, ISE2 correlates ~0.4-0.7 with EM/EU indices
    - During Turkey-specific crises, correlation drops (Turkey decouples)
    - During GFC/global risk-off, correlation spikes (contagion)
    Both regimes matter for the classifier.
    """
    for col in index_cols:
        # Use pairwise=False to get a simple rolling correlation Series
        df[f"corr_{col}_20d"] = (
            df["ise2"].rolling(window)
            .corr(df[col])
        )
    return df


def _add_ise2_volatility(df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
    """
    20-day realised volatility of ISE2 (rolling std of daily returns).

    Regime-change indicator:
    - Low vol: normal/trending market
    - Rising vol: crisis entry
    - High vol persisting: deep crisis
    - Vol collapsing: crisis exit / stabilisation
    """
    df["ise2_vol20"] = df["ise2"].rolling(window, min_periods=5).std()
    # Also add vol-of-vol (second-order: how unstable is the volatility itself?)
    df["ise2_volvol"] = df["ise2_vol20"].rolling(window, min_periods=5).std()
    return df


def _add_extended_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Additional features only available in Model B (extended dataset).
    Called automatically when fetch_extended.py columns are present.

    try_usd_ret   : USD/TRY daily return — key crisis signal for ISE2
    cbrt_delta    : CBRT policy rate change — unorthodox cuts = crisis signal
    cds_proxy     : EM CDS spread proxy — Turkey risk premium
    """
    if "try_usd_ret" in df.columns:
        # TRY momentum (TL depreciation persistence)
        df["try_usd_mean5"]  = df["try_usd_ret"].rolling(5,  min_periods=2).mean()
        df["try_usd_mean20"] = df["try_usd_ret"].rolling(20, min_periods=5).mean()
        # TRY volatility (FX stress regime)
        df["try_usd_vol20"]  = df["try_usd_ret"].rolling(20, min_periods=5).std()
        # TRY-ISE2 correlation (breakdown = pure TL panic vs. real economy)
        df["corr_try_ise2_20d"] = df["ise2"].rolling(20).corr(df["try_usd_ret"])

    if "cbrt_rate" in df.columns:
        # Cumulative rate change over 20d (captures rate cut/hike cycle)
        df["cbrt_cumchange_20d"] = df["cbrt_rate"].diff(20)

    if "cds_proxy" in df.columns and "em" in df.columns:
        # CDS spread vs EM divergence — Turkey-specific risk premium
        df["cds_em_spread"] = df["cds_proxy"] - df["em"]

    return df
