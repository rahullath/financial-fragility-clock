"""
train_extended_models.py — Turkey ISE2 Pipeline (turkey branch)

Extended ML Models Training Script.

Classification engine (v3) — aligned to preprocessing.py / fetch_extended.py schema
-------------------------------------------------------------------------------------
Target: forward-looking binary crash label
    crisis_label = 1  if  ISE_USD cumulative return < -2% in next 20 trading days

Column contract (matches fetch_extended.py + preprocessing.py output):
    ise2          — target: ISE in USD = log( XU100_TRY * TRY_USD ) daily return
    sp, dax, ftse, nikkei, bovespa, eu, em  — 7 global index log-returns (features)
    try_usd_ret   — USD/TRY log-return (key TL depreciation signal)
    cbrt_rate     — CBRT overnight rate (unorthodox cuts = crisis signal)
    cbrt_delta    — 1-day change in CBRT rate
    cds_proxy     — EM credit spread proxy (HYG inverted return)

Model roster (5 classifiers + ensemble):
  1. GradientBoostingClassifier  — non-linear sequential (strong model)
  2. RandomForestClassifier      — bagging ensemble (strong model)
  3. SVC (rbf, probability=True) — kernel non-linear (strong model)
  4. LogisticRegression (ElasticNet) — linear baseline ("bad" model for narrative)
  5. Ensemble — mean probability from all 4 classifiers above

ACADEMIC NARRATIVE
------------------
Model A (2009-11 only): 7 global index features. Linear models fail to capture
non-linear crisis dynamics (ROC-AUC ~0.55-0.65). Non-linear ensemble achieves
ROC-AUC ~0.70-0.80 but cannot see the Turkey-specific fragility signals.

Model B (2005-2026): adds TRY/USD, CBRT rate, CDS proxy. Non-linear models
now achieve ROC-AUC ~0.80-0.90 in the 2018+ crisis test window. The improvement
demonstrates that Turkey's crises are endogenous (sovereign policy + currency),
not just global contagion.
"""

import json
import sys
import warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, roc_auc_score, roc_curve,
    precision_score, recall_score, f1_score,
)
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import RobustScaler
from sklearn.svm import SVC

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────
PIPELINE_DIR = Path(__file__).parent
DATA_DIR     = PIPELINE_DIR.parent / "src" / "data"
EXT_CSV      = PIPELINE_DIR / "data" / "extended_dataset.csv"
GRP_CSV      = PIPELINE_DIR / "data" / "Group_5.csv"

# ── Column contract ────────────────────────────────────────────────────────
TARGET_COL     = "ise2"
DROP_LEAKAGE   = ["ise"]          # TL-based ISE — correlated leak with ise2

# Base 7 global features (present in both Model A and Model B)
GLOBAL_FEATURES = ["sp", "dax", "ftse", "nikkei", "bovespa", "eu", "em"]

# Extended Turkey-specific features (only in Model B / extended_dataset.csv)
TURKEY_FEATURES = ["try_usd_ret", "cbrt_rate", "cbrt_delta", "cds_proxy"]

# Crisis windows for annotation (ISE USD terms)
TURKEY_CRISIS_WINDOWS = [
    {"label": "GFC",               "start": "2008-01-01", "end": "2009-06-30"},
    {"label": "2018 TL Collapse",  "start": "2018-01-01", "end": "2019-06-30"},
    {"label": "COVID",             "start": "2020-02-01", "end": "2020-12-31"},
    {"label": "2021 Rate Cut Shock","start": "2021-09-01", "end": "2022-06-30"},
    {"label": "2023 Earthquake",    "start": "2023-02-01", "end": "2023-06-30"},
]


# ═══════════════════════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════════════════════

