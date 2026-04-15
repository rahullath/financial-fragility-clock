"""
Model B Pipeline Orchestration Script.

Runs all Model B modules in sequence:
  1. Fetch market data (yfinance)
  2. Fetch macro data (FRED API — optional)
  3. Preprocess and merge data
  4. Feature engineering (correlations, PE, volatility, fragility score)
  5. Regime labeling (historically-verified Minsky cycles)
  6. Model training with walk-forward validation
  7. Crisis prediction validation
  8. SHAP analysis for crisis periods
  9. Export all JSON artefacts to src/data/

Usage (from repo root):
    ./venv/bin/python python/model_b/export_json_b.py

Or with a FRED API key for macro signals:
    FRED_API_KEY=your_key ./venv/bin/python python/model_b/export_json_b.py

ACADEMIC CONTEXT
----------------
Model B uses two complementary approaches:
  a) Walk-forward regression (ISE_USD target) — tests whether pre-crisis
     features predict crisis-period ISE returns (2008 and 2020 splits).
  b) Classification pass (binary crash target, 30-day horizon) — generates
     `crash_probability` for the full 2003-2025 time series so the dashboard
     displays a continuous ML-derived fragility probability curve.

Requirements: 22.1, 22.2, 22.5, 26.1, 26.3
"""

import os
import sys
import json
import warnings
from datetime import datetime
from pathlib import Path

# ── Ensure we can import sibling modules ──────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR))

import pandas as pd
import numpy as np

# ── Path helpers ──────────────────────────────────────────────────────────────
REPO_ROOT = SCRIPT_DIR.parent.parent
DATA_DIR = REPO_ROOT / "src" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

CLEANED_DATA_PATH = str(DATA_DIR / "model_b_cleaned_data.json")
FEATURES_PATH = str(DATA_DIR / "model_b_features.json")
OUTPUTS_PATH = str(DATA_DIR / "model_b_outputs.json")


# ── Logging helpers ────────────────────────────────────────────────────────────
def log(msg: str) -> None:
    """Print a timestamped log line."""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def section(title: str) -> None:
    bar = "=" * 60
    print(f"\n{bar}")
    print(f"  {title}")
    print(f"{bar}")


# ── Stage helpers ──────────────────────────────────────────────────────────────
def stage_fetch_and_preprocess(api_key: str | None) -> pd.DataFrame:
    from fetch_market_data import fetch_market_data, handle_missing_data, validate_data
    from fetch_turkish_macro import fetch_turkish_macro, get_crisis_annotations, _merge_with_turkish_macro
    from preprocessing_b import handle_missing_values, validate_data_completeness, \
                                 compute_descriptive_stats, export_to_json

    section("STAGE 1 — Fetch & Preprocess (Turkish Macro Pivot)")

    market_df = handle_missing_data(fetch_market_data(
        start_date="2003-01-01", end_date="2025-12-31"), max_gap=5)
    validate_data(market_df)

    # TRY=X, XU100.IS, ^VIX via yfinance — no API key needed.
    # TR_YIELD10Y via FRED only if api_key provided.
    turkish_df = fetch_turkish_macro(
        start_date="2003-01-01", end_date="2025-12-31", fred_api_key=api_key)

    clean_df = handle_missing_values(_merge_with_turkish_macro(market_df, turkish_df), max_gap=5)
    validate_data_completeness(clean_df)
    export_to_json(clean_df, compute_descriptive_stats(clean_df), CLEANED_DATA_PATH)

    # Crisis annotations for dashboard overlay
    with open(str(DATA_DIR / "crisis_annotations.json"), "w") as f:
        json.dump({"events": get_crisis_annotations()}, f, indent=2)

    log(f"Stage 1 complete: {len(clean_df)} obs × {len(clean_df.columns)} cols")
    return clean_df

