"""
fetch_turkish_macro.py — Turkey-specific macro data fetcher for Model B.

Academic framing:
  "Model A tested Global Contagion (2009–2011). Model B tests Local Sovereign
   Crisis (2003–2026): do USD/TRY shocks, BIST/ISE divergence, and bond yield
   spikes predict ISE_USD drawdowns 30 trading days in advance?"

Fetches (all via yfinance — no API key required):
  TRY=X      → USD/TRY spot rate (PRIMARY sovereign stress signal)
  XU100.IS   → BIST100 local equity index (TRY-denominated)
  ^VIX       → CBOE VIX (global risk control)
  IRLTLT01TRM156N (FRED, optional) → Turkey 10Y bond yield

Derived:
  ISE_USD    = BIST100 / USDTRY  (USD-denominated ISE proxy)
               This is the regression target for Model B walk-forward and
               SHAP analysis. It captures the combined effect of Turkish
               equity performance and TRY/USD exchange rate moves.
"""

import pandas as pd
import numpy as np
import warnings
import yfinance as yf

TURKISH_CRISIS_EVENTS = [
    {"date": "2018-05-23", "label": "2018 TRY Pressure Starts",
     "description": "USD/TRY begins accelerated depreciation. US sanctions threat amplifies EM selloff."},
    {"date": "2018-08-10", "label": "2018 TRY Freefall",
     "description": "USD/TRY doubles in 12 months. US tariffs on Turkish steel announced. ISE_USD −45% in 2018. Erdogan publicly refuses CBRT rate hikes."},
    {"date": "2021-03-20", "label": "CBRT Governor Sacked",
     "description": "Third central bank chief fired in two years after hiking rates. TRY loses 15% in a single trading day."},
    {"date": "2021-11-23", "label": "2021 Lira Collapse",
     "description": "Erdogan's unorthodox rate-cut cycle amid 21%+ inflation. USD/TRY >13 (from 8). ISE_USD −40% in USD terms."},
    {"date": "2022-10-01", "label": "CPI Peaks at 85%",
     "description": "Turkish CPI hits 85.5% YoY. Dollarization accelerates. Local BIST gains mask ongoing USD-denominated collapse."},
    {"date": "2023-06-22", "label": "Policy Normalisation Begins",
     "description": "Finance minister Şimşek signals orthodox policy. CBRT begins hiking from 8.5% toward eventual 50%."},
    {"date": "2024-03-21", "label": "CBRT Rate Reaches 50%",
     "description": "Policy rate stabilises at 50%. TRY volatility normalises. ISE_USD begins gradual recovery."},
]


def fetch_turkish_macro(
    start_date: str = "2003-01-01",
    end_date: str = "2025-12-31",
    fred_api_key: str | None = None,
) -> pd.DataFrame:
    date_idx = pd.bdate_range(start=start_date, end=end_date)
    df = pd.DataFrame(index=date_idx)
    df.index.name = "date"

    tickers = {"USDTRY": "TRY=X", "BIST100": "XU100.IS", "VIX": "^VIX"}
    for col, ticker in tickers.items():
        try:
            raw = yf.download(ticker, start=start_date, end=end_date,
                              progress=False, auto_adjust=True)
            close = raw["Close"] if "Close" in raw.columns else raw.iloc[:, 0]
            if hasattr(close, "squeeze"):
                close = close.squeeze()
            df[col] = close.rename(col).reindex(date_idx).ffill(limit=5).bfill(limit=5)
        except Exception as e:
            warnings.warn(f"{ticker} fetch failed: {e}")
            df[col] = np.nan

    # Turkey 10Y bond yield via FRED (optional)
    if fred_api_key:
        try:
            from fredapi import Fred
            fred = Fred(api_key=fred_api_key)
            yield_series = fred.get_series(
                "IRLTLT01TRM156N",
                observation_start=start_date,
                observation_end=end_date,
            )
            df["TR_YIELD10Y"] = yield_series.reindex(date_idx).ffill(limit=30).bfill(limit=30)
        except Exception as e:
            warnings.warn(f"FRED TR_YIELD10Y failed: {e}")

    # Derived features
    df["USDTRY_ret"]   = np.log(df["USDTRY"] / df["USDTRY"].shift(1))
    df["BIST100_ret"]  = np.log(df["BIST100"] / df["BIST100"].shift(1))
    df["USDTRY_vol30"] = df["USDTRY_ret"].rolling(30).std() * np.sqrt(252)

    # ISE_USD: USD-denominated Turkish equity index (BIST100 price / USD-TRY rate)
    # This is the regression target for Model B.  It captures both Turkish equity
    # performance and exchange-rate stress in a single series — exactly what the
    # Minsky fragility framework measures for an emerging-market sovereign context.
    # Guard against division by zero / NaN in USDTRY.
    if df["USDTRY"].notna().any() and df["BIST100"].notna().any():
        df["ISE_USD"] = df["BIST100"] / df["USDTRY"]
    else:
        warnings.warn("Could not construct ISE_USD: BIST100 or USDTRY missing")
        df["ISE_USD"] = np.nan

    return df


def _merge_with_turkish_macro(
    market_df: pd.DataFrame,
    turkish_df: pd.DataFrame,
    max_gap: int = 5,
) -> pd.DataFrame:
    """Merge global market data with Turkish macro on common business-day index."""
    common_idx = market_df.index.intersection(turkish_df.index)
    df = market_df.reindex(common_idx).copy()
    for col in ["USDTRY", "USDTRY_ret", "USDTRY_vol30",
                "BIST100", "BIST100_ret", "ISE_USD",
                "TR_YIELD10Y", "VIX"]:
        if col in turkish_df.columns and col not in df.columns:
            df[col] = turkish_df[col].reindex(common_idx)
    return df.ffill(limit=max_gap)


def get_crisis_annotations() -> list[dict]:
    return TURKISH_CRISIS_EVENTS
