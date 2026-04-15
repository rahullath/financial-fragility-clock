"""
fetch_extended.py — Turkey ISE2 Pipeline (turkey branch)

Downloads extended dataset (2005-01-01 → today) for Model B.
Combines:
  - BIST100 (^XU100 via yfinance) converted to USD via TRY/USD rate
  - Global indices: same 7 as Model A  (^GSPC, ^GDAXI, ^FTSE, ^N225, ^BVSP, FEZ, EEM)
  - TRY/USD exchange rate  (TRYUSD=X)
  - Turkey macro: CBRT policy rate + CPI  from FRED API
    FRED series:
      IRSTCI01TRM156N  — Turkey overnight rate (monthly, interpolated to daily)
      TURCPICORMINMEI  — Turkey CPI MoM

Env vars (loaded from .env locally, Vercel env in production):
  FRED_API_KEY  — required for FRED macro data

Outputs
-------
  python/data/extended_dataset.csv
  src/data/extended_meta.json

Usage
-----
  python fetch_extended.py
  # or from train_pipeline.py which calls fetch_extended.run()

Notes on ISE / BIST100
----------------------
yfinance does NOT have a direct ISE USD-denominated series.
We reconstruct it:
  bist100_usd_ret = bist100_tl_pct_change + try_usd_pct_change
This is the log-return approximation; sufficiently accurate for daily returns.

Note: Group_5.csv already has ise2 computed this way for 2009-11.
For the extended set we replicate the same methodology.
"""

import os
import json
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np
import yfinance as yf

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional; Vercel injects env vars directly

FRED_API_KEY = os.getenv("FRED_API_KEY", "")

# ---------------------------------------------------------------------------
# Ticker mappings
# ---------------------------------------------------------------------------
INDEX_TICKERS = {
    "sp":      "^GSPC",
    "dax":     "^GDAXI",
    "ftse":    "^FTSE",
    "nikkei":  "^N225",
    "bovespa": "^BVSP",
    "eu":      "FEZ",
    "em":      "EEM",
}
BIST100_TICKER  = "XU100.IS"  # BIST100 in TRY
TRY_USD_TICKER  = "TRYUSD=X"  # TRY per 1 USD (inverted → we want USD per TRY)

START_DATE = "2005-01-01"
END_DATE   = datetime.today().strftime("%Y-%m-%d")

OUT_DIR    = Path(__file__).parent / "data"
DATA_DIR   = Path(__file__).parent.parent / "src" / "data"


def _fetch_close(ticker: str, start: str, end: str) -> pd.Series:
    """Download adjusted close price for a single ticker."""
    try:
        raw = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=True)
        if raw.empty:
            print(f"  [WARN] No data for {ticker}")
            return pd.Series(dtype=float, name=ticker)
        # yfinance may return MultiIndex columns
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.droplevel(1)
        close = raw["Close"].squeeze()
        close.name = ticker
        return close
    except Exception as e:
        print(f"  [ERROR] {ticker}: {e}")
        return pd.Series(dtype=float, name=ticker)


def fetch_global_indices(start: str = START_DATE, end: str = END_DATE) -> pd.DataFrame:
    """Download all 7 global index returns."""
    print("[fetch_extended] Downloading global indices...")
    frames = {}
    for name, ticker in INDEX_TICKERS.items():
        price = _fetch_close(ticker, start, end)
        if not price.empty:
            frames[name] = price.pct_change()
            print(f"  {name}: {len(price)} days")
    df = pd.DataFrame(frames)
    df.index = pd.to_datetime(df.index)
    return df


def fetch_bist100_usd(start: str = START_DATE, end: str = END_DATE) -> pd.Series:
    """
    Reconstruct ISE2-equivalent (BIST100 return in USD terms).
    Formula: bist100_usd_ret ≈ bist100_tl_ret + try_usd_ret
    (log-return additive approximation; matches Group_5.csv methodology)
    """
    print("[fetch_extended] Downloading BIST100 (XU100.IS) + TRY/USD...")
    bist_tl  = _fetch_close(BIST100_TICKER, start, end).pct_change()
    try_usd  = _fetch_close(TRY_USD_TICKER, start, end).pct_change()

    # Align on common dates
    aligned = pd.concat([bist_tl, try_usd], axis=1).dropna()
    aligned.columns = ["bist_tl_ret", "try_usd_ret"]

    # USD return = TL return + TRY/USD change
    ise2_usd = aligned["bist_tl_ret"] + aligned["try_usd_ret"]
    ise2_usd.name = "ise2"
    print(f"  BIST100 USD series: {len(ise2_usd)} days  ({ise2_usd.index[0].date()} → {ise2_usd.index[-1].date()})")
    return ise2_usd, aligned["try_usd_ret"]