def stage_feature_engineering(clean_df: pd.DataFrame) -> pd.DataFrame:
    """Compute all features and export model_b_features.json."""
    from feature_engineering_b import (
        compute_rolling_correlation,
        compute_permutation_entropy,
        compute_rolling_volatility,
        normalize_macro_signals,
        compute_fragility_score_b,
        export_features,
    )
    from fetch_turkish_macro import get_crisis_annotations

    section("STAGE 2 — Feature Engineering")

    log("Computing rolling correlations (60-day window, 13 indices) …")
    corr_features = compute_rolling_correlation(clean_df, window=60)

    # Use SP500 as the reference return series for PE and volatility
    ref_col = "SP500" if "SP500" in clean_df.columns else clean_df.columns[0]
    log(f"Computing permutation entropy on {ref_col} …")
    pe_series = compute_permutation_entropy(clean_df[ref_col], m=3, delay=1, window=30)

    log("Computing rolling volatility …")
    rolling_vol = compute_rolling_volatility(clean_df[ref_col], window=30)

    log("Normalizing macro signals …")
    macro_normalized = normalize_macro_signals(clean_df)

    log("Computing Model B fragility score …")
    vix_norm = macro_normalized.get("VIX_norm")
    ted_norm = macro_normalized.get("TED_SPREAD_norm")
    yield_norm = macro_normalized.get("YIELD_SPREAD_norm")

    fragility_score = compute_fragility_score_b(
        corr_features["mean_corr"],
        pe_series,
        rolling_vol,
        corr_features["eigenvalue_ratio"],
        vix_norm=vix_norm,
        ted_norm=ted_norm,
        yield_spread_norm=yield_norm,
    )

    log("Combining all features into single DataFrame …")
    features_df = corr_features.copy()
    features_df["permutation_entropy"] = pe_series
    features_df["rolling_volatility"] = rolling_vol
    features_df["fragility_score"] = fragility_score

    # Attach macro signal columns so regime labeler can use them
    for col in clean_df.columns:
        if col not in features_df.columns:
            features_df[col] = clean_df[col]

    # Attach normalized macro signals
    for col in macro_normalized.columns:
        features_df[col] = macro_normalized[col]

    # Attach crisis annotations for dashboard overlay
    with open(str(DATA_DIR / "crisis_annotations.json"), "w") as f:
        json.dump({"events": get_crisis_annotations()}, f, indent=2)  
    
    # BIST/ISE divergence: key Turkey-specific signal.
    # Spikes when TRY depreciates: BIST holds in local terms but ISE_USD collapses.
    if "BIST100_ret" in clean_df.columns and "ISE_USD" in clean_df.columns:
        ise_ret  = np.log(clean_df["ISE_USD"] / clean_df["ISE_USD"].shift(1))
        bist_roll = clean_df["BIST100_ret"].rolling(5).sum()
        ise_roll  = ise_ret.rolling(5).sum()
        features_df["BIST_ISE_DIV"] = (bist_roll - ise_roll).reindex(features_df.index)
        log("Added BIST_ISE_DIV to feature matrix.")

    log(f"Exporting features ({features_df.shape}) → {FEATURES_PATH}")
    export_features(features_df, FEATURES_PATH)

    log(f"Stage 2 complete. Valid fragility scores: {fragility_score.notna().sum()}")
    return features_df


def stage_regime_labeling(features_df: pd.DataFrame) -> pd.DataFrame:
    """Label Minsky regimes and update the features JSON in place."""
    from regime_labeling_b import label_minsky_regimes

    section("STAGE 3 — Regime Labeling")

    log("Running historically-verified Minsky regime classifier …")
    labeled_df = label_minsky_regimes(features_df, use_adaptive_thresholds=True)

    # Print distribution
    counts = labeled_df["regime"].value_counts()
    for regime in ["HEDGE", "SPECULATIVE", "PONZI"]:
        n = counts.get(regime, 0)
        pct = 100 * n / len(labeled_df)
        log(f"  {regime:12s}: {n:5d} ({pct:5.1f}%)")

    # Merge regime columns back into the features JSON on disk
    log(f"Updating {FEATURES_PATH} with regime labels …")
    with open(FEATURES_PATH, "r") as f:
        features_data = json.load(f)

    for i, (date, row) in enumerate(labeled_df.iterrows()):
        features_data["data"][i]["regime"] = row["regime"]
        features_data["data"][i]["regime_confidence"] = (
            float(row["regime_confidence"]) if not pd.isna(row["regime_confidence"]) else None
        )

    features_data["metadata"]["regime_labeling"] = {
        "method": "historically_verified",
        "crisis_periods": [
            {"start": "2008-09-01", "end": "2009-03-31", "description": "2008 Financial Crisis"},
            {"start": "2020-03-01", "end": "2020-03-31", "description": "COVID-19 Crash"},
        ],
        "adaptive_thresholds": True,
        "timestamp": datetime.now().isoformat(),
    }

    with open(FEATURES_PATH, "w") as f:
        json.dump(features_data, f, indent=2)

    log("Stage 3 complete.")
    return labeled_df


