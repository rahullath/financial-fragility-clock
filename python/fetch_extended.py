"""
fetch_extended.py — Turkey ISE2 Pipeline (turkey branch)

Downloads and assembles the extended dataset for Model B.

Covers 2005-01-01 to present (typically 2025 or 2026 depending on data availability).

Data sources
------------
1.  yfinance (free, no key required)
    Tickers used:
      XU100.IS      — Borsa Istanbul 100 Index (TRY terms)
      TRY=X         — USD/TRY spot rate (to convert ISE to USD returns)
      ^GSPC         — S&P 500 (sp)
      ^GDAXI        — DAX (dax)
      ^FTSE         — FTSE 100 (ftse)
      ^N225         — Nikkei 225 (nikkei)
      ^BVSP         — Bovespa (bovespa)
      EEM           — iShares MSCI Emerging Markets ETF (em)
      VGK           — Vanguard FTSE Europe ETF (eu)

2.  FRED via fredapi (optional, graceful fallback if not installed)
    Series used:
      IRTCN0L01STQ  — Turkey Central Bank rate (quarterly, interpolated to daily)
      TURCPIALLMINMEI — Turkey CPI YoY (monthly, interpolated to daily)

Output
------
python/data/extended_dataset.csv
  Columns: date (index), ise2, sp, dax, ftse, nikkei, bovespa, eu, em,
           try_usd_ret, cbrt_rate, cbrt_delta, cpi_yoy
  All return columns are log returns (np.log(p/p.shift(1)))
  Approximately 5000 rows (2005-2026)

Usage
-----
  pip install yfinance pandas numpy
  pip install fredapi   # optional — for CBRT rates
  python fetch_extended.py
"""

import sys
import warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

START_DATE = "2005-01-01"
END_DATE   = datetime.today().strftime("%Y-%m-%d")

OUT_DIR = Path(__file__).parent / "data"
OUT_CSV = OUT_DIR / "extended_dataset.csv"

# yfinance ticker → output column name
TICKER_MAP = {
    "XU100.IS": "_xu100_try",   # raw TRY-denominated ISE100
    "TRY=X":    "_tryusd",       # USD per TRY (inverted below for USD/TRY)
    "^GSPC":    "sp",
    "^GDAXI":   "dax",
    "^FTSE":    "ftse",
    "^N225":    "nikkei",
    "^BVSP":    "bovespa",
    "EEM":      "em",
    "VGK":      "eu",
}


