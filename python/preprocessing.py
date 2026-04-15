"""
preprocessing.py — Turkey ISE2 Pipeline (turkey branch)

Loads Group_5.csv, cleans and scales for ISE2 (USD-based BIST100 return).
Target: ise2  (ISE in USD terms)
Features: sp, dax, ftse, nikkei, bovespa, eu, em

Design notes
------------
- RobustScaler instead of StandardScaler: financial return distributions have
  fat tails; median/IQR scaling is more appropriate than mean/stdev.
- Time-aware 80/20 split: NO shuffling — this is a time-series.
- Forward-fill then mean-imputation for market-holiday gaps.
- ISE TL column dropped — we predict USD returns (ise2) exclusively.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.preprocessing import RobustScaler
import json

# ---------------------------------------------------------------------------
# Column name constants (match CSV headers exactly)
# ---------------------------------------------------------------------------
RAW_COLS = ["date", "ISE", "ise2", "sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]
FEATURE_COLS = ["sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]
TARGET_COL = "ise2"  # ISE100 USD-based daily return — the ONLY target


def load_raw(csv_path: str | Path) -> pd.DataFrame:
    """
    Load Group_5.csv and return a clean DataFrame indexed by date.
    Drops the TL-based ISE column immediately to avoid target leakage.
    """
    df = pd.read_csv(csv_path)

    # Normalise column names (strip whitespace, lower-case non-date cols)
    df.columns = df.columns.str.strip()
    # Rename to standard names if CSV uses slightly different casing
    rename_map = {
        col: col.lower() for col in df.columns if col.lower() in
        ["ise", "ise2", "sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]
    }
    rename_map.update({"Date": "date", "DATE": "date"})
    df = df.rename(columns=rename_map)

    # Parse date
    df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")
    df = df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
    df = df.set_index("date")

    # Drop TL-denominated ISE (not the target; keeping it causes leakage)
    if "ise" in df.columns:
        df = df.drop(columns=["ise"])

    # Keep only the columns we care about
    keep = [TARGET_COL] + FEATURE_COLS
    df = df[[c for c in keep if c in df.columns]]

    print(f"[preprocessing] Loaded {len(df)} rows  |  {df.index[0].date()} → {df.index[-1].date()}")
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """
    Handle missing values:
    1. Forward-fill (market holidays / data gaps carry previous close)
    2. Backward-fill for leading NaNs
    3. Column-mean for any residual NaNs
    """
    df = df.copy()
    original_nulls = df.isnull().sum().sum()
    df = df.ffill().bfill()
    df = df.fillna(df.mean())
    remaining = df.isnull().sum().sum()
    print(f"[preprocessing] Nulls before: {original_nulls}  |  after: {remaining}")
    return df


def split_train_test(df: pd.DataFrame, test_ratio: float = 0.20):
    """
    Chronological 80/20 split — NO shuffling.
    Returns (df_train, df_test).
    """
    n = len(df)
    split_idx = int(n * (1 - test_ratio))
    df_train = df.iloc[:split_idx].copy()
    df_test  = df.iloc[split_idx:].copy()
    print(f"[preprocessing] Train: {len(df_train)} rows  ({df_train.index[0].date()} → {df_train.index[-1].date()})")
    print(f"[preprocessing] Test : {len(df_test)} rows   ({df_test.index[0].date()} → {df_test.index[-1].date()})")
    return df_train, df_test


def scale_features(df_train: pd.DataFrame, df_test: pd.DataFrame):
    """
    Fit RobustScaler on training set; apply to both train and test.
    Returns (X_train_scaled, X_test_scaled, y_train, y_test, scaler).
    Scaler is fit ONLY on training features — no lookahead.
    """
    scaler = RobustScaler()

    X_train_raw = df_train[FEATURE_COLS]
    X_test_raw  = df_test[FEATURE_COLS]
    y_train = df_train[TARGET_COL].copy()
    y_test  = df_test[TARGET_COL].copy()

    X_train_scaled = pd.DataFrame(
        scaler.fit_transform(X_train_raw),
        columns=FEATURE_COLS,
        index=df_train.index
    )
    X_test_scaled = pd.DataFrame(
        scaler.transform(X_test_raw),
        columns=FEATURE_COLS,
        index=df_test.index
    )

    print(f"[preprocessing] RobustScaler fitted on {len(X_train_scaled)} training rows")
    return X_train_scaled, X_test_scaled, y_train, y_test, scaler


def run(csv_path: str | Path, out_dir: str | Path = "../src/data") -> dict:
    """
    Full preprocessing pipeline for Model A (2009-11 dataset only).
    Returns a dict with all arrays needed by models.py.
    Also writes cleaned_data_a.json for the dashboard.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = load_raw(csv_path)
    df = clean(df)
    df_train, df_test = split_train_test(df)
    X_train, X_test, y_train, y_test, scaler = scale_features(df_train, df_test)

    # Export cleaned data JSON for dashboard
    export = {
        "meta": {
            "source": "Group_5.csv",
            "target": TARGET_COL,
            "features": FEATURE_COLS,
            "n_total": len(df),
            "n_train": len(df_train),
            "n_test": len(df_test),
            "train_start": str(df_train.index[0].date()),
            "train_end": str(df_train.index[-1].date()),
            "test_start": str(df_test.index[0].date()),
            "test_end": str(df_test.index[-1].date()),
        },
        "ise2_series": [
            {"date": str(d.date()), "value": float(v)}
            for d, v in df[TARGET_COL].items()
        ]
    }
    with open(out_dir / "cleaned_data_a.json", "w") as f:
        json.dump(export, f, indent=2)
    print(f"[preprocessing] Exported cleaned_data_a.json")

    return {
        "df": df,
        "df_train": df_train,
        "df_test": df_test,
        "X_train": X_train,
        "X_test": X_test,
        "y_train": y_train,
        "y_test": y_test,
        "scaler": scaler,
    }


if __name__ == "__main__":
    result = run("../data/Group_5.csv")
    print(result["X_train"].describe())
