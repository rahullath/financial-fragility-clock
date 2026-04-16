"""
train_pipeline.py — Turkey ISE2 Pipeline (turkey branch)

Orchestrates the full training pipeline for both Model A and Model B.
Run this script to regenerate all JSON outputs for the dashboard.

Usage
-----
  # Model A only (uses Group_5.csv, 2009-11)
  python train_pipeline.py --model a

  # Model B only (downloads extended data first)
  python train_pipeline.py --model b

  # Both (default)
  python train_pipeline.py

Outputs (all written to src/data/)
  results_model_a.json   — Model A full output
  results_model_b.json   — Model B full output
  dashboard_data.json    — Combined payload: always contains both model_a + model_b keys

Note: --model a or --model b also writes dashboard_data.json.
      The missing model's key is populated with the previous results_model_*.json
      if available, or an empty {} shell if not yet run.
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np

from preprocessing import run as preprocess_a, FEATURE_COLS, TARGET_COL
from feature_engineering import build as engineer_features, get_feature_names
from target_engineering import attach_labels, crisis_stats, TURKEY_CRISIS_WINDOWS
from models import (
    train_ols,
    train_ridge,
    train_random_forest_regressor,
    train_random_forest_classifier,
    train_xgboost_regressor,
    train_xgboost_classifier,
    train_lstm,
    compare_models,
    build_ensemble_fragility,
)

DATA_DIR   = Path(__file__).parent.parent / "src" / "data"
CSV_PATH_A = Path(__file__).parent / "data" / "Group_5.csv"
EXT_CSV    = Path(__file__).parent / "data" / "extended_dataset.csv"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_for_json(obj):
    """Recursively convert numpy types and NaN/Inf to JSON-serialisable values."""
    if isinstance(obj, dict):
        return {k: _clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean_for_json(i) for i in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (np.isnan(v) or np.isinf(v)) else v
    if isinstance(obj, np.ndarray):
        return _clean_for_json(obj.tolist())
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj


def _save_json(data: dict, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(_clean_for_json(data), f, indent=2)
    size_kb = path.stat().st_size / 1024
    print(f"[pipeline] Saved {path.name}  ({size_kb:.1f} KB)")


def _load_json_safe(path: Path) -> dict:
    """Load JSON from disk; return {} if file doesn't exist."""
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {}


def _time_split(df: pd.DataFrame, test_ratio: float = 0.20):
    """Chronological split — returns (df_train, df_test)."""
    n = len(df)
    idx = int(n * (1 - test_ratio))
    return df.iloc[:idx].copy(), df.iloc[idx:].copy()


def _ise2_series_for_dashboard(df: pd.DataFrame) -> list:
    return [
        {"date": str(d.date()), "value": float(v)}
        for d, v in df["ise2"].items()
    ]


def _extract_dashboard_block(result: dict) -> dict:
    """
    Extract the subset of a model result needed for dashboard_data.json.
    Strips large arrays (coefficients, y_pred per model) to keep the
    combined dashboard file manageable.
    """
    rf_clf  = result.get("classification", {}).get("rf",      {})
    xgb_clf = result.get("classification", {}).get("xgboost", {})

    ensemble_fragility = build_ensemble_fragility(rf_clf, xgb_clf)

    return {
        "meta":           result.get("meta", {}),
        "crisis_stats":   result.get("crisis_stats", {}),
        "ise2_series":    result.get("ise2_series", []),
        "predictions":    result.get("predictions", {}),
        "reg_comparison": result.get("regression", {}).get("comparison", []),
        "clf_comparison": result.get("classification", {}).get("comparison", []),
        "feature_importance": {
            "rf":      result.get("regression", {}).get("rf",      {}).get("feature_importance", []),
            "xgboost": result.get("regression", {}).get("xgboost", {}).get("feature_importance", []),
            "rf_clf":      rf_clf.get("feature_importance", []),
            "xgboost_clf": xgb_clf.get("feature_importance", []),
        },
        "roc_curves": {
            "rf":      rf_clf.get("test_metrics", {}).get("roc_curve", []),
            "xgboost": xgb_clf.get("test_metrics", {}).get("roc_curve", []),
        },
        "fragility_scores": {
            "dates":    result.get("predictions", {}).get("dates", []),
            "rf":       rf_clf.get("fragility_scores", []),
            "xgboost":  xgb_clf.get("fragility_scores", []),
            "ensemble": ensemble_fragility,
        },
        "crisis_windows": result.get("meta", {}).get("crisis_windows", []),
    }