def stage_model_training(labeled_df: pd.DataFrame) -> tuple[dict, dict, dict]:
    """Walk-forward RF, crisis prediction, and SHAP analysis."""
    from models_b import (
        train_random_forest_walk_forward,
        validate_crisis_prediction,
        compute_shap_values_b,
        export_model_outputs_b,
    )

    section("STAGE 4 — Model Training & Validation")

    log("Running walk-forward validation (2003→2008, 2003→2020) …")
    walk_forward_results = train_random_forest_walk_forward(labeled_df, target_col="SP500")

    # Classification pass: generate crash_probability for the full 2003-2025 series
    log("Generating crash_probability (RF classifier, 30-day horizon) ...")
    crash_probability = _stage_crash_probability(labeled_df)
    if crash_probability is not None:
        labeled_df = labeled_df.copy()
        labeled_df["crash_probability"] = crash_probability
        log(f"  crash_probability populated for {crash_probability.notna().sum()} rows")
        
        # Export slim features JSON for frontend (without heavy pairwise correlations)
        try:
            with open(FEATURES_PATH, "r") as f:
                features_data = json.load(f)
                
            features_data["metadata"]["features"].append("crash_probability")
            
            for i, row in enumerate(features_data["data"]):
                date_str = row["date"]
                if "T" in date_str:
                    date_str = date_str.split("T")[0]
                else:
                    date_str = date_str.split(" ")[0]
                
                # Fetch prob directly by converting labeled_df index to strings
                prob = None
                try:
                    dt = pd.to_datetime(date_str)
                    if dt in crash_probability.index:
                        prob = float(crash_probability.loc[dt])
                        if pd.isna(prob): prob = None
                except Exception:
                    pass
                
                row["crash_probability"] = prob
                # Eliminate pairwise_correlations to keep the file small enough for Vite
                if "pairwise_correlations" in row:
                    del row["pairwise_correlations"]
                    
            if "pairwise_correlation_pairs" in features_data["metadata"]:
                del features_data["metadata"]["pairwise_correlation_pairs"]
                
            slim_path = str(Path(FEATURES_PATH).parent / "model_b_features_slim.json")
            with open(slim_path, "w") as f:
                json.dump(features_data, f, indent=2)
            log(f"  Exported slim features JSON -> {slim_path}")
        except Exception as e:
            log(f"  WARNING: Failed to export slim features JSON: {e}")

    log("Running crisis prediction validation ...")
    crisis_results = validate_crisis_prediction(labeled_df)

    log("Computing SHAP values for crisis periods …")
    shap_results = compute_shap_values_b(labeled_df, target_col="SP500")

    log(f"Exporting model outputs → {OUTPUTS_PATH}")
    export_model_outputs_b(
        walk_forward_results=walk_forward_results,
        crisis_prediction_results=crisis_results,
        shap_results=shap_results,
        filepath=OUTPUTS_PATH,
    )

    log("Stage 4 complete.")
    return walk_forward_results, crisis_results, shap_results


def _stage_crash_probability(labeled_df: pd.DataFrame) -> "pd.Series | None":
    """
    Fit a RF Classifier on a 30-day forward ISE_USD crash target and return
    probabilistic scores for the full 2003-2025 dataset.

    Supplementary to the heuristic fragility_score. Populates the
    `crash_probability` column in model_b_features_slim.json so every
    dashboard date has an ML-derived crash probability.
    """
    try:
        # Ensure the parent python/ directory is on the path for target_engineering
        _parent = Path(__file__).parent.parent.resolve()
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))

        from target_engineering import create_crash_target
        from sklearn.ensemble import RandomForestClassifier

        feature_cols = []
        for col in ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM',
                    'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200']:
            if col in labeled_df.columns:
                feature_cols.append(col)
        for col in ['mean_corr', 'eigenvalue_ratio', 'permutation_entropy', 'rolling_volatility']:
            if col in labeled_df.columns:
                feature_cols.append(col)

        target_col = 'SP500'  # Model B fetches yfinance data; ISE_USD is not in scope
        crash_target = create_crash_target(labeled_df, col=target_col, horizon=30, threshold=-0.10)

        df_model = labeled_df[feature_cols].copy()
        df_model['crash_target'] = crash_target
        df_model = df_model.dropna()
        for col in feature_cols:
            df_model[col] = pd.to_numeric(df_model[col], errors='coerce')
        df_model = df_model.dropna()

        X = df_model[feature_cols]
        y = df_model['crash_target'].astype(int)
        train_size = int(len(X) * 0.8)

        rf_clf = RandomForestClassifier(
            n_estimators=300, max_depth=10, min_samples_split=10,
            class_weight='balanced', random_state=42, n_jobs=-1,
        )
        rf_clf.fit(X.iloc[:train_size], y.iloc[:train_size])

        probas = pd.Series(
            rf_clf.predict_proba(X)[:, 1],
            index=df_model.index,
            name='crash_probability',
        )
        return probas

    except ImportError as exc:
        log(f"  WARNING: crash_probability skipped — missing module: {exc}")
        return None
    except Exception as exc:
        import traceback
        log(f"  WARNING: crash_probability generation failed: {exc}")
        traceback.print_exc()
        return None



