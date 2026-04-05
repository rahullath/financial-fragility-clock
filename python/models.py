"""
Models module for Financial Fragility Clock.

This module handles OLS regression, Random Forest, LSTM training,
SHAP explainability, and model performance comparison.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import statsmodels.api as sm
from statsmodels.stats.diagnostic import het_breuschpagan
from statsmodels.stats.stattools import durbin_watson
import json
from datetime import datetime
from pathlib import Path
import sys
import warnings


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
    regime_rmse = {}
    if regimes_test is not None:
        print(f"\nRegime-Specific Test RMSE:")
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            regime_mask = regimes_test == regime
            if regime_mask.sum() > 0:
                regime_y_test = y_test[regime_mask]
                regime_y_pred = y_test_pred[regime_mask]
                regime_rmse_val = np.sqrt(mean_squared_error(regime_y_test, regime_y_pred))
                regime_rmse[regime] = float(regime_rmse_val)
                print(f"  {regime}: {regime_rmse_val:.6f} (n={regime_mask.sum()})")
            else:
                regime_rmse[regime] = None
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
    regime_rmse = {}
    if regimes_test is not None:
        print(f"\nRegime-Specific Test RMSE:")
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            regime_mask = regimes_test == regime
            if regime_mask.sum() > 0:
                regime_y_test = y_test[regime_mask]
                regime_y_pred = y_test_pred[regime_mask]
                regime_rmse_val = np.sqrt(mean_squared_error(regime_y_test, regime_y_pred))
                regime_rmse[regime] = float(regime_rmse_val)
                print(f"  {regime}: {regime_rmse_val:.6f} (n={regime_mask.sum()})")
            else:
                regime_rmse[regime] = None
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
    
    # Compile full output structure
    output = {
        'metadata': metadata,
        'ols': ols,
        'random_forest': rf,
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
    
    # Encode regime as numeric (HEDGE=0, SPECULATIVE=1, PONZI=2)
    regime_encoding = {'HEDGE': 0, 'SPECULATIVE': 1, 'PONZI': 2}
    df_rf['regime_encoded'] = df_rf['regime'].map(regime_encoding)
    
    # Remove rows with NaN values
    rf_valid_mask = df_rf.notna().all(axis=1)
    df_rf_clean = df_rf[rf_valid_mask].copy()
    
    print(f"\nValid observations for Random Forest: {len(df_rf_clean)}")
    print(f"Features: {rf_feature_cols + ['mean_corr', 'permutation_entropy', 'regime_encoded']}")
    
    # Split into train/test (same time-based split)
    # Find the split date from original split
    split_date = X_train.index.max()
    
    X_rf_train = df_rf_clean[df_rf_clean.index <= split_date][rf_feature_cols + ['mean_corr', 'permutation_entropy', 'regime_encoded']]
    y_rf_train = df_rf_clean[df_rf_clean.index <= split_date][target_col]
    X_rf_test = df_rf_clean[df_rf_clean.index > split_date][rf_feature_cols + ['mean_corr', 'permutation_entropy', 'regime_encoded']]
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