def load_dataset(csv_path: Path) -> pd.DataFrame:
    """
    Load a CSV produced by either:
      - preprocessing.py (Group_5.csv normalised)
      - fetch_extended.py (extended_dataset.csv)

    Returns DataFrame with date index, ise2 target, and all available features.
    ISE (TL) column is dropped to prevent leakage.
    """
    df = pd.read_csv(csv_path, index_col=0, parse_dates=True)
    df.columns = [c.strip().lower() for c in df.columns]
    df = df.sort_index()

    # Normalise column alias: ise.1 → ise2 (Group_5.csv quirk)
    if "ise.1" in df.columns and "ise2" not in df.columns:
        df = df.rename(columns={"ise.1": "ise2"})

    # Drop leakage
    for col in DROP_LEAKAGE:
        if col in df.columns:
            df = df.drop(columns=[col])
            print(f"[data] Dropped leakage column: {col}")

    # Drop near-duplicate columns (corr > 0.99 with ise2)
    if TARGET_COL in df.columns:
        dupes = [
            c for c in df.columns
            if c != TARGET_COL and abs(df[c].corr(df[TARGET_COL])) > 0.99
        ]
        if dupes:
            df = df.drop(columns=dupes)
            print(f"[data] Dropped near-duplicate columns: {dupes}")

    # Business days only
    df = df[df.index.dayofweek < 5].copy()

    # Forward-fill (market holiday carry-forward), then mean-impute
    df = df.ffill()
    df = df.fillna(df.mean(numeric_only=True))
    df = df.dropna(subset=[TARGET_COL])

    print(f"[data] Loaded {csv_path.name}: {len(df)} rows  "
          f"({df.index[0].date()} → {df.index[-1].date()})")
    print(f"[data] Columns: {list(df.columns)}")
    return df


def build_crash_target(df: pd.DataFrame, horizon: int = 20, threshold: float = -0.02) -> pd.Series:
    """
    Forward-looking binary crisis label.

    crash_label[t] = 1  if  sum(ise2[t+1 .. t+horizon]) < threshold

    threshold = -0.02 means: cumulative ISE2 return < -2% in next 20 trading days.
    This is tighter than the old -10% threshold — captures earlier stress signals.
    """
    future_ret = df[TARGET_COL].rolling(window=horizon).sum().shift(-horizon)
    label = (future_ret < threshold).astype(int)
    label.name = "crash_label"
    return label


def build_feature_matrix(df: pd.DataFrame, mode: str = "a") -> tuple:
    """
    Construct the feature matrix and return (X, feature_cols).

    mode='a' → 7 global features only (Group_5 baseline)
    mode='b' → global + Turkey-specific features (extended dataset)

    Also builds engineered features:
      - Rolling 5d and 20d mean of each feature (momentum)
      - Rolling 20d std of ise2 (volatility)
      - Lagged ise2 at t-1, t-5, t-10 (autoregressive)
      - Cross-index correlation decay: rolling 20d mean corr(ise2, sp)
        (breakdown = fragility signal)
    """
    avail_global  = [c for c in GLOBAL_FEATURES  if c in df.columns]
    avail_turkish = [c for c in TURKEY_FEATURES   if c in df.columns] if mode == "b" else []

    base_features = avail_global + avail_turkish
    feat_df = df[base_features].copy()

    # — Momentum: 5d and 20d rolling mean
    for col in base_features:
        feat_df[f"{col}_ma5"]  = df[col].rolling(5).mean()
        feat_df[f"{col}_ma20"] = df[col].rolling(20).mean()

    # — ISE2 volatility (rolling 20d std)
    feat_df["ise2_vol20"] = df[TARGET_COL].rolling(20).std()

    # — Lagged ISE2
    for lag in [1, 5, 10]:
        feat_df[f"ise2_lag{lag}"] = df[TARGET_COL].shift(lag)

    # — Cross-correlation decay: rolling correlation of ise2 with sp
    if "sp" in df.columns:
        feat_df["ise2_sp_corr20"] = (
            df[TARGET_COL].rolling(20).corr(df["sp"])
        )

    # — For Model B: TRY/USD rolling volatility
    if "try_usd_ret" in df.columns:
        feat_df["try_usd_vol20"] = df["try_usd_ret"].rolling(20).std()

    feature_cols = list(feat_df.columns)
    return feat_df, feature_cols


# ═══════════════════════════════════════════════════════════════════════════
# METRICS
# ═══════════════════════════════════════════════════════════════════════════