def _stage_crash_probability(labeled_df):
    """
    Fit a RF Classifier on a 30-day forward ISE_USD crash target and return
    probabilistic scores for the full 2003-2025 dataset.

    Supplementary to the heuristic fragility_score. Populates the
    `crash_probability` column so every dashboard date has an ML-derived
    crash probability.
    """
    try:
        import sys
        _parent = Path(__file__).parent.parent.resolve()
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))

        from target_engineering import create_crash_target
        from sklearn.ensemble import RandomForestClassifier

        feature_cols = []
        for col in ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM',
                    'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200']:
            if col in labeled_df.columns:
                feature_cols.append(col)
        for col in ['mean_corr', 'eigenvalue_ratio', 'permutation_entropy', 'rolling_volatility']:
            if col in labeled_df.columns:
                feature_cols.append(col)

        if not feature_cols:
            return None

        target_col = 'SP500'  # Model B has no ISE_USD column — uses SP500
        crash_target = create_crash_target(labeled_df, col=target_col, horizon=30, threshold=-0.10)

        df_m = labeled_df[feature_cols].copy()
        df_m['crash_target'] = crash_target
        df_m = df_m.dropna()
        for col in feature_cols:
            df_m[col] = pd.to_numeric(df_m[col], errors='coerce')
        df_m = df_m.dropna()

        if df_m.empty:
            return None

        X = df_m[feature_cols]
        y = df_m['crash_target'].astype(int)
        train_size = int(len(X) * 0.8)

        rf_clf = RandomForestClassifier(
            n_estimators=300, max_depth=10, min_samples_split=10,
            class_weight='balanced', random_state=42, n_jobs=-1,
        )
        rf_clf.fit(X.iloc[:train_size], y.iloc[:train_size])

        return pd.Series(
            rf_clf.predict_proba(X)[:, 1],
            index=df_m.index,
            name='crash_probability',
        )

    except ImportError as exc:
        log(f"  WARNING: crash_probability skipped -- missing module: {exc}")
        return None
    except Exception as exc:
        import traceback
        log(f"  WARNING: crash_probability generation failed: {exc}")
        traceback.print_exc()
        return None


def print_summary(walk_forward_results: dict, crisis_results: dict) -> None:
    """Print an end-of-run summary."""
    section("PIPELINE SUMMARY")

    # Walk-forward
    for split_name, split in walk_forward_results.items():
        if "error" in split:
            log(f"  {split_name}: SKIPPED ({split['error']})")
        else:
            log(
                f"  {split_name} — test R²: {split['metrics']['test_r2']:.4f}  "
                f"RMSE: {split['metrics']['test_rmse']:.6f}"
            )

    # Crisis prediction
    successes = sum(
        1 for r in crisis_results.values()
        if isinstance(r, dict) and r.get("peak_detected_3_6_months", False)
    )
    total = sum(
        1 for r in crisis_results.values()
        if isinstance(r, dict) and "error" not in r
    )
    log(f"  Crisis predictions: {successes}/{total} detected in 3-6 month window")

    # Output files
    section("OUTPUT FILES")
    for path in [CLEANED_DATA_PATH, FEATURES_PATH, OUTPUTS_PATH]:
        p = Path(path)
        if p.exists():
            size_mb = p.stat().st_size / 1024 / 1024
            log(f"  ✓ {p.name}  ({size_mb:.2f} MB)")
        else:
            log(f"  ✗ {p.name}  NOT CREATED")


# ── Main entry point ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    section("MODEL B PIPELINE — FINANCIAL FRAGILITY CLOCK")
    log(f"Python: {sys.version.split()[0]}")
    log(f"Working directory: {Path.cwd()}")
    log(f"Output directory:  {DATA_DIR}")

    start_time = datetime.now()

    # Resolve FRED API key
    fred_api_key = os.environ.get("FRED_API_KEY")
    if fred_api_key:
        log("FRED_API_KEY detected — macro signals will be included.")
    else:
        log("FRED_API_KEY not set — macro signals will be ABSENT from this run.")

    try:
        # Stage 1 — fetch + preprocess
        clean_df = stage_fetch_and_preprocess(fred_api_key)

        # Stage 2 — feature engineering
        features_df = stage_feature_engineering(clean_df)

        # Stage 3 — regime labeling
        labeled_df = stage_regime_labeling(features_df)

        # Stage 4 — model training + SHAP
        walk_forward_results, crisis_results, shap_results = stage_model_training(labeled_df)

        # Summary
        elapsed = (datetime.now() - start_time).total_seconds()
        print_summary(walk_forward_results, crisis_results)
        log(f"\nPipeline completed in {elapsed:.1f}s")

    except FileNotFoundError as exc:
        log(f"ERROR — file not found: {exc}")
        log("Ensure raw data dependencies exist and that all modules are on the Python path.")
        sys.exit(1)
    except Exception as exc:
        import traceback
        log(f"ERROR — unexpected failure: {exc}")
        traceback.print_exc()
        sys.exit(1)