# ---------------------------------------------------------------------------
# Model A — 2009-11 baseline dataset
# ---------------------------------------------------------------------------

def run_model_a(csv_path: Path = CSV_PATH_A) -> dict:
    print("\n" + "=" * 60)
    print("MODEL A  —  2009-11 Baseline (Group_5.csv)")
    print("=" * 60)

    # 1. Preprocess
    prep = preprocess_a(csv_path, out_dir=DATA_DIR)
    df_raw = prep["df"]

    # 2. Feature engineering
    df_eng = engineer_features(df_raw)

    # 3. Attach crisis labels (for classification models)
    df_labeled = attach_labels(df_eng, forward_window=20)

    # 4. Time-aware split
    df_train, df_test = _time_split(df_labeled, test_ratio=0.20)

    feat_cols = get_feature_names(df_labeled)
    feat_cols = [c for c in feat_cols if c != "crash_label"]

    X_train = df_train[feat_cols]
    X_test  = df_test[feat_cols]
    y_reg_train = df_train["ise2"]
    y_reg_test  = df_test["ise2"]
    y_clf_train = df_train["crash_label"]
    y_clf_test  = df_test["crash_label"]

    print(f"\nModel A — {len(feat_cols)} features")
    print(f"Train: {len(df_train)} rows  |  Test: {len(df_test)} rows")
    print(f"Crisis ratio — train: {y_clf_train.mean():.2%}  test: {y_clf_test.mean():.2%}")

    # 5. Regression models
    ols_res      = train_ols(X_train, y_reg_train, X_test, y_reg_test)
    ridge_res    = train_ridge(X_train, y_reg_train, X_test, y_reg_test)
    rf_reg_res   = train_random_forest_regressor(X_train, y_reg_train, X_test, y_reg_test)
    xgb_reg_res  = train_xgboost_regressor(X_train, y_reg_train, X_test, y_reg_test)
    lstm_reg_res = train_lstm(X_train, y_reg_train, X_test, y_reg_test,
                              mode="regression", epochs=60)
    reg_comparison = compare_models(
        [ols_res, ridge_res, rf_reg_res, xgb_reg_res, lstm_reg_res],
        mode="regression"
    )

    # 6. Classification models
    rf_clf_res  = train_random_forest_classifier(X_train, y_clf_train, X_test, y_clf_test)
    xgb_clf_res = train_xgboost_classifier(X_train, y_clf_train, X_test, y_clf_test)
    clf_comparison = compare_models([rf_clf_res, xgb_clf_res], mode="classification")

    # 7. Predictions series
    test_dates = [str(d.date()) for d in df_test.index]
    predictions_series = {
        "dates":   test_dates,
        "actual":  y_reg_test.tolist(),
        "ols":     ols_res.get("y_pred", []),
        "ridge":   ridge_res.get("y_pred", []),
        "rf":      rf_reg_res.get("y_pred", []),
        "xgboost": xgb_reg_res.get("y_pred", []),
        "lstm":    lstm_reg_res.get("y_pred", []),
        "crisis_labels": y_clf_test.tolist(),
    }

    result = {
        "meta": {
            "model": "A",
            "dataset": "Group_5.csv (2009-11)",
            "train_start": str(df_train.index[0].date()),
            "train_end":   str(df_train.index[-1].date()),
            "test_start":  str(df_test.index[0].date()),
            "test_end":    str(df_test.index[-1].date()),
            "n_train":    len(df_train),
            "n_test":     len(df_test),
            "n_features": len(feat_cols),
            "feature_names": feat_cols,
        },
        "crisis_stats":  crisis_stats(y_clf_test),
        "ise2_series":   _ise2_series_for_dashboard(df_labeled),
        "predictions":   predictions_series,
        "regression": {
            "ols":      ols_res,
            "ridge":    ridge_res,
            "rf":       rf_reg_res,
            "xgboost":  xgb_reg_res,
            "lstm":     lstm_reg_res,
            "comparison": reg_comparison,
        },
        "classification": {
            "rf":       rf_clf_res,
            "xgboost":  xgb_clf_res,
            "comparison": clf_comparison,
        },
    }
    _save_json(result, DATA_DIR / "results_model_a.json")
    return result