def fetch_fred_macro(start: str = START_DATE, end: str = END_DATE) -> pd.DataFrame:
    """
    Fetch Turkey macro indicators from FRED.
    Requires FRED_API_KEY environment variable.
    Returns daily-interpolated DataFrame with columns:
      cbrt_rate   — CBRT overnight policy rate (%)
      cpi_mom     — Turkey CPI month-on-month change (%)
    Falls back to empty DataFrame if API key missing.
    """
    if not FRED_API_KEY:
        print("[fetch_extended] FRED_API_KEY not set — skipping macro data")
        return pd.DataFrame()

    try:
        from fredapi import Fred
        fred = Fred(api_key=FRED_API_KEY)
    except ImportError:
        print("[fetch_extended] fredapi not installed — pip install fredapi")
        return pd.DataFrame()

    print("[fetch_extended] Fetching FRED macro series...")
    frames = {}

    # CBRT overnight rate (monthly → interpolate to daily)
    try:
        cbrt = fred.get_series("IRSTCI01TRM156N", observation_start=start, observation_end=end)
        cbrt_daily = cbrt.resample("D").interpolate(method="linear")
        frames["cbrt_rate"] = cbrt_daily
        print(f"  CBRT rate: {len(cbrt)} monthly obs → interpolated")
    except Exception as e:
        print(f"  [WARN] CBRT rate fetch failed: {e}")

    # Turkey CPI MoM
    try:
        cpi = fred.get_series("TURCPICORMINMEI", observation_start=start, observation_end=end)
        cpi_daily = cpi.resample("D").interpolate(method="linear")
        frames["cpi_mom"] = cpi_daily
        print(f"  CPI MoM: {len(cpi)} monthly obs → interpolated")
    except Exception as e:
        print(f"  [WARN] CPI MoM fetch failed: {e}")

    if not frames:
        return pd.DataFrame()

    df_macro = pd.DataFrame(frames)
    df_macro.index = pd.to_datetime(df_macro.index)
    return df_macro


def build_extended_dataset(
    start: str = START_DATE,
    end:   str = END_DATE,
) -> pd.DataFrame:
    """
    Assemble the full extended dataset.
    Joins all series on business-day date index, forward-fills gaps.
    Returns DataFrame ready for feature_engineering.build().
    """
    indices      = fetch_global_indices(start, end)
    ise2_usd, try_usd_ret = fetch_bist100_usd(start, end)
    macro        = fetch_fred_macro(start, end)

    df = indices.copy()
    df["ise2"]       = ise2_usd
    df["try_usd_ret"] = try_usd_ret

    if not macro.empty:
        # Align macro to market dates
        df = df.join(macro, how="left")
        df["cbrt_rate"] = df.get("cbrt_rate", pd.Series(dtype=float, index=df.index)).ffill()
        df["cpi_mom"]   = df.get("cpi_mom",   pd.Series(dtype=float, index=df.index)).ffill()
        # Derive delta (rate change is more informative than level)
        if "cbrt_rate" in df.columns:
            df["cbrt_rate_delta"] = df["cbrt_rate"].diff()

    # Forward-fill and drop any remaining NaN rows
    df = df.ffill().dropna(subset=["ise2"] + list(INDEX_TICKERS.keys()))
    df = df.sort_index()

    print(
        f"[fetch_extended] Extended dataset: {len(df)} rows  "
        f"| {df.index[0].date()} → {df.index[-1].date()}"
    )
    print(f"  Columns: {list(df.columns)}")
    return df


def run(
    start:    str = START_DATE,
    end:      str = END_DATE,
    out_dir:  Path = OUT_DIR,
    data_dir: Path = DATA_DIR,
) -> pd.DataFrame:
    """
    Build, save, and return the extended dataset.
    Writes:
      python/data/extended_dataset.csv
      src/data/extended_meta.json
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    df = build_extended_dataset(start, end)

    # Save CSV
    csv_path = out_dir / "extended_dataset.csv"
    df.to_csv(csv_path)
    print(f"[fetch_extended] Saved → {csv_path}")

    # Save metadata JSON for dashboard
    meta = {
        "source":       "yfinance + FRED",
        "start":        str(df.index[0].date()),
        "end":          str(df.index[-1].date()),
        "n_rows":       len(df),
        "columns":      list(df.columns),
        "has_macro":    "cbrt_rate" in df.columns,
        "crisis_windows": [
            {"label": "2008 GFC",              "start": "2008-09-01", "end": "2009-03-31"},
            {"label": "2018 Currency Crisis",  "start": "2018-03-01", "end": "2018-12-31"},
            {"label": "COVID Shock",           "start": "2020-02-01", "end": "2020-06-30"},
            {"label": "2021 Rate Cut Shock",   "start": "2021-09-01", "end": "2022-01-31"},
            {"label": "2023 Earthquake",       "start": "2023-02-01", "end": "2023-05-31"},
        ]
    }
    with open(data_dir / "extended_meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    print(f"[fetch_extended] Saved → {data_dir / 'extended_meta.json'}")

    return df


if __name__ == "__main__":
    df = run()
    print(df.tail())
