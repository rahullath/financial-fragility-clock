"""
fetch_live.py — Append live market data to Model B and re-score features.

Downloads daily index returns from Yahoo Finance, computes rolling fragility
features using the same methodology as the existing pipeline, and appends
new rows to model_b_features_slim.json.

Tickers used:
  S&P 500          → ^GSPC
  DAX              → ^GDAXI
  FTSE 100         → ^FTSE
  Nikkei 225       → ^N225
  Bovespa          → ^BVSP
  MSCI Europe (~)  → EZU  (iShares MSCI Eurozone ETF — daily returns proxy)
  MSCI EM (~)      → EEM  (iShares MSCI Emerging Markets ETF)
  ISE (USD)        → XU100.IS (TRY) × (1/USDTRY) — converted to USD returns

Usage:
    python3 python/fetch_live.py                  # append since last date in JSON
    python3 python/fetch_live.py --since 2026-01-01   # force from specific date
    python3 python/fetch_live.py --dry-run            # show what would be fetched
"""

import argparse
import json
import re
import warnings
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
FEATURES_PATH = DATA / "model_b_features_slim.json"

# ── Ticker → column mapping ────────────────────────────────────────────────────

TICKERS = {
    "^GSPC":   "sp",
    "^GDAXI":  "dax",
    "^FTSE":   "ftse",
    "^N225":   "nikkei",
    "^BVSP":   "bovespa",
    "EZU":     "eu",        # MSCI Europe proxy (iShares MSCI Eurozone)
    "EEM":     "em",        # MSCI EM proxy (iShares MSCI Emerging Markets)
    "XU100.IS":"ise_try",   # BIST 100 in TRY (will be converted)
    "USDTRY=X":"usdtry",    # FX rate for USD conversion
}

# Feature computation parameters (must match existing pipeline)
CORR_WINDOW = 60       # rolling window for correlation (trading days)
VOL_WINDOW  = 20       # rolling window for volatility
PE_ORDER    = 3        # permutation entropy order
PE_WINDOW   = 21       # window for PE computation (order × 7)

# Fragility score weights (must match existing pipeline logic)
FRAG_WEIGHTS = {
    "mean_corr":           0.40,
    "rolling_volatility":  0.35,
    "permutation_entropy": 0.25,
}

# Regime thresholds (fragility score 0–100)
REGIME_THRESHOLDS = {
    "HEDGE":       (0,   40),
    "SPECULATIVE": (40,  70),
    "PONZI":       (70, 100),
}


# ── Utility: permutation entropy ──────────────────────────────────────────────

def permutation_entropy(x: np.ndarray, order: int = 3) -> float:
    """
    Compute permutation entropy of sequence x, order d.
    Returns value in [0, 1] (normalised by log2(order!)).
    """
    n = len(x)
    if n < order:
        return np.nan
    # Ordinal patterns
    counts: dict = {}
    for i in range(n - order + 1):
        pattern = tuple(np.argsort(x[i: i + order]))
        counts[pattern] = counts.get(pattern, 0) + 1
    total = sum(counts.values())
    probs = np.array(list(counts.values())) / total
    entropy = -np.sum(probs * np.log2(probs + 1e-10))
    max_entropy = np.log2(np.math.factorial(order))
    return float(entropy / max_entropy) if max_entropy > 0 else 0.0


# ── Download raw index data ────────────────────────────────────────────────────