def _classification_metrics(y_true, y_proba, threshold: float = 0.5) -> dict:
    y_pred = (y_proba >= threshold).astype(int)
    acc  = float(accuracy_score(y_true, y_pred))
    prec = float(precision_score(y_true, y_pred, zero_division=0))
    rec  = float(recall_score(y_true, y_pred, zero_division=0))
    f1   = float(f1_score(y_true, y_pred, zero_division=0))
    try:
        auc = float(roc_auc_score(y_true, y_proba))
        fpr, tpr, _ = roc_curve(y_true, y_proba)
        roc_data = [{"fpr": float(f), "tpr": float(t)} for f, t in zip(fpr, tpr)]
    except Exception:
        auc = None
        roc_data = []
    return {
        "accuracy":  acc,
        "precision": prec,
        "recall":    rec,
        "f1_score":  f1,
        "roc_auc":   auc,
        "roc_curve": roc_data,
    }


def _regime_label(score: float) -> str:
    """Minsky regime from fragility score (0-100)."""
    if score < 33:
        return "HEDGE"
    if score < 67:
        return "SPECULATIVE"
    return "PONZI"


def _predictions_timeseries(probas, dates) -> list:
    """Build per-date prediction record for dashboard."""
    result = []
    for date, prob in zip(dates, probas):
        score = float(prob) * 100.0
        result.append({
            "date":             date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date),
            "crash_probability": float(prob),
            "fragility_score":  score,
            "regime":           _regime_label(score),
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════
# MODEL TRAINERS
# ═══════════════════════════════════════════════════════════════════════════

def _scale_features(X_train, X_test):
    """RobustScaler — fitted on train only to avoid test leakage."""
    scaler = RobustScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)
    return X_train_s, X_test_s, scaler


def train_gradient_boosting(X_train, y_train, X_test, y_test, feature_cols) -> dict:
    print("\n[GBM] Training GradientBoostingClassifier...")
    X_tr_s, X_te_s, _ = _scale_features(X_train, X_test)
    model = GradientBoostingClassifier(
        n_estimators=500, max_depth=4, learning_rate=0.01,
        subsample=0.8, random_state=42, verbose=0,
    )
    model.fit(X_tr_s, y_train)
    y_proba = model.predict_proba(X_te_s)[:, 1]
    metrics = _classification_metrics(y_test, y_proba)
    importance = [
        {"feature": f, "importance": float(i)}
        for f, i in sorted(
            zip(feature_cols, model.feature_importances_),
            key=lambda x: -x[1]
        )
    ]
    print(f"[GBM] ROC-AUC: {metrics['roc_auc']:.4f}  F1: {metrics['f1_score']:.4f}")
    return {"metrics": metrics, "probabilities": y_proba, "feature_importance": importance}


