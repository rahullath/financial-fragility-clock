"""
models.py — Turkey ISE2 Pipeline (turkey branch)

Five ML models compared across Model A (2009-11) and Model B (2005-2024):
  1. OLS / Linear Regression  — interpretable baseline
  2. Ridge Regression         — handles multicollinearity in global indices
  3. Random Forest            — non-linear, feature importance via Gini
  4. XGBoost                  — best tabular performance, regularised against overfit
  5. LSTM                     — sequence model for autocorrelated daily returns

Both regression (ISE2 return) and classification (crisis_label) modes are
supported.  The caller (train_pipeline.py) decides which mode to use.

All time-series CV uses TimeSeriesSplit — no shuffling, no future leakage.

Key fixes vs previous version
------------------------------
- Classifier threshold: precision-recall optimised on train set, NOT hardcoded 0.5
  (6% base rate makes default threshold useless — F1=0.0 with 0.5)
- XGBoost regressor: max_depth=4 + regularisation (was overfitting at train R²=0.995)
- XGBoost classifier: same regularisation
- Fragility score: ensemble of RF+XGB probabilities with 5-day EMA smoothing
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, roc_auc_score, roc_curve, f1_score,
    precision_recall_curve,
)
import warnings
warnings.filterwarnings("ignore")


# ============================================================
# Utilities
# ============================================================

def _tscv_regression(model_cls, model_kwargs, X: pd.DataFrame, y: pd.Series, n_splits=5):
    """Run TimeSeriesSplit CV; return list of per-fold R2 scores."""
    tscv = TimeSeriesSplit(n_splits=n_splits)
    scores = []
    for tr_idx, va_idx in tscv.split(X):
        m = model_cls(**model_kwargs)
        m.fit(X.iloc[tr_idx], y.iloc[tr_idx])
        pred = m.predict(X.iloc[va_idx])
        scores.append(r2_score(y.iloc[va_idx], pred))
    return scores


def _reg_metrics(y_true, y_pred) -> dict:
    return {
        "r2":   float(r2_score(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mae":  float(mean_absolute_error(y_true, y_pred)),
    }


def _clf_metrics(y_true, y_pred, y_proba) -> dict:
    """Classification metrics — includes compact ROC curve for dashboard."""
    metrics = {
        "accuracy":  float(accuracy_score(y_true, y_pred)),
        "f1":        float(f1_score(y_true, y_pred, zero_division=0)),
        "precision": float(f1_score(y_true, y_pred, average="binary", zero_division=0)),
        "recall":    float(np.sum((y_pred == 1) & (y_true == 1)) / max(np.sum(y_true == 1), 1)),
    }
    try:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba))
        fpr, tpr, _ = roc_curve(y_true, y_proba)
        # Downsample ROC curve to max 200 points for JSON size
        step = max(1, len(fpr) // 200)
        metrics["roc_curve"] = [
            {"fpr": float(f), "tpr": float(t)}
            for f, t in zip(fpr[::step], tpr[::step])
        ]
    except Exception:
        metrics["roc_auc"] = None
        metrics["roc_curve"] = []
    return metrics


def _optimal_threshold(y_train_true, y_train_proba) -> float:
    """
    Find probability threshold that maximises F1 on the training set.
    For a ~6% base rate, this is typically 0.15-0.35, NOT 0.5.
    Falls back to 0.3 if no positive examples found.
    """
    try:
        precision, recall, thresholds = precision_recall_curve(y_train_true, y_train_proba)
        # F1 at each threshold
        f1_scores = np.where(
            (precision + recall) > 0,
            2 * precision * recall / (precision + recall),
            0
        )
        best_idx = np.argmax(f1_scores[:-1])  # thresholds has one fewer element
        return float(thresholds[best_idx])
    except Exception:
        return 0.3


def _ema5(values: list) -> list:
    """5-day exponential moving average. Returns same-length list."""
    s = pd.Series(values)
    return s.ewm(span=5, adjust=False).mean().tolist()


# ============================================================
# 1. OLS / Linear Regression
# ============================================================

def train_ols(X_train, y_train, X_test, y_test) -> dict:
    print("[models] Training OLS...")
    model = LinearRegression()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    cv_scores = _tscv_regression(LinearRegression, {}, X_train, y_train)
    coefs = {col: float(c) for col, c in zip(X_train.columns, model.coef_)}
    result = {
        "name": "OLS",
        "coefficients": coefs,
        "intercept": float(model.intercept_),
        "cv_r2_scores": cv_scores,
        "cv_r2_mean": float(np.mean(cv_scores)),
        "train_metrics": _reg_metrics(y_train, model.predict(X_train)),
        "test_metrics":  _reg_metrics(y_test, y_pred),
        "y_pred": y_pred.tolist(),
    }
    print(f"  OLS  test R2={result['test_metrics']['r2']:.4f}  RMSE={result['test_metrics']['rmse']:.6f}")
    return result


# ============================================================
# 2. Ridge Regression
# ============================================================

def train_ridge(X_train, y_train, X_test, y_test, alpha: float = 1.0) -> dict:
    print(f"[models] Training Ridge (alpha={alpha})...")
    model = Ridge(alpha=alpha)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    cv_scores = _tscv_regression(Ridge, {"alpha": alpha}, X_train, y_train)
    coefs = {col: float(c) for col, c in zip(X_train.columns, model.coef_)}
    result = {
        "name": "Ridge",
        "alpha": alpha,
        "coefficients": coefs,
        "intercept": float(model.intercept_),
        "cv_r2_scores": cv_scores,
        "cv_r2_mean": float(np.mean(cv_scores)),
        "train_metrics": _reg_metrics(y_train, model.predict(X_train)),
        "test_metrics":  _reg_metrics(y_test, y_pred),
        "y_pred": y_pred.tolist(),
    }
    print(f"  Ridge test R2={result['test_metrics']['r2']:.4f}  RMSE={result['test_metrics']['rmse']:.6f}")
    return result


# ============================================================
# 3. Random Forest — Regressor + Classifier
# ============================================================

def train_random_forest_regressor(X_train, y_train, X_test, y_test) -> dict:
    print("[models] Training Random Forest Regressor...")
    model = RandomForestRegressor(
        n_estimators=500, max_depth=10, min_samples_split=10,
        random_state=42, n_jobs=-1
    )
    cv_scores = _tscv_regression(
        RandomForestRegressor,
        {"n_estimators": 200, "max_depth": 10, "min_samples_split": 10,
         "random_state": 42, "n_jobs": -1},
        X_train, y_train
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    fi = sorted(
        [{"feature": col, "importance": float(imp)}
         for col, imp in zip(X_train.columns, model.feature_importances_)],
        key=lambda x: x["importance"], reverse=True
    )
    result = {
        "name": "RandomForest",
        "cv_r2_scores": cv_scores,
        "cv_r2_mean": float(np.mean(cv_scores)),
        "train_metrics": _reg_metrics(y_train, model.predict(X_train)),
        "test_metrics":  _reg_metrics(y_test, y_pred),
        "feature_importance": fi,
        "y_pred": y_pred.tolist(),
    }
    print(f"  RF Reg  test R2={result['test_metrics']['r2']:.4f}")
    return result


def train_random_forest_classifier(X_train, y_train, X_test, y_test) -> dict:
    """
    Random Forest classifier with:
    - class_weight='balanced' to handle ~6% crisis base rate
    - PR-optimal threshold (not 0.5) for classification decisions
    """
    print("[models] Training Random Forest Classifier...")
    model = RandomForestClassifier(
        n_estimators=500, max_depth=10, min_samples_split=10,
        class_weight="balanced", random_state=42, n_jobs=-1
    )
    model.fit(X_train, y_train)

    # Optimise threshold on training data
    train_proba = model.predict_proba(X_train)[:, 1]
    threshold = _optimal_threshold(y_train, train_proba)
    print(f"  RF Clf  PR-optimal threshold on train: {threshold:.3f}")

    y_proba = model.predict_proba(X_test)[:, 1]
    y_pred  = (y_proba >= threshold).astype(int)

    fi = sorted(
        [{"feature": col, "importance": float(imp)}
         for col, imp in zip(X_train.columns, model.feature_importances_)],
        key=lambda x: x["importance"], reverse=True
    )

    # CV AUC
    tscv = TimeSeriesSplit(n_splits=5)
    cv_aucs = []
    for tr_idx, va_idx in tscv.split(X_train):
        clf = RandomForestClassifier(
            n_estimators=200, max_depth=10, min_samples_split=10,
            class_weight="balanced", random_state=42, n_jobs=-1
        )
        clf.fit(X_train.iloc[tr_idx], y_train.iloc[tr_idx])
        va_proba = clf.predict_proba(X_train.iloc[va_idx])[:, 1]
        try:
            cv_aucs.append(float(roc_auc_score(y_train.iloc[va_idx], va_proba)))
        except Exception:
            pass

    result = {
        "name": "RandomForestClassifier",
        "threshold_used": threshold,
        "cv_auc_mean": float(np.mean(cv_aucs)) if cv_aucs else None,
        "cv_auc_std":  float(np.std(cv_aucs))  if cv_aucs else None,
        "test_metrics": _clf_metrics(y_test, y_pred, y_proba),
        "feature_importance": fi,
        "fragility_scores": _ema5((y_proba * 100).tolist()),
        "y_pred": y_pred.tolist(),
        "y_proba": y_proba.tolist(),
    }
    print(f"  RF Clf  test AUC={result['test_metrics'].get('roc_auc'):.4f}  "
          f"F1={result['test_metrics']['f1']:.4f}  "
          f"Prec={result['test_metrics']['precision']:.4f}  "
          f"Rec={result['test_metrics']['recall']:.4f}")
    return result


# ============================================================
# 4. XGBoost — Regressor + Classifier
# ============================================================

def train_xgboost_regressor(X_train, y_train, X_test, y_test) -> dict:
    """
    XGBoost regressor with explicit regularisation.
    Previous version had max_depth=6, no subsample → train R²=0.995 (pure overfit).
    Fixed: max_depth=4, subsample=0.8, colsample_bytree=0.7, reg_lambda=2.0
    """
    print("[models] Training XGBoost Regressor...")
    try:
        from xgboost import XGBRegressor
    except ImportError:
        print("  [WARN] xgboost not installed — skipping")
        return {"name": "XGBoost", "error": "not_installed"}

    model = XGBRegressor(
        n_estimators=300,
        max_depth=4,           # was 6 — key overfit fix
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.7,
        reg_lambda=2.0,        # L2 regularisation
        reg_alpha=0.1,         # L1 regularisation
        min_child_weight=5,    # minimum samples per leaf
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    y_pred = model.predict(X_test)
    fi = sorted(
        [{"feature": col, "importance": float(imp)}
         for col, imp in zip(X_train.columns, model.feature_importances_)],
        key=lambda x: x["importance"], reverse=True
    )
    result = {
        "name": "XGBoost",
        "train_metrics": _reg_metrics(y_train, model.predict(X_train)),
        "test_metrics":  _reg_metrics(y_test, y_pred),
        "feature_importance": fi,
        "y_pred": y_pred.tolist(),
    }
    print(f"  XGB Reg  train R2={result['train_metrics']['r2']:.4f}  "
          f"test R2={result['test_metrics']['r2']:.4f}")
    return result


def train_xgboost_classifier(X_train, y_train, X_test, y_test) -> dict:
    """
    XGBoost classifier with:
    - scale_pos_weight to handle class imbalance
    - PR-optimal threshold (not 0.5)
    - same regularisation as regressor
    """
    print("[models] Training XGBoost Classifier...")
    try:
        from xgboost import XGBClassifier
    except ImportError:
        print("  [WARN] xgboost not installed — skipping")
        return {"name": "XGBoostClassifier", "error": "not_installed"}

    scale_pos = float((y_train == 0).sum() / max((y_train == 1).sum(), 1))
    model = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.7,
        reg_lambda=2.0,
        reg_alpha=0.1,
        min_child_weight=5,
        scale_pos_weight=scale_pos,
        random_state=42,
        n_jobs=-1,
        verbosity=0,
        eval_metric="auc",
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # PR-optimal threshold on training set
    train_proba = model.predict_proba(X_train)[:, 1]
    threshold = _optimal_threshold(y_train, train_proba)
    print(f"  XGB Clf  PR-optimal threshold on train: {threshold:.3f}")

    y_proba = model.predict_proba(X_test)[:, 1]
    y_pred  = (y_proba >= threshold).astype(int)

    fi = sorted(
        [{"feature": col, "importance": float(imp)}
         for col, imp in zip(X_train.columns, model.feature_importances_)],
        key=lambda x: x["importance"], reverse=True
    )
    result = {
        "name": "XGBoostClassifier",
        "threshold_used": threshold,
        "test_metrics": _clf_metrics(y_test, y_pred, y_proba),
        "feature_importance": fi,
        "fragility_scores": _ema5((y_proba * 100).tolist()),
        "y_pred": y_pred.tolist(),
        "y_proba": y_proba.tolist(),
    }
    print(f"  XGB Clf  test AUC={result['test_metrics'].get('roc_auc'):.4f}  "
          f"F1={result['test_metrics']['f1']:.4f}")
    return result


# ============================================================
# 5. LSTM
# ============================================================

def _make_sequences(X: np.ndarray, y: np.ndarray, lookback: int = 20):
    """Convert flat feature array to (samples, lookback, features) for LSTM."""
    Xs, ys = [], []
    for i in range(lookback, len(X)):
        Xs.append(X[i - lookback:i])
        ys.append(y[i])
    return np.array(Xs), np.array(ys)


def train_lstm(X_train, y_train, X_test, y_test,
               lookback: int = 20, epochs: int = 60, mode: str = "regression") -> dict:
    """
    LSTM using Keras/TensorFlow.
    - lookback=20 trading days (~1 month context)
    - EarlyStopping with patience=15 and restore_best_weights
    - validation_split=0.15 taken from end of train set (chronological)
    Falls back gracefully if TF not installed.
    """
    print(f"[models] Training LSTM ({mode}, lookback={lookback}, epochs={epochs})...")
    try:
        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense, Dropout
        from tensorflow.keras.callbacks import EarlyStopping
        tf.get_logger().setLevel('ERROR')
    except ImportError:
        print("  [WARN] TensorFlow not installed — skipping LSTM")
        return {"name": "LSTM", "error": "tensorflow_not_installed"}

    X_tr = X_train.values.astype(np.float32)
    X_te = X_test.values.astype(np.float32)
    y_tr = y_train.values.astype(np.float32)
    y_te = y_test.values.astype(np.float32)

    X_tr_seq, y_tr_seq = _make_sequences(X_tr, y_tr, lookback)
    X_te_seq, y_te_seq = _make_sequences(X_te, y_te, lookback)

    if len(X_tr_seq) < 50 or len(X_te_seq) == 0:
        return {"name": "LSTM", "error": "insufficient_data_for_lookback"}

    n_features = X_tr.shape[1]
    model = Sequential([
        LSTM(64, input_shape=(lookback, n_features), return_sequences=True),
        Dropout(0.2),
        LSTM(32, return_sequences=False),
        Dropout(0.2),
        Dense(16, activation="relu"),
        Dense(1, activation="sigmoid" if mode == "classification" else "linear"),
    ])

    if mode == "classification":
        model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    else:
        model.compile(optimizer="adam", loss="mse")

    es = EarlyStopping(patience=15, restore_best_weights=True, verbose=0,
                       monitor="val_loss")
    model.fit(
        X_tr_seq, y_tr_seq,
        validation_split=0.15,
        epochs=epochs,
        batch_size=32,
        callbacks=[es],
        verbose=0,
        shuffle=False,  # CRITICAL — no shuffling for time series
    )

    y_raw = model.predict(X_te_seq, verbose=0).flatten()

    if mode == "classification":
        threshold = _optimal_threshold(y_tr_seq, model.predict(X_tr_seq, verbose=0).flatten())
        y_pred = (y_raw >= threshold).astype(int)
        metrics = _clf_metrics(y_te_seq, y_pred, y_raw)
        result = {
            "name": "LSTM",
            "mode": mode,
            "threshold_used": float(threshold),
            "test_metrics": metrics,
            "fragility_scores": _ema5((y_raw * 100).tolist()),
            "y_pred": y_pred.tolist(),
            "y_proba": y_raw.tolist(),
        }
        print(f"  LSTM Clf  test AUC={metrics.get('roc_auc')}")
    else:
        metrics = _reg_metrics(y_te_seq, y_raw)
        result = {
            "name": "LSTM",
            "mode": mode,
            "train_metrics": _reg_metrics(
                y_tr_seq, model.predict(X_tr_seq, verbose=0).flatten()
            ),
            "test_metrics": metrics,
            "y_pred": y_raw.tolist(),
        }
        print(f"  LSTM Reg  test R2={metrics['r2']:.4f}")

    return result


# ============================================================
# Ensemble fragility score
# ============================================================

def build_ensemble_fragility(rf_result: dict, xgb_result: dict) -> list:
    """
    Ensemble fragility score = EMA5(0.5 * P_rf + 0.5 * P_xgb) * 100

    This is the primary fragility signal for the dashboard.
    Falls back to whichever single model is available.
    """
    rf_proba  = rf_result.get("y_proba", [])
    xgb_proba = xgb_result.get("y_proba", [])

    if rf_proba and xgb_proba and len(rf_proba) == len(xgb_proba):
        ensemble = [
            0.5 * rf_p + 0.5 * xgb_p
            for rf_p, xgb_p in zip(rf_proba, xgb_proba)
        ]
    elif rf_proba:
        ensemble = rf_proba
    elif xgb_proba:
        ensemble = xgb_proba
    else:
        return []

    return _ema5([v * 100 for v in ensemble])


# ============================================================
# Comparison table builder
# ============================================================

def compare_models(results: list, mode: str = "regression") -> list:
    """
    Build a flat comparison table from a list of model result dicts.
    mode = 'regression' | 'classification'
    """
    rows = []
    for r in results:
        if not r or "error" in r:
            continue
        name = r.get("name", "Unknown")
        m = r.get("test_metrics", {})
        if mode == "regression":
            rows.append({
                "model":       name,
                "r2":          m.get("r2"),
                "rmse":        m.get("rmse"),
                "mae":         m.get("mae"),
                "cv_r2_mean":  r.get("cv_r2_mean"),
            })
        else:
            rows.append({
                "model":     name,
                "accuracy":  m.get("accuracy"),
                "f1":        m.get("f1"),
                "roc_auc":   m.get("roc_auc"),
                "precision": m.get("precision"),
                "recall":    m.get("recall"),
                "threshold": r.get("threshold_used"),
            })
    return rows