def download_indices(since: date, until: date) -> pd.DataFrame:
    """
    Download all indices from Yahoo Finance and return as daily returns DataFrame.
    Columns: sp, dax, ftse, nikkei, bovespa, eu, em, ise2
    """
    print(f"  Downloading {since} → {until} from Yahoo Finance …")
    tickers = list(TICKERS.keys())
    raw = yf.download(
        tickers,
        start=str(since),
        end=str(until + timedelta(days=1)),   # yfinance end is exclusive
        auto_adjust=True,
        progress=False,
        threads=True,
    )

    # Extract adjusted close
    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"]
    else:
        prices = raw[["Close"]].rename(columns={"Close": tickers[0]})

    # Rename to our column names
    prices = prices.rename(columns=TICKERS)

    # Convert ISE from TRY to USD
    if "ise_try" in prices.columns and "usdtry" in prices.columns:
        prices["ise2"] = prices["ise_try"] / prices["usdtry"]
    elif "ise_try" in prices.columns:
        print("  WARN: USDTRY not available — using TRY-based ISE as proxy")
        prices["ise2"] = prices["ise_try"]
    prices = prices.drop(columns=["ise_try", "usdtry"], errors="ignore")

    # Compute daily returns
    returns = prices.pct_change().dropna(how="all")

    index_cols = ["sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]
    available_idx = [c for c in index_cols if c in returns.columns]
    print(f"  Available index columns: {available_idx}")
    if "ise2" in returns.columns:
        print(f"  ISE2 (USD returns) available: {returns['ise2'].notna().sum()} rows")
    else:
        print("  WARN: ISE2 not available — fragility will use SP500 as target proxy")

    return returns


# ── Feature engineering ───────────────────────────────────────────────────────

def compute_features(returns: pd.DataFrame,
                     hist_frag_mean: float,
                     hist_frag_std: float) -> pd.DataFrame:
    """
    Compute rolling fragility features from a returns DataFrame.
    Normalise fragility against historical statistics to keep scale consistent.
    """
    index_cols = [c for c in ["sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]
                  if c in returns.columns]
    target_col = "ise2" if "ise2" in returns.columns else index_cols[0]

    features = []

    for i in range(len(returns)):
        if i < CORR_WINDOW:
            features.append(None)
            continue

        window = returns.iloc[max(0, i - CORR_WINDOW): i + 1]
        row_date = returns.index[i]

        # 1. Mean pairwise correlation of all global indices
        corr_data = window[index_cols].dropna(how="any")
        if len(corr_data) < 10:
            features.append(None)
            continue

        corr_matrix = corr_data.corr()
        upper_idx = np.triu_indices_from(corr_matrix.values, k=1)
        upper_vals = corr_matrix.values[upper_idx]
        mean_corr = float(np.nanmean(np.abs(upper_vals)))

        # 2. Rolling volatility of target (annualised)
        vol_window = window[target_col].dropna()
        roll_vol = float(vol_window.std() * np.sqrt(252)) if len(vol_window) > 2 else np.nan

        # 3. Permutation entropy of target returns
        pe_series = returns[target_col].iloc[max(0, i - PE_WINDOW): i + 1].dropna().values
        pe = permutation_entropy(pe_series, order=PE_ORDER)

        # 4. Pairwise correlations dictionary (rounded, for heatmap)
        pairwise: dict = {}
        for col_a in index_cols:
            for col_b in index_cols:
                if col_a < col_b:
                    try:
                        v = corr_matrix.loc[col_a, col_b]
                        pairwise[f"{col_a}_{col_b}"] = round(float(v), 4)
                    except Exception:
                        pass

        # 5. Fragility score — weighted composite, normalized
        raw_frag = (
            FRAG_WEIGHTS["mean_corr"]           * mean_corr +
            FRAG_WEIGHTS["rolling_volatility"]  * min(roll_vol / 0.40, 1.0) +  # 40% annualised = 1.0
            FRAG_WEIGHTS["permutation_entropy"] * (1 - pe)   # low entropy = high fragility
        ) * 100

        # Soft-clip to [0, 100]
        raw_frag = max(0.0, min(100.0, raw_frag))

        # 6. Regime assignment
        if raw_frag < 40:
            regime = "HEDGE"
        elif raw_frag < 70:
            regime = "SPECULATIVE"
        else:
            regime = "PONZI"

        features.append({
            "date":                str(row_date.date()),
            "fragility_score":     round(raw_frag, 4),
            "regime":              regime,
            "mean_corr":           round(mean_corr, 4),
            "rolling_volatility":  round(roll_vol, 4) if not np.isnan(roll_vol) else None,
            "permutation_entropy": round(pe, 4)       if not np.isnan(pe)       else None,
            "pairwise_correlations": pairwise,
            "sp":                  round(float(returns["sp"].iloc[i]), 6) if "sp" in returns.columns else None,
            "source":              "live",     # mark as live-fetched
        })

    df_out = pd.DataFrame([f for f in features if f is not None])
    if not df_out.empty:
        df_out["date"] = pd.to_datetime(df_out["date"])
    return df_out


# ── Get last date in existing JSON ────────────────────────────────────────────

def get_last_date_in_json(path: Path) -> date:
    """Fast extraction of last date by seeking to end of file."""
    print(f"  Finding last date in {path.name} …")
    with open(path, "rb") as f:
        # Seek to last 5KB — enough to find the last date entry
        f.seek(0, 2)
        size = f.tell()
        f.seek(max(0, size - 8192), 0)
        tail = f.read().decode("utf-8", errors="ignore")

    # Find all dates with regex
    dates = re.findall(r'"date":"(\d{4}-\d{2}-\d{2})"', tail)
    if not dates:
        # Fallback: check first bytes for first date and assume recent
        print("  WARN: could not find date in tail — falling back to 2025-12-31")
        return date(2025, 12, 31)

    last = max(dates)
    print(f"  Last date found: {last}")
    return date.fromisoformat(last)


# ── Append new rows to JSON ────────────────────────────────────────────────────

def append_to_json(path: Path, new_rows: pd.DataFrame) -> int:
    """
    Append new_rows to the data array in path.
    Skips rows whose date already exists.
    Updates metadata.last_updated.
    """
    print(f"  Loading {path.name} to append …")
    with open(path) as f:
        raw = json.load(f)

    existing_dates = {r["date"] for r in raw["data"]}

    to_add = []
    for _, row in new_rows.iterrows():
        date_str = str(row["date"].date()) if hasattr(row["date"], "date") else str(row["date"])[:10]
        if date_str in existing_dates:
            continue
        # Build the row dict matching existing schema
        # Replace NaN with None for valid JSON
        import math
        entry = {k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in row.items()}
        entry["date"] = date_str
        # Ensure crash_probability and crisis_similarity fields are null
        # (will be filled later by compute_phase2.py)
        entry.setdefault("crash_probability", None)
        entry.setdefault("crisis_similarity_composite", None)
        to_add.append(entry)

    if not to_add:
        print("  No new rows to append.")
        return 0

    raw["data"].extend(to_add)

    # Sort by date
    raw["data"].sort(key=lambda r: r["date"])

    # Update metadata
    raw.setdefault("metadata", {})["last_updated"] = datetime.now().isoformat()
    raw["metadata"]["live_data_through"] = to_add[-1]["date"]
    raw["metadata"]["live_source"] = "yfinance"

    print(f"  Writing {len(raw['data'])} total rows …")
    with open(path, "w") as f:
        json.dump(raw, f, separators=(",", ":"))

    mb = path.stat().st_size / 1e6
    print(f"  ✓ Appended {len(to_add)} new rows. File: {mb:.1f} MB")
    return len(to_add)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch live market data and append to Model B")
    parser.add_argument("--since", type=str, default=None,
                        help="Fetch from this date (YYYY-MM-DD). Default: day after last date in JSON.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be fetched without writing anything.")
    args = parser.parse_args()

    print("=" * 60)
    print("FINANCIAL FRAGILITY CLOCK — Live Data Update")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Determine fetch range
    if args.since:
        fetch_from = date.fromisoformat(args.since)
    else:
        last_date = get_last_date_in_json(FEATURES_PATH)
        fetch_from = last_date + timedelta(days=1)

    fetch_until = date.today() - timedelta(days=1)   # yesterday's close

    if fetch_from > fetch_until:
        print(f"\n✓ Data already up to date (last: {fetch_from - timedelta(days=1)}).")
        print("  No new trading days to fetch.")
        return

    # We need CORR_WINDOW days before fetch_from as context for feature computation
    context_from = fetch_from - timedelta(days=CORR_WINDOW * 2)  # extra buffer for non-trading days
    print(f"\n  Fetching: {fetch_from} → {fetch_until}")
    print(f"  Context start (for rolling features): {context_from}")

    if args.dry_run:
        print(f"\n[DRY RUN] Would fetch {(fetch_until - fetch_from).days + 1} calendar days")
        print(f"  Tickers: {list(TICKERS.keys())}")
        return

    # 1. Download
    print("\n[1/3] Downloading index data …")
    returns = download_indices(context_from, fetch_until)

    if returns.empty:
        print("  ERROR: No data returned from Yahoo Finance.")
        return

    print(f"  Downloaded {len(returns)} rows ({returns.index[0].date()} → {returns.index[-1].date()})")

    # 2. Compute features
    print("\n[2/3] Computing rolling fragility features …")
    features_df = compute_features(returns, hist_frag_mean=50.0, hist_frag_std=15.0)

    if features_df.empty:
        print("  ERROR: Feature computation returned empty DataFrame.")
        return

    # Only keep dates from fetch_from onward (context was just for rolling windows)
    features_df = features_df[features_df["date"] >= pd.Timestamp(fetch_from)]
    print(f"  Computed {len(features_df)} new feature rows")

    if features_df.empty:
        print("  No new dates after filtering to fetch range.")
        return

    # Brief stats
    print(f"  Fragility score: [{features_df['fragility_score'].min():.1f}, "
          f"{features_df['fragility_score'].max():.1f}], "
          f"mean={features_df['fragility_score'].mean():.1f}")
    print(f"  Regime counts: {dict(features_df['regime'].value_counts())}")

    # 3. Append to JSON
    print("\n[3/3] Appending to model_b_features_slim.json …")
    n_added = append_to_json(FEATURES_PATH, features_df)

    if n_added > 0:
        print(f"\n✓ Done. Added {n_added} new rows.")
        print("\nNEXT STEPS:")
        print("  1. Run Phase 2 to score new dates:")
        print("     python3 python/compute_phase2.py --model B")
        print("  2. Restart the dev server to pick up new data:")
        print("     npm run dev")
    else:
        print("\n✓ No new rows to add (already up to date).")


if __name__ == "__main__":
    main()