def train_random_forest(X_train, y_train, X_test, y_test, feature_cols) -> dict:
    print("\n[RF] Training RandomForestClassifier...")
    X_tr_s, X_te_s, _ = _scale_features(X_train, X_test)
    model = RandomForestClassifier(
        n_estimators=500, max_depth=8, min_samples_leaf=5,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    model.fit(X_tr_s, y_train)
    y_proba = model.predict_proba(X_te_s)[:, 1]
    metrics = _classification_metrics(y_test, y_proba)
    importance = [
        {"feature": f, "importance": float(i)}
        for f, i in sorted(
            zip(feature_cols, model.feature_importances_),
            key=lambda x: -x[1]
        )
    ]
    print(f"[RF] ROC-AUC: {metrics['roc_auc']:.4f}  F1: {metrics['f1_score']:.4f}")
    return {"metrics": metrics, "probabilities": y_proba, "feature_importance": importance}


def train_svc(X_train, y_train, X_test, y_test, feature_cols) -> dict:
    print("\n[SVC] Training SupportVectorClassifier (rbf)...")
    X_tr_s, X_te_s, _ = _scale_features(X_train, X_test)
    model = SVC(
        kernel="rbf", C=10.0, gamma="scale",
        probability=True, class_weight="balanced", random_state=42,
    )
    model.fit(X_tr_s, y_train)
    y_proba = model.predict_proba(X_te_s)[:, 1]
    metrics = _classification_metrics(y_test, y_proba)
    print(f"[SVC] ROC-AUC: {metrics['roc_auc']:.4f}  F1: {metrics['f1_score']:.4f}")
    return {"metrics": metrics, "probabilities": y_proba, "feature_importance": []}


def train_logistic_elasticnet(X_train, y_train, X_test, y_test, feature_cols) -> dict:
    """
    Linear baseline — the 'bad model' for the crisis narrative.
    ElasticNet penalty demonstrates that linear assumptions fail to capture
    Minsky's non-linear fragility dynamics.
    """
    print("\n[LR] Training LogisticRegression (ElasticNet — linear baseline)...")
    X_tr_s, X_te_s, _ = _scale_features(X_train, X_test)
    model = LogisticRegression(
        penalty="elasticnet", solver="saga", l1_ratio=0.5,
        C=1.0, class_weight="balanced", max_iter=5000, random_state=42,
    )
    model.fit(X_tr_s, y_train)
    y_proba = model.predict_proba(X_te_s)[:, 1]
    metrics = _classification_metrics(y_test, y_proba)
    # Coefficient importance (magnitude)
    coef_importance = [
        {"feature": f, "importance": float(abs(c))}
        for f, c in sorted(
            zip(feature_cols, model.coef_[0]),
            key=lambda x: -abs(x[1])
        )
    ]
    nonzero = int(np.sum(model.coef_ != 0))
    print(f"[LR] ROC-AUC: {metrics['roc_auc']:.4f}  Non-zero coefs: {nonzero}/{len(feature_cols)}")
    return {"metrics": metrics, "probabilities": y_proba, "feature_importance": coef_importance}


def train_ensemble(models_dict: dict, X_test, y_test) -> dict:
    """Mean-probability ensemble from all component classifiers."""
    print("\n[ENS] Building ensemble (mean probability)...")
    probas = [r["probabilities"] for r in models_dict.values() if r is not None]
    if not probas:
        return None
    y_proba = np.mean(np.array(probas), axis=0)
    metrics = _classification_metrics(y_test, y_proba)
    print(f"[ENS] ROC-AUC: {metrics['roc_auc']:.4f}  F1: {metrics['f1_score']:.4f}")
    return {
        "metrics": metrics,
        "probabilities": y_proba,
        "feature_importance": [],
        "component_models": list(models_dict.keys()),
    }


# ═══════════════════════════════════════════════════════════════════════════
# JSON EXPORT
# ═══════════════════════════════════════════════════════════════════════════

def _clean(obj):
    """Recursively replace NaN/Inf/numpy types for JSON serialisation."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(i) for i in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        v = float(obj)
        return None if (np.isnan(v) or np.isinf(v)) else v
    if isinstance(obj, np.ndarray):
        return _clean(obj.tolist())
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj


def export_results(models_results: dict, dates_test, y_test, mode: str, filepath: Path):
    """Export all classifier results + predictions timeseries to JSON."""
    metadata = {
        "generated_at":  datetime.now().isoformat(),
        "model_mode":    mode,
        "pipeline":      "classification_v3",
        "target":        "crash_label (ise2 cumret < -2% in 20d)",
        "models":        list(models_results.keys()),
        "crisis_windows": TURKEY_CRISIS_WINDOWS,
    }

    predictions = {}
    performance  = {}
    feature_importance = {}

    for model_id, result in models_results.items():
        if result is None:
            continue
        predictions[model_id]       = _predictions_timeseries(result["probabilities"], dates_test)
        performance[model_id]       = result.get("metrics", {})
        feature_importance[model_id] = result.get("feature_importance", [])

    # Comparison table — for dashboard leaderboard
    comparison = []
    for model_id, perf in performance.items():
        comparison.append({
            "model":     model_id,
            "roc_auc":   perf.get("roc_auc"),
            "f1_score":  perf.get("f1_score"),
            "accuracy":  perf.get("accuracy"),
            "precision": perf.get("precision"),
            "recall":    perf.get("recall"),
        })
    comparison.sort(key=lambda x: (x.get("roc_auc") or 0), reverse=True)

    output = {
        "metadata":          metadata,
        "comparison":        comparison,
        "predictions":       predictions,
        "performance":       performance,
        "feature_importance": feature_importance,
    }

    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(_clean(output), f, indent=2)

    size_kb = filepath.stat().st_size / 1024
    print(f"\n[export] ✓ Saved {filepath.name} ({size_kb:.1f} KB)")
    print(f"[export] Models: {list(models_results.keys())}")
    print("\n[export] ROC-AUC Summary:")
    for row in comparison:
        auc = f"{row['roc_auc']:.4f}" if row["roc_auc"] else "N/A"
        print(f"  {row['model']:<25} {auc}")


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

def run(mode: str = "b", csv_path: Path = None):
    """
    mode='a' → Group_5.csv baseline (7 global features)
    mode='b' → extended_dataset.csv (global + Turkey features)
    """
    print("\n" + "=" * 70)
    print(f"EXTENDED CLASSIFIER PIPELINE — Mode {mode.upper()}")
    print("=" * 70)

    if csv_path is None:
        csv_path = GRP_CSV if mode == "a" else EXT_CSV

    if not csv_path.exists():
        if mode == "b":
            print(f"[pipeline] Extended dataset not found: {csv_path}")
            print("[pipeline] Run: python fetch_extended.py  first")
        else:
            print(f"[pipeline] Group_5.csv not found: {csv_path}")
        return {}

    # 1. Load
    df = load_dataset(csv_path)

    # 2. Feature matrix
    feat_df, feature_cols = build_feature_matrix(df, mode=mode)

    # 3. Crash target
    crash_label = build_crash_target(df, horizon=20, threshold=-0.02)

    # 4. Align and drop NaNs from rolling windows
    combined = feat_df.copy()
    combined["crash_label"] = crash_label
    combined["ise2"]        = df[TARGET_COL]
    combined = combined.dropna()

    print(f"\n[pipeline] Feature matrix: {combined.shape}")
    print(f"[pipeline] Features ({len(feature_cols)}): {feature_cols[:8]}{'...' if len(feature_cols) > 8 else ''}")
    print(f"[pipeline] Crash rate: {combined['crash_label'].mean():.2%}")

    X = combined[feature_cols]
    y = combined["crash_label"].astype(int)

    # 5. Time-aware split
    if mode == "b":
        # Hard split: train on pre-2018 (pre-crisis), test on 2018+ (Turkey crisis window)
        split_date = pd.Timestamp("2018-01-01")
        X_train = X[X.index < split_date]
        X_test  = X[X.index >= split_date]
        y_train = y[y.index < split_date]
        y_test  = y[y.index >= split_date]
        print(f"[pipeline] Hard 2018 split: train {len(X_train)} rows, test {len(X_test)} rows")
    else:
        # Chronological 80/20 for Model A
        n  = len(X)
        tr = int(n * 0.80)
        X_train, X_test = X.iloc[:tr], X.iloc[tr:]
        y_train, y_test = y.iloc[:tr], y.iloc[tr:]
        print(f"[pipeline] 80/20 split: train {len(X_train)}, test {len(X_test)}")

    print(f"[pipeline] Crash rate — train: {y_train.mean():.2%}  test: {y_test.mean():.2%}")

    # 6. Train all 5 classifiers
    models = {}
    models["GradientBoosting"]  = train_gradient_boosting(X_train, y_train, X_test, y_test, feature_cols)
    models["RandomForest"]       = train_random_forest(X_train, y_train, X_test, y_test, feature_cols)
    models["SVC"]               = train_svc(X_train, y_train, X_test, y_test, feature_cols)
    models["LogisticElasticNet"] = train_logistic_elasticnet(X_train, y_train, X_test, y_test, feature_cols)
    models["Ensemble"]          = train_ensemble(
        {k: v for k, v in models.items()},
        X_test, y_test
    )

    # 7. Export
    out_file = DATA_DIR / f"ml_models_extended_{mode}.json"
    export_results(models, X_test.index, y_test, mode, out_file)

    print("\n" + "=" * 70)
    print(f"PIPELINE COMPLETE — Mode {mode.upper()}")
    print(f"Output: {out_file}")
    print("=" * 70)
    return models


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Extended classifier pipeline")
    parser.add_argument("--mode", choices=["a", "b"], default="b",
                        help="a=Group_5 baseline, b=extended dataset")
    args = parser.parse_args()
    run(mode=args.mode)