# ---------------------------------------------------------------------------
# Model B — Extended 2005-2024 dataset
# ---------------------------------------------------------------------------

def run_model_b(ext_csv: Path = EXT_CSV) -> dict:
    print("\n" + "=" * 60)
    print("MODEL B  —  Extended 2005-2026 Dataset")
    print("=" * 60)

    if not ext_csv.exists():
        print(f"[pipeline] Extended dataset not found at {ext_csv}")
        print("[pipeline] Run: python fetch_extended.py  first")
        return {"error": "extended_dataset_not_found"}

    df_raw = pd.read_csv(ext_csv, index_col=0, parse_dates=True).sort_index()
    df_raw = df_raw.ffill().dropna(subset=["ise2"])
    print(f"[pipeline] Extended: {len(df_raw)} rows  "
          f"({df_raw.index[0].date()} → {df_raw.index[-1].date()})")

    df_eng     = engineer_features(df_raw)
    df_labeled = attach_labels(df_eng, forward_window=20)

    # Hard split: train on pre-crisis era, test on Turkey Crisis 2018→present
    crisis_start = "2018-01-01"
    df_train = df_labeled[df_labeled.index <  crisis_start].copy()
    df_test  = df_labeled[df_labeled.index >= crisis_start].copy()

    print(f"[pipeline] Train: {len(df_train)} rows  |  "
          f"Test (crisis window): {len(df_test)} rows")

    feat_cols = get_feature_names(df_labeled)
    feat_cols = [c for c in feat_cols if c != "crash_label"]
    feat_cols = [c for c in feat_cols
                 if c in df_train.columns and c in df_test.columns]

    X_train = df_train[feat_cols]
    X_test  = df_test[feat_cols]
    y_reg_train = df_train["ise2"]
    y_reg_test  = df_test["ise2"]
    y_clf_train = df_train["crash_label"]
    y_clf_test  = df_test["crash_label"]

    print(f"\nModel B — {len(feat_cols)} features")
    print(f"Crisis ratio — train: {y_clf_train.mean():.2%}  test: {y_clf_test.mean():.2%}")

    # Regression
    ols_res      = train_ols(X_train, y_reg_train, X_test, y_reg_test)
    ridge_res    = train_ridge(X_train, y_reg_train, X_test, y_reg_test)
    rf_reg_res   = train_random_forest_regressor(X_train, y_reg_train, X_test, y_reg_test)
    xgb_reg_res  = train_xgboost_regressor(X_train, y_reg_train, X_test, y_reg_test)
    lstm_reg_res = train_lstm(X_train, y_reg_train, X_test, y_reg_test,
                              mode="regression", epochs=60)
    reg_comparison = compare_models(
        [ols_res, ridge_res, rf_reg_res, xgb_reg_res, lstm_reg_res],
        mode="regression"
    )

    # Classification
    rf_clf_res  = train_random_forest_classifier(X_train, y_clf_train, X_test, y_clf_test)
    xgb_clf_res = train_xgboost_classifier(X_train, y_clf_train, X_test, y_clf_test)
    clf_comparison = compare_models([rf_clf_res, xgb_clf_res], mode="classification")

    test_dates = [str(d.date()) for d in df_test.index]
    predictions_series = {
        "dates":   test_dates,
        "actual":  y_reg_test.tolist(),
        "ols":     ols_res.get("y_pred", []),
        "ridge":   ridge_res.get("y_pred", []),
        "rf":      rf_reg_res.get("y_pred", []),
        "xgboost": xgb_reg_res.get("y_pred", []),
        "lstm":    lstm_reg_res.get("y_pred", []),
        "crisis_labels": y_clf_test.tolist(),
    }

    result = {
        "meta": {
            "model": "B",
            "dataset": "extended (yfinance + FRED)",
            "train_start": str(df_train.index[0].date()),
            "train_end":   str(df_train.index[-1].date()),
            "test_start":  str(df_test.index[0].date()),
            "test_end":    str(df_test.index[-1].date()),
            "n_train":     len(df_train),
            "n_test":      len(df_test),
            "n_features":  len(feat_cols),
            "feature_names": feat_cols,
            "crisis_windows": TURKEY_CRISIS_WINDOWS,
        },
        "crisis_stats":  crisis_stats(y_clf_test),
        "ise2_series":   _ise2_series_for_dashboard(df_labeled),
        "predictions":   predictions_series,
        "regression": {
            "ols":      ols_res,
            "ridge":    ridge_res,
            "rf":       rf_reg_res,
            "xgboost":  xgb_reg_res,
            "lstm":     lstm_reg_res,
            "comparison": reg_comparison,
        },
        "classification": {
            "rf":       rf_clf_res,
            "xgboost":  xgb_clf_res,
            "comparison": clf_comparison,
        },
    }
    _save_json(result, DATA_DIR / "results_model_b.json")
    return result