def main():
    try:
        import yfinance as yf
    except ImportError:
        print("[fetch] ERROR: yfinance not installed.")
        print("[fetch] Run: pip install yfinance")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[fetch] Downloading {len(TICKER_MAP)} tickers ({START_DATE} → {END_DATE})...")

    # ---------------------------------------------------------------- #
    # 1. Download all yfinance tickers
    # ---------------------------------------------------------------- #
    tickers = list(TICKER_MAP.keys())
    raw = yf.download(
        tickers,
        start=START_DATE,
        end=END_DATE,
        auto_adjust=True,
        progress=False,
        threads=True,
    )

    # Extract adjusted close prices
    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"].rename(columns=TICKER_MAP)
    else:
        prices = raw[["Close"]].rename(columns={"Close": list(TICKER_MAP.values())[0]})

    print(f"[fetch] Downloaded shape: {prices.shape}")

    # ---------------------------------------------------------------- #
    # 2. Construct ise2 (ISE in USD terms)
    # ---------------------------------------------------------------- #
    # TRY=X in yfinance is USD per TRY (i.e., how many USD per 1 TRY)
    # To get USD/TRY (how many TRY per 1 USD), we invert it
    # ISE in USD = XU100 TRY price / USD-per-TRY rate
    #            = XU100_TRY * (1 / tryusd_price)
    #            = XU100_TRY * tryusd_inverted

    if "_xu100_try" in prices.columns and "_tryusd" in prices.columns:
        xu100 = prices["_xu100_try"]
        tryusd = prices["_tryusd"]  # USD per TRY
        ise_usd_price = xu100 * tryusd  # ISE price in USD
        prices["ise2"] = np.log(ise_usd_price / ise_usd_price.shift(1))
        print(f"[fetch] Constructed ise2 from XU100.IS * TRY=X  "
              f"(NaN: {prices['ise2'].isna().sum()})")

        # TRY/USD log return (USD per TRY — positive = TRY appreciating)
        prices["try_usd_ret"] = np.log(tryusd / tryusd.shift(1))
    else:
        print("[fetch] WARNING: XU100.IS or TRY=X missing — ise2 not available")
        if "_xu100_try" in prices.columns:
            prices["ise2"] = np.log(prices["_xu100_try"] / prices["_xu100_try"].shift(1))
        prices["try_usd_ret"] = np.nan

    # Drop the raw construction columns
    prices = prices.drop(columns=[c for c in ["_xu100_try", "_tryusd"] if c in prices.columns])

    # ---------------------------------------------------------------- #
    # 3. Compute log returns for all index columns
    # ---------------------------------------------------------------- #
    index_cols = [c for c in ["sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]
                  if c in prices.columns]
    for col in index_cols:
        prices[col] = np.log(prices[col] / prices[col].shift(1))

    print(f"[fetch] Log returns computed for: {index_cols}")

    # ---------------------------------------------------------------- #
    # 4. FRED data (optional — CBRT rate + Turkey CPI)
    # ---------------------------------------------------------------- #
    cbrt_daily = _fetch_cbrt_fred(prices.index)
    if cbrt_daily is not None:
        prices = prices.join(cbrt_daily, how="left")
        print("[fetch] CBRT rate data joined from FRED")
    else:
        prices["cbrt_rate"]  = np.nan
        prices["cbrt_delta"] = np.nan
        prices["cpi_yoy"]    = np.nan
        print("[fetch] CBRT/CPI data unavailable (fredapi not installed or FRED offline)")
        print("[fetch] cbrt_rate / cbrt_delta / cpi_yoy will be NaN — that\'s OK for Model B")

    # ---------------------------------------------------------------- #
    # 5. CDS proxy — approximate Turkey credit risk via iShares HY ETF spread
    # ---------------------------------------------------------------- #
    prices["cds_proxy"] = _fetch_cds_proxy(prices.index, yf)

    # ---------------------------------------------------------------- #
    # 6. Align, clean, save
    # ---------------------------------------------------------------- #
    # Business days only
    prices = prices[prices.index.dayofweek < 5].copy()
    # Drop first row (NaN from log-return shift)
    prices = prices.iloc[1:]
    # Forward-fill, then drop rows where ise2 is missing
    prices = prices.ffill()
    prices = prices.dropna(subset=["ise2"])

    # Reorder columns: ise2 first, then global indices, then extended
    lead_cols = ["ise2"] + index_cols
    ext_cols  = [c for c in ["try_usd_ret", "cbrt_rate", "cbrt_delta", "cpi_yoy", "cds_proxy"]
                 if c in prices.columns]
    prices = prices[lead_cols + ext_cols]

    prices.index.name = "date"
    prices.to_csv(OUT_CSV)

    print(f"\n[fetch] ✓ Saved {OUT_CSV.name}")
    print(f"[fetch] Shape: {prices.shape}")
    print(f"[fetch] Date range: {prices.index[0].date()} → {prices.index[-1].date()}")
    print(f"[fetch] Columns: {list(prices.columns)}")
    print(f"[fetch] NaN summary:")
    nan_summary = prices.isna().sum()
    for col, n in nan_summary[nan_summary > 0].items():
        pct = n / len(prices) * 100
        print(f"  {col}: {n} ({pct:.1f}%)")
    print("[fetch] Done. Run: python train_pipeline.py --model b")


# ------------------------------------------------------------------ #
# FRED helpers
# ------------------------------------------------------------------ #

def _fetch_cbrt_fred(date_index: pd.DatetimeIndex):
    """
    Fetch Turkey central bank rate and CPI from FRED.
    Returns a DataFrame with cbrt_rate, cbrt_delta, cpi_yoy aligned to date_index.
    Returns None if fredapi not available or FRED is offline.

    Note: FRED requires a free API key (https://fred.stlouisfed.org/docs/api/api_key.html)
    Set it as environment variable: export FRED_API_KEY="your_key_here"
    Or pass it as FRED_API_KEY in a .env file.
    """
    try:
        from fredapi import Fred
        import os
    except ImportError:
        return None

    api_key = _get_fred_key()
    if not api_key:
        print("[fetch] FRED_API_KEY not set — skipping CBRT data")
        print("[fetch] To enable: export FRED_API_KEY=your_key (free at fred.stlouisfed.org)")
        return None

    try:
        fred = Fred(api_key=api_key)
        df_parts = {}

        # Turkey CB rate (short-term) — use INTDSRTRM193N (monthly) or best available
        # Alternative: IRTCN0L01STQ (quarterly)
        for series_id in ["INTDSRTRM193N", "IRTCN0L01STQ"]:
            try:
                s = fred.get_series(series_id,
                                    observation_start=date_index[0],
                                    observation_end=date_index[-1])
                df_parts["cbrt_rate"] = s.resample("B").ffill()
                print(f"[fetch] CBRT rate: {series_id} ({len(s)} obs)")
                break
            except Exception:
                continue

        # Turkey CPI YoY
        try:
            cpi = fred.get_series("TURCPIALLMINMEI",
                                  observation_start=date_index[0],
                                  observation_end=date_index[-1])
            df_parts["cpi_yoy"] = cpi.resample("B").ffill()
            print(f"[fetch] CPI YoY: TURCPIALLMINMEI ({len(cpi)} obs)")
        except Exception:
            pass

        if not df_parts:
            return None

        result = pd.DataFrame(df_parts, index=date_index)
        for col in df_parts:
            result[col] = result[col].reindex(date_index).ffill()

        if "cbrt_rate" in result.columns:
            result["cbrt_delta"] = result["cbrt_rate"].diff(1)

        return result

    except Exception as e:
        print(f"[fetch] FRED error: {e}")
        return None


def _get_fred_key() -> str:
    import os
    key = os.environ.get("FRED_API_KEY", "")
    if key:
        return key
    # Try .env file
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("FRED_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _fetch_cds_proxy(date_index: pd.DatetimeIndex, yf) -> pd.Series:
    """
    Approximate Turkey CDS using the HYG (iShares HY ETF) spread.
    Not a perfect proxy but captures EM credit risk sentiment.
    Returns NaN series if download fails.
    """
    try:
        hyg = yf.download("HYG", start=str(date_index[0].date()),
                          end=str(date_index[-1].date()),
                          auto_adjust=True, progress=False)
        if hyg.empty:
            return pd.Series(np.nan, index=date_index, name="cds_proxy")
        close = hyg["Close"].reindex(date_index).ffill()
        # Use inverted log-return as spread proxy (HYG price falls when spreads widen)
        proxy = -np.log(close / close.shift(1))
        proxy.name = "cds_proxy"
        print(f"[fetch] CDS proxy (HYG) downloaded ({proxy.notna().sum()} obs)")
        return proxy
    except Exception as e:
        print(f"[fetch] CDS proxy unavailable: {e}")
        return pd.Series(np.nan, index=date_index, name="cds_proxy")


if __name__ == "__main__":
    main()
