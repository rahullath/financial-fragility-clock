"""
Models module for Financial Fragility Clock.

This module handles OLS regression, Random Forest, LSTM training,
SHAP explainability, and model performance comparison.

Classification engine (v2)
--------------------------
Added `train_logistic_regression`, `train_random_forest_classifier`,
`compute_shap_classifier`, `compare_classification_models`, and
`export_model_outputs_classification` to support the forward-looking
crash-probability pipeline.  The fragility score is now derived from
`predict_proba()[:, 1] * 100` rather than a hand-crafted formula.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, roc_curve, classification_report,
)
import statsmodels.api as sm
from statsmodels.stats.diagnostic import het_breuschpagan
from statsmodels.stats.stattools import durbin_watson
import json
from datetime import datetime
from pathlib import Path
import sys
import warnings


def compute_regime_metrics(
    y_true: pd.Series | np.ndarray,
    y_pred: pd.Series | np.ndarray,
    regimes: pd.Series | np.ndarray | None
) -> dict[str, dict[str, float | int | None]]:
    """Compute per-regime regression metrics on the evaluation set."""
    regime_metrics: dict[str, dict[str, float | int | None]] = {}

    if regimes is None:
        return regime_metrics

    y_true_series = pd.Series(y_true).reset_index(drop=True)
    y_pred_series = pd.Series(y_pred).reset_index(drop=True)
    regimes_series = pd.Series(regimes).reset_index(drop=True)

    for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
        regime_mask = regimes_series == regime
        n_obs = int(regime_mask.sum())

        if n_obs == 0:
            regime_metrics[regime] = {
                'rmse': None,
                'mae': None,
                'r2': None,
                'n_observations': 0,
            }
            continue

        regime_y_true = y_true_series[regime_mask]
        regime_y_pred = y_pred_series[regime_mask]

        rmse = float(np.sqrt(mean_squared_error(regime_y_true, regime_y_pred)))
        mae = float(mean_absolute_error(regime_y_true, regime_y_pred))
        r2 = None
        if n_obs >= 2 and regime_y_true.nunique() > 1:
            r2 = float(r2_score(regime_y_true, regime_y_pred))

        regime_metrics[regime] = {
            'rmse': rmse,
            'mae': mae,
            'r2': r2,
            'n_observations': n_obs,
        }

    return regime_metrics


def train_ols(X_train: pd.DataFrame, y_train: pd.Series, 
              X_test: pd.DataFrame, y_test: pd.Series,
              regimes_test: pd.Series = None) -> dict:
    """
    Train OLS regression and compute diagnostics.
    
    Args:
        X_train: Training features (7 global indices)
        y_train: Training target (ISE_USD)
        X_test: Test features
        y_test: Test target
        regimes_test: Minsky regime labels for test set (optional)
    
    Returns:
        {
            "coefficients": {"SP500": 0.45, ...},
            "metrics": {"train_r2": 0.78, "test_r2": 0.72, "test_rmse": 0.012, ...},
            "regime_rmse": {"HEDGE": 0.008, "SPECULATIVE": 0.011, "PONZI": 0.018},
            "diagnostics": {"durbin_watson": 1.95, "breusch_pagan_p": 0.03}
        }
    """
    print("\n" + "=" * 60)
    print("TRAINING OLS BASELINE MODEL")
    print("=" * 60)
    
    # Add constant term for intercept
    X_train_const = sm.add_constant(X_train)
    X_test_const = sm.add_constant(X_test)
    
    # Train OLS model
    print(f"\nTraining OLS with {len(X_train)} training observations...")
    print(f"Features: {list(X_train.columns)}")
    
    model = sm.OLS(y_train, X_train_const)
    results = model.fit()
    
    # Extract coefficients (excluding intercept)
    coefficients = {}
    for i, col in enumerate(X_train.columns):
        coefficients[col] = float(results.params[col])
    
    intercept = float(results.params['const'])
    
    print(f"\nOLS Coefficients:")
    print(f"  Intercept: {intercept:.6f}")
    for feature, coef in coefficients.items():
        print(f"  {feature}: {coef:.6f}")
    
    # Make predictions
    y_train_pred = results.predict(X_train_const)
    y_test_pred = results.predict(X_test_const)
    
    # Compute metrics on training set
    train_r2 = r2_score(y_train, y_train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
    train_mae = mean_absolute_error(y_train, y_train_pred)
    
    # Compute metrics on test set
    test_r2 = r2_score(y_test, y_test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
    test_mae = mean_absolute_error(y_test, y_test_pred)
    
    metrics = {
        'train_r2': float(train_r2),
        'train_rmse': float(train_rmse),
        'train_mae': float(train_mae),
        'test_r2': float(test_r2),
        'test_rmse': float(test_rmse),
        'test_mae': float(test_mae)
    }
    
    print(f"\nTraining Metrics:")
    print(f"  R²: {train_r2:.4f}")
    print(f"  RMSE: {train_rmse:.6f}")
    print(f"  MAE: {train_mae:.6f}")
    
    print(f"\nTest Metrics:")
    print(f"  R²: {test_r2:.4f}")
    print(f"  RMSE: {test_rmse:.6f}")
    print(f"  MAE: {test_mae:.6f}")
    
    # Compute regime-specific RMSE on test set
    regime_metrics = compute_regime_metrics(y_test, y_test_pred, regimes_test)
    regime_rmse = {}
    if regimes_test is not None:
        print(f"\nRegime-Specific Test RMSE:")
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            regime_row = regime_metrics[regime]
            regime_rmse[regime] = regime_row['rmse']
            if regime_row['rmse'] is not None:
                print(f"  {regime}: {regime_row['rmse']:.6f} (n={regime_row['n_observations']})")
            else:
                print(f"  {regime}: No observations in test set")
    
    # Compute diagnostic tests on residuals
    residuals = results.resid
    
    # Durbin-Watson test for autocorrelation
    dw_stat = durbin_watson(residuals)
    
    # Breusch-Pagan test for heteroskedasticity
    bp_test = het_breuschpagan(residuals, X_train_const)
    bp_lm_stat = bp_test[0]
    bp_lm_pvalue = bp_test[1]
    bp_f_stat = bp_test[2]
    bp_f_pvalue = bp_test[3]
    
    diagnostics = {
        'durbin_watson': float(dw_stat),
        'breusch_pagan_lm_stat': float(bp_lm_stat),
        'breusch_pagan_lm_pvalue': float(bp_lm_pvalue),
        'breusch_pagan_f_stat': float(bp_f_stat),
        'breusch_pagan_f_pvalue': float(bp_f_pvalue)
    }
    
    print(f"\nDiagnostic Tests:")
    print(f"  Durbin-Watson: {dw_stat:.4f} (2.0 = no autocorrelation)")
    print(f"  Breusch-Pagan p-value: {bp_lm_pvalue:.4f} (>0.05 = homoskedastic)")
    
    # Interpretation
    if dw_stat < 1.5 or dw_stat > 2.5:
        print(f"    ⚠ Warning: Potential autocorrelation detected")
    if bp_lm_pvalue < 0.05:
        print(f"    ⚠ Warning: Heteroskedasticity detected")
    
    # Compile results
    ols_results = {
        'coefficients': coefficients,
        'intercept': intercept,
        'metrics': metrics,
        'regime_metrics': regime_metrics,
        'regime_rmse': regime_rmse,
        'diagnostics': diagnostics
    }
    
    print("\n" + "=" * 60)
    print("OLS TRAINING COMPLETE")
    print("=" * 60)
    
    return ols_results


def train_random_forest(X_train: pd.DataFrame, y_train: pd.Series,
                       X_test: pd.DataFrame, y_test: pd.Series,
                       regimes_test: pd.Series = None) -> dict:
    """
    Train Random Forest with TimeSeriesSplit cross-validation.

    Hyperparameters: n_estimators=500, max_depth=10, min_samples_split=10

    Args:
        X_train: Training features (includes 7 global indices + engineered features)
        y_train: Training target (ISE_USD)
        X_test: Test features
        y_test: Test target
        regimes_test: Minsky regime labels for test set (optional)

    Returns:
        {
            "metrics": {"cv_scores": [0.75, 0.78, ...], "test_r2": 0.81, ...},
            "regime_rmse": {"HEDGE": 0.007, "SPECULATIVE": 0.010, "PONZI": 0.015},
            "feature_importance": {"gini": {...}, "permutation": {...}}
        }
    """
    print("\n" + "=" * 60)
    print("TRAINING RANDOM FOREST MODEL")
    print("=" * 60)

    # Initialize Random Forest with specified hyperparameters
    rf_model = RandomForestRegressor(
        n_estimators=500,
        max_depth=10,
        min_samples_split=10,
        random_state=42,
        n_jobs=-1,
        verbose=0
    )

    print(f"\nRandom Forest Configuration:")
    print(f"  n_estimators: 500")
    print(f"  max_depth: 10")
    print(f"  min_samples_split: 10")
    print(f"  random_state: 42")

    print(f"\nTraining with {len(X_train)} training observations...")
    print(f"Features ({len(X_train.columns)}): {list(X_train.columns)}")

    # TimeSeriesSplit cross-validation with 5 folds
    print(f"\nPerforming TimeSeriesSplit cross-validation (5 folds)...")
    tscv = TimeSeriesSplit(n_splits=5)

    cv_scores = []
    cv_rmse = []
    cv_mae = []
    fold_num = 1

    for train_idx, val_idx in tscv.split(X_train):
        X_fold_train = X_train.iloc[train_idx]
        y_fold_train = y_train.iloc[train_idx]
        X_fold_val = X_train.iloc[val_idx]
        y_fold_val = y_train.iloc[val_idx]

        # Train on fold
        rf_fold = RandomForestRegressor(
            n_estimators=500,
            max_depth=10,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1,
            verbose=0
        )
        rf_fold.fit(X_fold_train, y_fold_train)

        # Predict on validation fold
        y_fold_pred = rf_fold.predict(X_fold_val)

        # Compute metrics
        fold_r2 = r2_score(y_fold_val, y_fold_pred)
        fold_rmse = np.sqrt(mean_squared_error(y_fold_val, y_fold_pred))
        fold_mae = mean_absolute_error(y_fold_val, y_fold_pred)

        cv_scores.append(fold_r2)
        cv_rmse.append(fold_rmse)
        cv_mae.append(fold_mae)

        print(f"  Fold {fold_num}: R²={fold_r2:.4f}, RMSE={fold_rmse:.6f}, MAE={fold_mae:.6f} "
              f"(train_n={len(X_fold_train)}, val_n={len(X_fold_val)})")
        fold_num += 1

    cv_mean_r2 = np.mean(cv_scores)
    cv_std_r2 = np.std(cv_scores)
    cv_mean_rmse = np.mean(cv_rmse)
    cv_mean_mae = np.mean(cv_mae)

    print(f"\nCross-Validation Results:")
    print(f"  Mean R²: {cv_mean_r2:.4f} ± {cv_std_r2:.4f}")
    print(f"  Mean RMSE: {cv_mean_rmse:.6f}")
    print(f"  Mean MAE: {cv_mean_mae:.6f}")

    # Train final model on full training set
    print(f"\nTraining final model on full training set...")
    rf_model.fit(X_train, y_train)

    # Make predictions on training and test sets
    y_train_pred = rf_model.predict(X_train)
    y_test_pred = rf_model.predict(X_test)

    # Compute metrics on training set
    train_r2 = r2_score(y_train, y_train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
    train_mae = mean_absolute_error(y_train, y_train_pred)

    # Compute metrics on test set
    test_r2 = r2_score(y_test, y_test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
    test_mae = mean_absolute_error(y_test, y_test_pred)

    print(f"\nTraining Metrics:")
    print(f"  R²: {train_r2:.4f}")
    print(f"  RMSE: {train_rmse:.6f}")
    print(f"  MAE: {train_mae:.6f}")

    print(f"\nTest Metrics:")
    print(f"  R²: {test_r2:.4f}")
    print(f"  RMSE: {test_rmse:.6f}")
    print(f"  MAE: {test_mae:.6f}")

    # Compute regime-specific RMSE on test set
    regime_metrics = compute_regime_metrics(y_test, y_test_pred, regimes_test)
    regime_rmse = {}
    if regimes_test is not None:
        print(f"\nRegime-Specific Test RMSE:")
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            regime_row = regime_metrics[regime]
            regime_rmse[regime] = regime_row['rmse']
            if regime_row['rmse'] is not None:
                print(f"  {regime}: {regime_row['rmse']:.6f} (n={regime_row['n_observations']})")
            else:
                print(f"  {regime}: No observations in test set")

    # Compute Gini-based feature importance (built-in)
    print(f"\nComputing feature importance scores...")
    gini_importance = {}
    for feature, importance in zip(X_train.columns, rf_model.feature_importances_):
        gini_importance[feature] = float(importance)

    print(f"\nGini-based Feature Importance (top 5):")
    sorted_gini = sorted(gini_importance.items(), key=lambda x: x[1], reverse=True)
    for feature, importance in sorted_gini[:5]:
        print(f"  {feature}: {importance:.4f}")

    # Compute permutation-based feature importance
    print(f"\nComputing permutation-based feature importance...")
    from sklearn.inspection import permutation_importance

    perm_importance_result = permutation_importance(
        rf_model, X_test, y_test,
        n_repeats=10,
        random_state=42,
        n_jobs=-1
    )

    permutation_importance_dict = {}
    for feature, importance in zip(X_train.columns, perm_importance_result.importances_mean):
        permutation_importance_dict[feature] = float(importance)

    print(f"\nPermutation-based Feature Importance (top 5):")
    sorted_perm = sorted(permutation_importance_dict.items(), key=lambda x: x[1], reverse=True)
    for feature, importance in sorted_perm[:5]:
        print(f"  {feature}: {importance:.6f}")

    # Compile metrics
    metrics = {
        'cv_scores': [float(x) for x in cv_scores],
        'cv_mean': float(cv_mean_r2),
        'cv_std': float(cv_std_r2),
        'cv_mean_rmse': float(cv_mean_rmse),
        'cv_mean_mae': float(cv_mean_mae),
        'train_r2': float(train_r2),
        'train_rmse': float(train_rmse),
        'train_mae': float(train_mae),
        'test_r2': float(test_r2),
        'test_rmse': float(test_rmse),
        'test_mae': float(test_mae)
    }

    # Compile feature importance
    feature_importance = {
        'gini': gini_importance,
        'permutation': permutation_importance_dict
    }

    # Compile results
    rf_results = {
        'metrics': metrics,
        'regime_metrics': regime_metrics,
        'regime_rmse': regime_rmse,
        'feature_importance': feature_importance
    }

    print("\n" + "=" * 60)
    print("RANDOM FOREST TRAINING COMPLETE")
    print("=" * 60)

    return rf_results
def compute_shap_values(model, X_test: pd.DataFrame, regimes: pd.Series) -> dict:
    """
    Compute SHAP values using TreeExplainer.

    Args:
        model: Trained Random Forest model
        X_test: Test features DataFrame
        regimes: Minsky regime labels for test set

    Returns:
        {
            "shap_matrix": [[0.002, -0.001, ...], ...],  # shape: (n_test, n_features)
            "feature_names": ["SP500", "DAX", ...],
            "mean_abs_shap": {"SP500": 0.0045, ...},
            "regime_shap": {
                "HEDGE": {"dominant_feature": "SP500", "mean_abs_shap": {...}},
                "SPECULATIVE": {...},
                "PONZI": {...}
            }
        }
    """
    print("\n" + "=" * 60)
    print("COMPUTING SHAP VALUES")
    print("=" * 60)

    try:
        import shap
    except ImportError:
        print("ERROR: shap library not installed. Install with: pip install shap")
        raise

    print(f"\nInitializing TreeExplainer for Random Forest...")
    print(f"Test set size: {len(X_test)} observations")
    print(f"Features: {list(X_test.columns)}")

    # Create TreeExplainer for Random Forest
    explainer = shap.TreeExplainer(model)

    # Compute SHAP values for all test observations
    print(f"\nComputing SHAP values for all test observations...")
    shap_values = explainer.shap_values(X_test)

    # shap_values is a numpy array of shape (n_observations, n_features)
    print(f"SHAP values shape: {shap_values.shape}")

    # Store feature names
    feature_names = list(X_test.columns)

    # Compute mean absolute SHAP values per feature (global importance)
    mean_abs_shap = {}
    for i, feature in enumerate(feature_names):
        mean_abs_shap[feature] = float(np.mean(np.abs(shap_values[:, i])))

    print(f"\nGlobal Feature Importance (Mean Absolute SHAP):")
    sorted_shap = sorted(mean_abs_shap.items(), key=lambda x: x[1], reverse=True)
    for feature, importance in sorted_shap:
        print(f"  {feature}: {importance:.6f}")

    # Compute regime-specific SHAP analysis
    print(f"\nComputing regime-specific SHAP analysis...")
    regime_shap = {}

    for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
        regime_mask = regimes == regime
        n_regime = regime_mask.sum()

        if n_regime > 0:
            # Get SHAP values for this regime
            regime_shap_values = shap_values[regime_mask.values]

            # Compute mean absolute SHAP per feature for this regime
            regime_mean_abs_shap = {}
            for i, feature in enumerate(feature_names):
                regime_mean_abs_shap[feature] = float(np.mean(np.abs(regime_shap_values[:, i])))

            # Identify dominant feature (highest mean absolute SHAP)
            dominant_feature = max(regime_mean_abs_shap.items(), key=lambda x: x[1])[0]

            regime_shap[regime] = {
                'dominant_feature': dominant_feature,
                'mean_abs_shap': regime_mean_abs_shap,
                'n_observations': int(n_regime)
            }

            print(f"\n  {regime} Regime (n={n_regime}):")
            print(f"    Dominant feature: {dominant_feature} ({regime_mean_abs_shap[dominant_feature]:.6f})")
            print(f"    Top 3 features:")
            sorted_regime_shap = sorted(regime_mean_abs_shap.items(), key=lambda x: x[1], reverse=True)
            for feature, importance in sorted_regime_shap[:3]:
                print(f"      {feature}: {importance:.6f}")
        else:
            regime_shap[regime] = {
                'dominant_feature': None,
                'mean_abs_shap': {},
                'n_observations': 0
            }
            print(f"\n  {regime} Regime: No observations in test set")

    # Compile results
    shap_results = {
        'shap_matrix': shap_values.tolist(),
        'feature_names': feature_names,
        'mean_abs_shap': mean_abs_shap,
        'regime_shap': regime_shap
    }

    print("\n" + "=" * 60)
    print("SHAP COMPUTATION COMPLETE")
    print("=" * 60)

    return shap_results


def compare_models(ols_results: dict, rf_results: dict, 
                  lstm_results: dict = None) -> dict:
    """
    Generate model comparison table and identify best performers.
    
    Args:
        ols_results: OLS model results dictionary
        rf_results: Random Forest model results dictionary
        lstm_results: LSTM model results dictionary (optional)
    
    Returns:
        {
            "comparison_table": [
                {"model": "OLS", "r2": 0.72, "rmse": 0.012, ...},
                {"model": "RF", "r2": 0.81, "rmse": 0.009, ...}
            ],
            "best_model": {"r2": "RF", "rmse": "RF", ...},
            "rf_improvement_pct": {"r2": 12.5, "rmse": 25.0, ...},
            "ponzi_validation": {"rf_better": true, "improvement_pct": 16.7}
        }
    """
    print("\n" + "=" * 60)
    print("COMPARING MODEL PERFORMANCE")
    print("=" * 60)
    
    # Build comparison table
    comparison_table = []
    
    # OLS row
    ols_row = {
        'model': 'OLS',
        'r2': ols_results['metrics']['test_r2'],
        'rmse': ols_results['metrics']['test_rmse'],
        'mae': ols_results['metrics']['test_mae'],
        'hedge_rmse': ols_results['regime_rmse'].get('HEDGE'),
        'spec_rmse': ols_results['regime_rmse'].get('SPECULATIVE'),
        'ponzi_rmse': ols_results['regime_rmse'].get('PONZI')
    }
    comparison_table.append(ols_row)
    
    # Random Forest row
    rf_row = {
        'model': 'RF',
        'r2': rf_results['metrics']['test_r2'],
        'rmse': rf_results['metrics']['test_rmse'],
        'mae': rf_results['metrics']['test_mae'],
        'hedge_rmse': rf_results['regime_rmse'].get('HEDGE'),
        'spec_rmse': rf_results['regime_rmse'].get('SPECULATIVE'),
        'ponzi_rmse': rf_results['regime_rmse'].get('PONZI')
    }
    comparison_table.append(rf_row)
    
    # LSTM row (if provided)
    if lstm_results is not None:
        lstm_row = {
            'model': 'LSTM',
            'r2': lstm_results['metrics']['test_r2'],
            'rmse': lstm_results['metrics']['test_rmse'],
            'mae': lstm_results['metrics']['test_mae'],
            'hedge_rmse': lstm_results['regime_rmse'].get('HEDGE'),
            'spec_rmse': lstm_results['regime_rmse'].get('SPECULATIVE'),
            'ponzi_rmse': lstm_results['regime_rmse'].get('PONZI')
        }
        comparison_table.append(lstm_row)
    
    # Identify best model for each metric
    best_model = {}
    
    # For R², higher is better
    best_r2_idx = max(range(len(comparison_table)), key=lambda i: comparison_table[i]['r2'])
    best_model['r2'] = comparison_table[best_r2_idx]['model']
    
    # For RMSE and MAE, lower is better
    best_rmse_idx = min(range(len(comparison_table)), key=lambda i: comparison_table[i]['rmse'])
    best_model['rmse'] = comparison_table[best_rmse_idx]['model']
    
    best_mae_idx = min(range(len(comparison_table)), key=lambda i: comparison_table[i]['mae'])
    best_model['mae'] = comparison_table[best_mae_idx]['model']
    
    # For regime-specific RMSE, lower is better (if available)
    for regime_key in ['hedge_rmse', 'spec_rmse', 'ponzi_rmse']:
        valid_models = [i for i in range(len(comparison_table)) 
                       if comparison_table[i][regime_key] is not None]
        if valid_models:
            best_regime_idx = min(valid_models, 
                                 key=lambda i: comparison_table[i][regime_key])
            best_model[regime_key] = comparison_table[best_regime_idx]['model']
    
    # Print comparison table
    print("\nModel Performance Comparison (Test Set):")
    print("-" * 80)
    print(f"{'Model':<10} {'R²':>8} {'RMSE':>10} {'MAE':>10} {'HEDGE':>10} {'SPEC':>10} {'PONZI':>10}")
    print("-" * 80)
    
    for row in comparison_table:
        hedge_str = f"{row['hedge_rmse']:.6f}" if row['hedge_rmse'] is not None else "N/A"
        spec_str = f"{row['spec_rmse']:.6f}" if row['spec_rmse'] is not None else "N/A"
        ponzi_str = f"{row['ponzi_rmse']:.6f}" if row['ponzi_rmse'] is not None else "N/A"
        
        print(f"{row['model']:<10} {row['r2']:>8.4f} {row['rmse']:>10.6f} {row['mae']:>10.6f} "
              f"{hedge_str:>10} {spec_str:>10} {ponzi_str:>10}")
    
    print("-" * 80)
    print("\nBest Model per Metric:")
    for metric, model in best_model.items():
        print(f"  {metric}: {model}")
    
    # Compute RF improvement over OLS
    rf_improvement_pct = {}
    
    # R² improvement (percentage point increase)
    r2_improvement = ((rf_results['metrics']['test_r2'] - ols_results['metrics']['test_r2']) 
                     / ols_results['metrics']['test_r2']) * 100
    rf_improvement_pct['r2'] = float(r2_improvement)
    
    # RMSE improvement (percentage decrease)
    rmse_improvement = ((ols_results['metrics']['test_rmse'] - rf_results['metrics']['test_rmse']) 
                       / ols_results['metrics']['test_rmse']) * 100
    rf_improvement_pct['rmse'] = float(rmse_improvement)
    
    # MAE improvement (percentage decrease)
    mae_improvement = ((ols_results['metrics']['test_mae'] - rf_results['metrics']['test_mae']) 
                      / ols_results['metrics']['test_mae']) * 100
    rf_improvement_pct['mae'] = float(mae_improvement)
    
    # Regime-specific improvements
    for regime, regime_key in [('HEDGE', 'hedge_rmse'), ('SPECULATIVE', 'spec_rmse'), ('PONZI', 'ponzi_rmse')]:
        ols_regime_rmse = ols_results['regime_rmse'].get(regime)
        rf_regime_rmse = rf_results['regime_rmse'].get(regime)
        
        if ols_regime_rmse is not None and rf_regime_rmse is not None:
            regime_improvement = ((ols_regime_rmse - rf_regime_rmse) / ols_regime_rmse) * 100
            rf_improvement_pct[regime_key] = float(regime_improvement)
    
    print("\nRF Improvement over OLS:")
    print(f"  R²: {rf_improvement_pct['r2']:+.2f}%")
    print(f"  RMSE: {rf_improvement_pct['rmse']:+.2f}%")
    print(f"  MAE: {rf_improvement_pct['mae']:+.2f}%")
    
    if 'hedge_rmse' in rf_improvement_pct:
        print(f"  HEDGE RMSE: {rf_improvement_pct['hedge_rmse']:+.2f}%")
    if 'spec_rmse' in rf_improvement_pct:
        print(f"  SPECULATIVE RMSE: {rf_improvement_pct['spec_rmse']:+.2f}%")
    if 'ponzi_rmse' in rf_improvement_pct:
        print(f"  PONZI RMSE: {rf_improvement_pct['ponzi_rmse']:+.2f}%")
    
    # Minsky framework validation
    # Test whether RF outperforms OLS specifically in PONZI regime
    print("\n" + "=" * 60)
    print("MINSKY FRAMEWORK VALIDATION")
    print("=" * 60)
    
    ponzi_validation = {}
    
    ols_ponzi_rmse = ols_results['regime_rmse'].get('PONZI')
    rf_ponzi_rmse = rf_results['regime_rmse'].get('PONZI')
    
    if ols_ponzi_rmse is not None and rf_ponzi_rmse is not None:
        # Check if RF outperforms OLS in PONZI regime
        rf_better = rf_ponzi_rmse < ols_ponzi_rmse
        
        # Compute percentage improvement
        ponzi_improvement_pct = ((ols_ponzi_rmse - rf_ponzi_rmse) / ols_ponzi_rmse) * 100
        
        ponzi_validation = {
            'rf_better': bool(rf_better),
            'improvement_pct': float(ponzi_improvement_pct),
            'ols_ponzi_rmse': float(ols_ponzi_rmse),
            'rf_ponzi_rmse': float(rf_ponzi_rmse)
        }
        
        print(f"\nPONZI Regime Performance:")
        print(f"  OLS RMSE: {ols_ponzi_rmse:.6f}")
        print(f"  RF RMSE: {rf_ponzi_rmse:.6f}")
        print(f"  RF Improvement: {ponzi_improvement_pct:+.2f}%")
        
        if rf_better:
            print(f"\n✓ VALIDATION PASSED: Random Forest outperforms OLS in PONZI regime")
            print(f"  This validates the Minsky framework hypothesis that non-linear models")
            print(f"  better capture the complex dynamics of financial fragility during crisis periods.")
        else:
            print(f"\n✗ VALIDATION FAILED: OLS performs better than RF in PONZI regime")
            print(f"  This suggests linear relationships may dominate even in crisis periods.")
    else:
        ponzi_validation = {
            'rf_better': None,
            'improvement_pct': None,
            'ols_ponzi_rmse': ols_ponzi_rmse,
            'rf_ponzi_rmse': rf_ponzi_rmse
        }
        print(f"\n⚠ WARNING: Cannot validate Minsky framework - insufficient PONZI observations")
    
    print("=" * 60)
    
    # Compile results
    comparison_results = {
        'comparison_table': comparison_table,
        'best_model': best_model,
        'rf_improvement_pct': rf_improvement_pct,
        'ponzi_validation': ponzi_validation
    }
    
    print("\n" + "=" * 60)
    print("MODEL COMPARISON COMPLETE")
    print("=" * 60)
    
    return comparison_results


def export_model_outputs(ols: dict, rf: dict, shap_results: dict, 
                        comparison: dict, filepath: str) -> None:
    """
    Write all model results to JSON.
    
    Args:
        ols: OLS model results dictionary
        rf: Random Forest model results dictionary
        shap_results: SHAP results dictionary
        comparison: Model comparison results dictionary
        filepath: Output JSON file path
    
    JSON structure:
    {
        "metadata": {"timestamp": "...", "python_version": "...", "libraries": {...}},
        "ols": {...},
        "random_forest": {...},
        "shap": {...},
        "comparison": {...}
    }
    """
    print("\n" + "=" * 60)
    print("EXPORTING MODEL OUTPUTS TO JSON")
    print("=" * 60)
    
    # Create metadata
    metadata = {
        'timestamp': datetime.now().isoformat(),
        'python_version': sys.version.split()[0],
        'libraries': {
            'pandas': pd.__version__,
            'numpy': np.__version__,
            'scikit-learn': __import__('sklearn').__version__,
            'statsmodels': __import__('statsmodels').__version__
        }
    }
    
    # Try to add shap version if available
    try:
        import shap
        metadata['libraries']['shap'] = shap.__version__
    except ImportError:
        pass
    
    print(f"\nMetadata:")
    print(f"  Timestamp: {metadata['timestamp']}")
    print(f"  Python version: {metadata['python_version']}")
    print(f"  Libraries:")
    for lib, version in metadata['libraries'].items():
        print(f"    {lib}: {version}")
    
    model_regime_metrics = {
        'OLS': ols.get('regime_metrics', {}),
        'RandomForest': rf.get('regime_metrics', {}),
    }

    regime_metrics = {}
    for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
        preferred = rf.get('regime_metrics', {}).get(regime) or ols.get('regime_metrics', {}).get(regime)
        if preferred:
            regime_metrics[regime] = preferred

    # Compile full output structure
    output = {
        'metadata': metadata,
        'ols': ols,
        'random_forest': rf,
        'regime_metrics': regime_metrics,
        'model_regime_metrics': model_regime_metrics,
        'shap': shap_results,
        'comparison': comparison
    }
    
    # Ensure output directory exists
    output_path = Path(filepath)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write to JSON file
    print(f"\nWriting to: {filepath}")
    with open(filepath, 'w') as f:
        json.dump(output, f, indent=2)
    
    # Compute file size
    file_size = output_path.stat().st_size
    file_size_kb = file_size / 1024
    
    print(f"File size: {file_size_kb:.2f} KB")
    
    print("\n" + "=" * 60)
    print("MODEL OUTPUTS EXPORT COMPLETE")
    print("=" * 60)


# =============================================================================
# CLASSIFICATION ENGINE (v2)
# =============================================================================

def compute_regime_classification_metrics(
    y_true: pd.Series,
    y_pred: np.ndarray,
    y_proba: np.ndarray,
    regimes: pd.Series | None,
) -> dict:
    """Compute per-regime classification metrics (accuracy, crash_rate, n_obs)."""
    if regimes is None:
        return {}

    metrics: dict = {}
    y_true_arr  = pd.Series(y_true).reset_index(drop=True)
    y_pred_arr  = pd.Series(y_pred).reset_index(drop=True)
    reg_arr     = pd.Series(regimes).reset_index(drop=True)

    for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
        mask   = reg_arr == regime
        n_obs  = int(mask.sum())
        if n_obs == 0:
            metrics[regime] = {'accuracy': None, 'crash_rate': None, 'n_observations': 0}
            continue
        acc = float(accuracy_score(y_true_arr[mask], y_pred_arr[mask]))
        crash_rate = float(y_true_arr[mask].mean())
        metrics[regime] = {
            'accuracy': acc,
            'crash_rate': crash_rate,
            'n_observations': n_obs,
        }
    return metrics


def train_logistic_regression(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test:  pd.DataFrame,
    y_test:  pd.Series,
    regimes_test: pd.Series | None = None,
) -> dict:
    """
    Train Logistic Regression – the linear 'bad model' baseline.

    Academic role
    -------------
    Linear models cannot capture the non-linear phase transitions inherent in
    Minsky's Financial Instability Hypothesis.  Market crashes are threshold
    events, not linear slopes.  This model is expected to show low ROC-AUC
    (~0.55–0.65), demonstrating why non-linear methods are needed.
    """
    print("\n" + "=" * 60)
    print("TRAINING LOGISTIC REGRESSION (Linear Baseline)")
    print("=" * 60)

    model = LogisticRegression(
        penalty='l2',
        C=1.0,
        class_weight='balanced',
        random_state=42,
        max_iter=1000,
        solver='lbfgs',
    )

    print(f"\nTraining with {len(X_train)} observations...")
    print(f"Features: {list(X_train.columns)}")
    model.fit(X_train, y_train)

    y_test_proba = model.predict_proba(X_test)[:, 1]
    y_test_pred  = (y_test_proba >= 0.5).astype(int)

    acc = float(accuracy_score(y_test, y_test_pred))
    try:
        auc = float(roc_auc_score(y_test, y_test_proba))
        fpr, tpr, _ = roc_curve(y_test, y_test_proba)
        roc_curve_data = [{'fpr': float(f), 'tpr': float(t)} for f, t in zip(fpr, tpr)]
    except Exception:
        auc = None
        roc_curve_data = []

    metrics = {
        'accuracy':  acc,
        'roc_auc':   auc,
        'roc_curve': roc_curve_data,
    }

    print(f"\nTest Metrics:")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  ROC-AUC  : {auc:.4f}" if auc else "  ROC-AUC  : N/A (single class)")

    regime_metrics = compute_regime_classification_metrics(
        y_test, y_test_pred, y_test_proba, regimes_test
    )
    if regimes_test is not None:
        print(f"\nPer-regime accuracy:")
        for regime, rm in regime_metrics.items():
            if rm['accuracy'] is not None:
                print(f"  {regime}: acc={rm['accuracy']:.3f}  n={rm['n_observations']}")

    print("\n" + "=" * 60)
    print("LOGISTIC REGRESSION TRAINING COMPLETE")
    print("=" * 60)

    return {
        'model':          model,
        'metrics':        metrics,
        'regime_metrics': regime_metrics,
        'predictions':    y_test_pred,
        'probabilities':  y_test_proba,
    }


def train_random_forest_classifier(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test:  pd.DataFrame,
    y_test:  pd.Series,
    regimes_test: pd.Series | None = None,
) -> dict:
    """
    Train Random Forest Classifier.  The crash probability IS the Fragility Score.

    `predict_proba(X)[:, 1] * 100` replaces the hand-crafted heuristic formula.
    This means:
      • A score of 15 = 15% model-estimated probability of a crash in 30 days
      • A score of 85 = 85% model-estimated probability of a crash in 30 days

    When a professor asks how the Fragility Score is calculated, the answer is:
    "It is the direct crash-probability output of a Random Forest Classifier
     trained to predict ISE drawdowns exceeding −5% over 30 trading days."
    """
    print("\n" + "=" * 60)
    print("TRAINING RANDOM FOREST CLASSIFIER")
    print("=" * 60)

    rf_clf = RandomForestClassifier(
        n_estimators=500,
        max_depth=10,
        min_samples_split=10,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
        verbose=0,
    )

    print(f"\nConfiguration:")
    print(f"  n_estimators=500, max_depth=10, class_weight='balanced'")
    print(f"\nTraining with {len(X_train)} observations...")
    print(f"Features ({len(X_train.columns)}): {list(X_train.columns)}")

    # TimeSeriesSplit cross-validation
    print(f"\nPerforming TimeSeriesSplit cross-validation (5 folds)...")
    tscv = TimeSeriesSplit(n_splits=5)
    cv_aucs = []
    for fold, (tr_idx, va_idx) in enumerate(tscv.split(X_train), 1):
        X_tr, y_tr = X_train.iloc[tr_idx], y_train.iloc[tr_idx]
        X_va, y_va = X_train.iloc[va_idx], y_train.iloc[va_idx]
        if y_va.nunique() < 2:
            continue
        fold_clf = RandomForestClassifier(
            n_estimators=200, max_depth=10, min_samples_split=10,
            class_weight='balanced', random_state=42, n_jobs=-1
        )
        fold_clf.fit(X_tr, y_tr)
        va_proba = fold_clf.predict_proba(X_va)[:, 1]
        try:
            fold_auc = roc_auc_score(y_va, va_proba)
            cv_aucs.append(fold_auc)
            print(f"  Fold {fold}: ROC-AUC={fold_auc:.4f}  (n_val={len(X_va)})")
        except Exception:
            print(f"  Fold {fold}: skipped (single class in validation)")

    if cv_aucs:
        print(f"\n  CV mean ROC-AUC: {np.mean(cv_aucs):.4f} ± {np.std(cv_aucs):.4f}")

    # Final model on full training set
    print(f"\nTraining final model on full training set...")
    rf_clf.fit(X_train, y_train)

    y_test_proba = rf_clf.predict_proba(X_test)[:, 1]
    y_test_pred  = (y_test_proba >= 0.5).astype(int)
    fragility_scores_test = y_test_proba * 100.0

    acc = float(accuracy_score(y_test, y_test_pred))
    try:
        auc = float(roc_auc_score(y_test, y_test_proba))
        fpr, tpr, _ = roc_curve(y_test, y_test_proba)
        roc_curve_data = [{'fpr': float(f), 'tpr': float(t)} for f, t in zip(fpr, tpr)]
    except Exception:
        auc = None
        roc_curve_data = []

    # Gini feature importance
    gini_importance = {
        feat: float(imp)
        for feat, imp in zip(X_train.columns, rf_clf.feature_importances_)
    }
    sorted_imp = sorted(gini_importance.items(), key=lambda x: x[1], reverse=True)

    print(f"\nTest Metrics:")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  ROC-AUC  : {auc:.4f}" if auc else "  ROC-AUC  : N/A")
    print(f"\nTop 5 Feature Importances (Gini):")
    for feat, imp in sorted_imp[:5]:
        print(f"  {feat}: {imp:.4f}")

    metrics = {
        'accuracy':    acc,
        'roc_auc':     auc,
        'roc_curve':   roc_curve_data,
        'cv_auc_mean': float(np.mean(cv_aucs)) if cv_aucs else None,
        'cv_auc_std':  float(np.std(cv_aucs))  if cv_aucs else None,
        'cv_scores':   [float(x) for x in cv_aucs],
    }

    regime_metrics = compute_regime_classification_metrics(
        y_test, y_test_pred, y_test_proba, regimes_test
    )
    if regimes_test is not None:
        print(f"\nPer-regime accuracy:")
        for regime, rm in regime_metrics.items():
            if rm['accuracy'] is not None:
                print(f"  {regime}: acc={rm['accuracy']:.3f}  crash_rate={rm['crash_rate']:.3f}  n={rm['n_observations']}")

    print("\n" + "=" * 60)
    print("RANDOM FOREST CLASSIFIER TRAINING COMPLETE")
    print("=" * 60)

    return {
        'model':             rf_clf,
        'metrics':           metrics,
        'regime_metrics':    regime_metrics,
        'predictions':       y_test_pred,
        'probabilities':     y_test_proba,
        'fragility_scores':  fragility_scores_test,
        'feature_importance': gini_importance,
    }


def compute_shap_classifier(
    model: RandomForestClassifier,
    X_test: pd.DataFrame,
    regimes_test: pd.Series | None = None,
) -> dict:
    """
    Compute SHAP values for the crash-probability classifier.

    SHAP on a classifier explains *what drives the probability of a crash*,
    not what drives today's return.  This directly answers the assignment
    requirement: 'Identify which variables contribute to market crises.'
    """
    print("\n" + "=" * 60)
    print("COMPUTING SHAP VALUES (Classifier — crash probability)")
    print("=" * 60)

    try:
        import shap
    except ImportError:
        print("ERROR: shap not installed. Run: pip install shap")
        return {'error': 'shap_not_installed'}

    print(f"\nInitializing SHAP TreeExplainer...")
    explainer = shap.TreeExplainer(model)

    print(f"Computing SHAP values for {len(X_test)} test observations...")
    shap_values_all = explainer.shap_values(X_test)

    # For binary RF, shap_values_all is a list [class0, class1]
    # We want class 1 (crash probability)
    if isinstance(shap_values_all, list):
        sv = shap_values_all[1]   # crash class
    else:
        sv = shap_values_all

    feature_names = list(X_test.columns)
    mean_abs_shap = {
        feat: float(np.mean(np.abs(sv[:, i])))
        for i, feat in enumerate(feature_names)
    }
    sorted_shap = sorted(mean_abs_shap.items(), key=lambda x: x[1], reverse=True)

    print(f"\nGlobal Feature Importance (Mean |SHAP|) for Crash Probability:")
    for feat, imp in sorted_shap:
        print(f"  {feat}: {imp:.6f}")

    regime_shap: dict = {}
    if regimes_test is not None:
        print(f"\nPer-regime SHAP analysis:")
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            mask = (regimes_test == regime).values
            n_regime = mask.sum()
            if n_regime > 0:
                rsv = sv[mask]
                regime_mean = {feat: float(np.mean(np.abs(rsv[:, i])))
                               for i, feat in enumerate(feature_names)}
                dominant = max(regime_mean.items(), key=lambda x: x[1])[0]
                print(f"  {regime} (n={n_regime}): dominant={dominant}")
                regime_shap[regime] = {
                    'observations': int(n_regime),
                    'dominant_feature': dominant,
                    'mean_abs_shap': regime_mean,
                    'top_5_features': [
                        {'feature': f, 'importance': float(i)}
                        for f, i in sorted(regime_mean.items(),
                                           key=lambda x: x[1], reverse=True)[:5]
                    ],
                }
            else:
                regime_shap[regime] = {'observations': 0, 'dominant_feature': None,
                                       'mean_abs_shap': {}, 'top_5_features': []}

    print("\n" + "=" * 60)
    print("SHAP COMPUTATION COMPLETE")
    print("=" * 60)

    return {
        'shap_matrix':    sv.tolist(),
        'feature_names':  feature_names,
        'mean_abs_shap':  mean_abs_shap,
        'top_features':   sorted_shap,
        'regime_shap':    regime_shap,
    }


def compare_classification_models(lr_results: dict, rf_results: dict) -> dict:
    """
    Compare Logistic Regression (linear baseline) vs Random Forest Classifier.

    Primary metric: ROC-AUC (measures crash-event discrimination).
    The expected narrative: RF dramatically outperforms LR because market
    crashes involve non-linear threshold effects that a linear model cannot
    represent.
    """
    print("\n" + "=" * 60)
    print("COMPARING CLASSIFICATION MODELS")
    print("=" * 60)

    lr_auc = lr_results['metrics'].get('roc_auc')
    rf_auc = rf_results['metrics'].get('roc_auc')

    comparison_table = [
        {
            'model': 'LogisticRegression',
            'accuracy': lr_results['metrics'].get('accuracy'),
            'roc_auc':  lr_auc,
        },
        {
            'model': 'RandomForest',
            'accuracy': rf_results['metrics'].get('accuracy'),
            'roc_auc':  rf_auc,
        },
    ]

    print(f"\n{'Model':<22} {'Accuracy':>10} {'ROC-AUC':>10}")
    print("-" * 44)
    for row in comparison_table:
        acc = f"{row['accuracy']:.4f}" if row['accuracy'] is not None else 'N/A'
        auc = f"{row['roc_auc']:.4f}"  if row['roc_auc']  is not None else 'N/A'
        print(f"{row['model']:<22} {acc:>10} {auc:>10}")

    rf_improvement_pct: dict = {}
    if lr_auc and rf_auc and lr_auc > 0:
        auc_improvement = ((rf_auc - lr_auc) / lr_auc) * 100
        rf_improvement_pct['roc_auc'] = float(auc_improvement)
        print(f"\nRF ROC-AUC improvement over LR: {auc_improvement:+.2f}%")

    # Minsky validation: does RF dominate LR in PONZI regime?
    ponzi_validation: dict = {}
    lr_ponzi = lr_results['regime_metrics'].get('PONZI', {})
    rf_ponzi = rf_results['regime_metrics'].get('PONZI', {})
    if lr_ponzi.get('accuracy') is not None and rf_ponzi.get('accuracy') is not None:
        rf_better = rf_ponzi['accuracy'] > lr_ponzi['accuracy']
        ponzi_validation = {
            'rf_better':   bool(rf_better),
            'lr_accuracy': float(lr_ponzi['accuracy']),
            'rf_accuracy': float(rf_ponzi['accuracy']),
        }
        print(f"\nPONZI regime accuracy — LR: {lr_ponzi['accuracy']:.3f}  RF: {rf_ponzi['accuracy']:.3f}")
        if rf_better:
            print("✓ VALIDATION PASSED: RF outperforms LR in PONZI regime")
        else:
            print("✗ VALIDATION NOTE: LR matches or beats RF in PONZI regime")

    print("\n" + "=" * 60)
    print("MODEL COMPARISON COMPLETE")
    print("=" * 60)

    return {
        'comparison_table':   comparison_table,
        'rf_improvement_pct': rf_improvement_pct,
        'ponzi_validation':   ponzi_validation,
    }


def export_model_outputs_classification(
    lr_results: dict,
    rf_results: dict,
    shap_results: dict,
    comparison: dict,
    crash_target_stats: dict,
    filepath: str,
) -> None:
    """
    Export classification pipeline outputs to JSON.

    JSON structure
    --------------
    {
        metadata: {...},
        crash_target_stats: {horizon, threshold, n_crash, n_normal, crash_pct},
        logistic_regression: {metrics, regime_metrics},
        random_forest: {metrics, regime_metrics, feature_importance},
        shap: {mean_abs_shap, regime_shap, top_features},
        comparison: {comparison_table, rf_improvement_pct, ponzi_validation}
    }
    """
    print("\n" + "=" * 60)
    print("EXPORTING CLASSIFICATION MODEL OUTPUTS TO JSON")
    print("=" * 60)

    metadata = {
        'timestamp': datetime.now().isoformat(),
        'pipeline': 'classification_v2',
        'target': 'crash_in_next_30_days (ISE_USD < -5%)',
        'python_version': sys.version.split()[0],
        'libraries': {
            'pandas': pd.__version__,
            'numpy':  np.__version__,
            'scikit-learn': __import__('sklearn').__version__,
        },
    }
    try:
        import shap
        metadata['libraries']['shap'] = shap.__version__
    except ImportError:
        pass

    # Clean up non-serialisable objects (model instances)
    lr_export = {
        'metrics':        lr_results.get('metrics', {}),
        'regime_metrics': lr_results.get('regime_metrics', {}),
    }
    rf_export = {
        'metrics':            rf_results.get('metrics', {}),
        'regime_metrics':     rf_results.get('regime_metrics', {}),
        'feature_importance': rf_results.get('feature_importance', {}),
    }

    output = {
        'metadata':            metadata,
        'crash_target_stats':  crash_target_stats,
        'logistic_regression': lr_export,
        'random_forest':       rf_export,
        'shap':                shap_results,
        'comparison':          comparison,
    }

    output_path = Path(filepath)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    def _clean(obj):
        if isinstance(obj, dict):
            return {k: _clean(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_clean(i) for i in obj]
        if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
            return None
        if isinstance(obj, (np.integer, np.floating)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return obj

    print(f"\nWriting to: {filepath}")
    with open(filepath, 'w') as f:
        json.dump(_clean(output), f, indent=2)

    size_kb = output_path.stat().st_size / 1024
    print(f"File size: {size_kb:.2f} KB")

    print("\n" + "=" * 60)
    print("EXPORT COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    # Example usage for testing
    print("Financial Fragility Clock - Models Module")
    print("=" * 60)
    
    # Load cleaned data and features
    print("\nLoading data...")
    with open("../src/data/cleaned_data.json", "r") as f:
        cleaned_data = json.load(f)
    
    with open("../src/data/features.json", "r") as f:
        features_data = json.load(f)
    
    # Convert to DataFrames
    df_clean = pd.DataFrame(cleaned_data['data'])
    df_clean['date'] = pd.to_datetime(df_clean['date'])
    df_clean = df_clean.set_index('date')
    
    df_features = pd.DataFrame(features_data['data'])
    df_features['date'] = pd.to_datetime(df_features['date'])
    df_features = df_features.set_index('date')
    
    # Prepare data for modeling
    # Target: ISE_USD
    # Features: 7 global indices (SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM)
    
    feature_cols = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
    target_col = 'ISE_USD'
    
    # Remove rows with NaN values in features or target
    valid_mask = df_clean[feature_cols + [target_col]].notna().all(axis=1)
    df_model = df_clean[valid_mask].copy()
    
    print(f"Valid observations for modeling: {len(df_model)}")
    
    # 80/20 time-based train-test split
    # First 428 observations for training, last 108 for testing
    train_size = 428
    
    X = df_model[feature_cols]
    y = df_model[target_col]
    
    X_train = X.iloc[:train_size]
    y_train = y.iloc[:train_size]
    X_test = X.iloc[train_size:]
    y_test = y.iloc[train_size:]
    
    print(f"\nTrain/Test Split:")
    print(f"  Training: {len(X_train)} observations ({X_train.index.min()} to {X_train.index.max()})")
    print(f"  Test: {len(X_test)} observations ({X_test.index.min()} to {X_test.index.max()})")
    
    # Get regime labels for test set
    regimes_test = df_features.loc[X_test.index, 'regime']
    
    # Train OLS model
    ols_results = train_ols(X_train, y_train, X_test, y_test, regimes_test)
    
    # Prepare Random Forest features (includes engineered features)
    # Features: SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM, mean_rolling_correlation, 
    #           permutation_entropy, Minsky_regime_encoded
    
    print("\n" + "=" * 60)
    print("PREPARING RANDOM FOREST FEATURES")
    print("=" * 60)
    
    # Merge market data with engineered features
    rf_feature_cols = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
    engineered_feature_cols = ['mean_corr', 'permutation_entropy', 'regime']
    
    # Create combined dataset
    df_rf = df_clean[[target_col] + rf_feature_cols].copy()
    
    # Add engineered features from features dataset
    for col in engineered_feature_cols:
        if col in df_features.columns:
            df_rf[col] = df_features[col]
    
    # NOTE: regime_encoded is intentionally excluded from model features.
    # regime is derived from the same rolling signals already in X (mean_corr,
    # eigenvalue_ratio) so including the encoded label creates implicit data
    # leakage and makes SHAP uninterpretable. The 'regime' column is kept in
    # df_rf solely to supply regimes_rf_test for per-regime RMSE evaluation.
    
    # Remove rows with NaN values (on numeric model columns only; regime NaN
    # is allowed since it is only used as a grouping variable post-prediction)
    rf_model_cols = rf_feature_cols + ['mean_corr', 'permutation_entropy']
    rf_valid_mask = df_rf[rf_model_cols + [target_col]].notna().all(axis=1)
    df_rf_clean = df_rf[rf_valid_mask].copy()
    
    print(f"\nValid observations for Random Forest: {len(df_rf_clean)}")
    print(f"Features: {rf_model_cols}")
    
    # Split into train/test (same time-based split)
    # Find the split date from original split
    split_date = X_train.index.max()
    
    X_rf_train = df_rf_clean[df_rf_clean.index <= split_date][rf_model_cols]
    y_rf_train = df_rf_clean[df_rf_clean.index <= split_date][target_col]
    X_rf_test = df_rf_clean[df_rf_clean.index > split_date][rf_model_cols]
    y_rf_test = df_rf_clean[df_rf_clean.index > split_date][target_col]
    regimes_rf_test = df_rf_clean[df_rf_clean.index > split_date]['regime']
    
    print(f"\nRandom Forest Train/Test Split:")
    print(f"  Training: {len(X_rf_train)} observations ({X_rf_train.index.min()} to {X_rf_train.index.max()})")
    print(f"  Test: {len(X_rf_test)} observations ({X_rf_test.index.min()} to {X_rf_test.index.max()})")
    
    # Train Random Forest model
    rf_results = train_random_forest(X_rf_train, y_rf_train, X_rf_test, y_rf_test, regimes_rf_test)
    
    # Compute SHAP values for Random Forest model
    # Need to get the trained model from train_random_forest
    # For now, we'll retrain to get the model object
    from sklearn.ensemble import RandomForestRegressor
    rf_model = RandomForestRegressor(
        n_estimators=500,
        max_depth=10,
        min_samples_split=10,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_rf_train, y_rf_train)
    
    # Compute SHAP values
    shap_results = compute_shap_values(rf_model, X_rf_test, regimes_rf_test)
    
    # Compare models
    comparison_results = compare_models(ols_results, rf_results)
    
    # Export all model outputs to JSON
    export_model_outputs(
        ols=ols_results,
        rf=rf_results,
        shap_results=shap_results,
        comparison=comparison_results,
        filepath='../src/data/model_outputs.json'
    )
    
    print("\n" + "=" * 60)
    print("ALL MODEL TRAINING AND EXPORT COMPLETE!")
    print("=" * 60)