# ---------------------------------------------------------------------------
# Dashboard combiner — always produces both model_a + model_b keys
# ---------------------------------------------------------------------------

def build_dashboard_payload(result_a: dict, result_b: dict) -> dict:
    """
    Merge Model A + Model B outputs into dashboard_data.json.
    This is the single file the React frontend reads.

    Always contains both 'model_a' and 'model_b' top-level keys.
    If only one model was run, loads the other from disk (if available).

    Dashboard chart data
    --------------------
    1.  ISE2 timeseries (full) — annotated with crisis windows
    2.  Actual vs Predicted — multi-line chart (5 models, both datasets)
    3.  Regression comparison — R2/RMSE/MAE per model × dataset
    4.  Classification comparison — ROC-AUC/F1/Precision/Recall × dataset
    5.  Feature importance — RF + XGB (regression + classification), A vs B
    6.  ROC curves — RF + XGB, both datasets
    7.  Fragility score — ensemble EMA5 score over test window
    8.  Crisis window annotations — shaded bands for all timeseries
    """
    payload = {
        "generated_at": datetime.now().isoformat(),
        "model_a": _extract_dashboard_block(result_a) if result_a else {},
        "model_b": _extract_dashboard_block(result_b) if result_b else {},
    }
    _save_json(payload, DATA_DIR / "dashboard_data.json")
    return payload


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Turkey ISE2 Training Pipeline")
    parser.add_argument(
        "--model", choices=["a", "b", "both"], default="both",
        help="Which model pipeline to run (default: both)"
    )
    args = parser.parse_args()

    result_a, result_b = {}, {}

    if args.model in ("a", "both"):
        result_a = run_model_a()
    else:
        # Load existing Model A results from disk so dashboard stays complete
        result_a = _load_json_safe(DATA_DIR / "results_model_a.json")
        if result_a:
            print(f"[pipeline] Loaded existing results_model_a.json "
                  f"(train: {result_a.get('meta', {}).get('train_end', '?')})")

    if args.model in ("b", "both"):
        result_b = run_model_b()
    else:
        # Load existing Model B results from disk
        result_b = _load_json_safe(DATA_DIR / "results_model_b.json")
        if result_b:
            print(f"[pipeline] Loaded existing results_model_b.json "
                  f"(train: {result_b.get('meta', {}).get('train_end', '?')})")

    build_dashboard_payload(result_a, result_b)
    print("\n[pipeline] ✓ dashboard_data.json ready — model_a + model_b keys present")
    print("[pipeline] Done.")
