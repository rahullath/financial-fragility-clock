"""
Model B Models Module - Crisis Prediction Validation.

This module implements walk-forward validation, crisis prediction testing,
and SHAP analysis for Model B (extended 2003-2025 data with macro signals).

Key features:
1. Walk-forward validation with expanding windows (2003-2007→2008, 2003-2019→2020)
2. Crisis prediction capability testing (pre-crisis fragility score elevation)
3. SHAP analysis for crisis periods
4. Export to model_b_outputs.json

Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 35.6
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import json
from datetime import datetime
from pathlib import Path
import sys
import warnings
from typing import Dict, Tuple, List


def train_random_forest_walk_forward(df: pd.DataFrame, 
                                     target_col: str = 'SP500',
                                     feature_cols: List[str] = None) -> Dict:
    """
    Train Random Forest with walk-forward validation using expanding windows.
    
    Split 1: Train on 2003-2007, test on 2008 (captures 2008 crisis)
    Split 2: Train on 2003-2019, test on 2020 (captures COVID crash)
    
    Args:
        df: DataFrame with features and target
        target_col: Target variable column name
        feature_cols: List of feature column names (if None, auto-detect)
        
    Returns:
        Dictionary with walk-forward validation results
        
    Requirements: 35.1, 35.2, 35.3
    """
    print("\n" + "=" * 60)
    print("MODEL B: WALK-FORWARD VALIDATION")
    print("=" * 60)
    
    # Auto-detect feature columns if not provided
    if feature_cols is None:
        # Use market indices + macro signals + engineered features
        feature_cols = []
        
        # Market indices
        market_indices = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM', 
                         'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200']
        for col in market_indices:
            if col in df.columns and col != target_col:
                feature_cols.append(col)
        
        # Macro signals
        macro_signals = ['VIX', 'TED_SPREAD', 'YIELD_SPREAD', 'CREDIT_SPREAD']
        for col in macro_signals:
            if col in df.columns:
                feature_cols.append(col)
        
        # Engineered features
        engineered_features = ['mean_corr', 'eigenvalue_ratio', 'permutation_entropy', 
                              'rolling_volatility', 'volatility_synchrony']
        for col in engineered_features:
            if col in df.columns:
                feature_cols.append(col)
        
        # Regime encoding
        if 'regime' in df.columns:
            # Encode regime as numeric
            regime_encoding = {'HEDGE': 0, 'SPECULATIVE': 1, 'PONZI': 2}
            df['regime_encoded'] = df['regime'].map(regime_encoding)
            feature_cols.append('regime_encoded')
    
    print(f"\nTarget: {target_col}")
    print(f"Features ({len(feature_cols)}): {feature_cols}")
    
    # Define walk-forward splits
    splits = [
        {
            'name': 'split_2008',
            'train_start': '2003-01-01',
            'train_end': '2007-12-31',
            'test_start': '2008-01-01',
            'test_end': '2008-12-31',
            'description': '2008 Financial Crisis'
        },
        {
            'name': 'split_2020',
            'train_start': '2003-01-01',
            'train_end': '2019-12-31',
            'test_start': '2020-01-01',
            'test_end': '2020-12-31',
            'description': 'COVID-19 Crash'
        }
    ]
    
    results = {}
    
    for split_config in splits:
        split_name = split_config['name']
        print(f"\n{'=' * 60}")
        print(f"SPLIT: {split_config['description']}")
        print(f"{'=' * 60}")
        
        # Extract train and test data
        train_mask = (df.index >= split_config['train_start']) & (df.index <= split_config['train_end'])
        test_mask = (df.index >= split_config['test_start']) & (df.index <= split_config['test_end'])
        
        df_train = df[train_mask].copy()
        df_test = df[test_mask].copy()
        
        print(f"\nTrain period: {split_config['train_start']} to {split_config['train_end']}")
        print(f"  Observations: {len(df_train)}")
        print(f"Test period: {split_config['test_start']} to {split_config['test_end']}")
        print(f"  Observations: {len(df_test)}")
        
        # Remove rows with NaN in features or target
        train_valid_mask = df_train[feature_cols + [target_col]].notna().all(axis=1)
        test_valid_mask = df_test[feature_cols + [target_col]].notna().all(axis=1)
        
        df_train_clean = df_train[train_valid_mask]
        df_test_clean = df_test[test_valid_mask]
        
        print(f"\nAfter removing NaN:")
        print(f"  Train: {len(df_train_clean)} observations")
        print(f"  Test: {len(df_test_clean)} observations")
        
        if len(df_train_clean) == 0 or len(df_test_clean) == 0:
            warnings.warn(f"Insufficient data for {split_name}, skipping...")
            results[split_name] = {'error': 'insufficient_data'}
            continue
        
        # Prepare X and y
        X_train = df_train_clean[feature_cols]
        y_train = df_train_clean[target_col]
        X_test = df_test_clean[feature_cols]
        y_test = df_test_clean[target_col]
        regimes_test = df_test_clean.get('regime', None)
        
        # Train Random Forest
        print(f"\nTraining Random Forest...")
        print(f"  n_estimators=500, max_depth=10, min_samples_split=10")
        
        rf_model = RandomForestRegressor(
            n_estimators=500,
            max_depth=10,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1,
            verbose=0
        )
        
        rf_model.fit(X_train, y_train)
        
        # Make predictions
        y_train_pred = rf_model.predict(X_train)
        y_test_pred = rf_model.predict(X_test)
        
        # Compute overall metrics
        train_r2 = r2_score(y_train, y_train_pred)
        train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
        train_mae = mean_absolute_error(y_train, y_train_pred)
        
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
        
        # Compute regime-specific RMSE
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
        
        # Compute feature importance
        feature_importance = {}
        for feature, importance in zip(feature_cols, rf_model.feature_importances_):
            feature_importance[feature] = float(importance)
        
        print(f"\nTop 5 Feature Importances:")
        sorted_importance = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
        for feature, importance in sorted_importance[:5]:
            print(f"  {feature}: {importance:.4f}")
        
        # Store results for this split
        results[split_name] = {
            'description': split_config['description'],
            'train_period': f"{split_config['train_start']} to {split_config['train_end']}",
            'test_period': f"{split_config['test_start']} to {split_config['test_end']}",
            'train_observations': int(len(df_train_clean)),
            'test_observations': int(len(df_test_clean)),
            'metrics': {
                'train_r2': float(train_r2),
                'train_rmse': float(train_rmse),
                'train_mae': float(train_mae),
                'test_r2': float(test_r2),
                'test_rmse': float(test_rmse),
                'test_mae': float(test_mae)
            },
            'regime_rmse': regime_rmse,
            'feature_importance': feature_importance
        }
    
    print("\n" + "=" * 60)
    print("WALK-FORWARD VALIDATION COMPLETE")
    print("=" * 60)
    
    return results



def validate_crisis_prediction(df: pd.DataFrame) -> Dict:
    """
    Test whether fragility score peaks 3-6 months before major crashes.
    
    Tests:
    1. Sep 2008 crash (Lehman Brothers collapse)
    2. Mar 2020 COVID crash
    
    Args:
        df: DataFrame with fragility_score column and date index
        
    Returns:
        Dictionary with crisis prediction validation results
        
    Requirements: 35.4
    """
    print("\n" + "=" * 60)
    print("MODEL B: CRISIS PREDICTION VALIDATION")
    print("=" * 60)
    
    if 'fragility_score' not in df.columns:
        warnings.warn("fragility_score column not found in DataFrame")
        return {'error': 'missing_fragility_score'}
    
    # Define crisis dates
    crises = [
        {
            'name': '2008_crisis',
            'description': 'Sep 2008 Financial Crisis (Lehman Brothers)',
            'crisis_date': '2008-09-15',  # Lehman Brothers bankruptcy
            'lookback_start': '2008-03-15',  # 6 months before
            'lookback_end': '2008-06-15'     # 3 months before
        },
        {
            'name': '2020_covid',
            'description': 'Mar 2020 COVID-19 Crash',
            'crisis_date': '2020-03-16',  # Market bottom
            'lookback_start': '2019-09-16',  # 6 months before
            'lookback_end': '2019-12-16'     # 3 months before
        }
    ]
    
    results = {}
    
    for crisis in crises:
        crisis_name = crisis['name']
        print(f"\n{'=' * 60}")
        print(f"CRISIS: {crisis['description']}")
        print(f"{'=' * 60}")
        
        crisis_date = pd.to_datetime(crisis['crisis_date'])
        lookback_start = pd.to_datetime(crisis['lookback_start'])
        lookback_end = pd.to_datetime(crisis['lookback_end'])
        
        print(f"\nCrisis date: {crisis_date.date()}")
        print(f"Pre-crisis window: {lookback_start.date()} to {lookback_end.date()}")
        
        # Get fragility scores in pre-crisis window
        pre_crisis_mask = (df.index >= lookback_start) & (df.index <= lookback_end)
        pre_crisis_scores = df.loc[pre_crisis_mask, 'fragility_score'].dropna()
        
        if len(pre_crisis_scores) == 0:
            warnings.warn(f"No fragility scores in pre-crisis window for {crisis_name}")
            results[crisis_name] = {'error': 'no_data_in_window'}
            continue
        
        # Find peak fragility score in pre-crisis window
        peak_score = pre_crisis_scores.max()
        peak_date = pre_crisis_scores.idxmax()
        
        # Calculate lead time (months before crisis)
        lead_time_days = (crisis_date - peak_date).days
        lead_time_months = lead_time_days / 30.0
        
        print(f"\nPre-crisis fragility peak:")
        print(f"  Date: {peak_date.date()}")
        print(f"  Score: {peak_score:.2f}")
        print(f"  Lead time: {lead_time_days} days ({lead_time_months:.1f} months)")
        
        # Check if peak is within 3-6 month window
        peak_detected = (3 <= lead_time_months <= 6)
        
        if peak_detected:
            print(f"  ✓ Peak detected 3-6 months before crisis")
        else:
            print(f"  ✗ Peak NOT in 3-6 month window before crisis")
        
        # Get baseline fragility score (1 year before crisis)
        baseline_start = crisis_date - pd.DateOffset(months=18)
        baseline_end = crisis_date - pd.DateOffset(months=12)
        baseline_mask = (df.index >= baseline_start) & (df.index <= baseline_end)
        baseline_scores = df.loc[baseline_mask, 'fragility_score'].dropna()
        
        if len(baseline_scores) > 0:
            baseline_mean = baseline_scores.mean()
            elevation_pct = ((peak_score - baseline_mean) / baseline_mean) * 100
            print(f"\nBaseline comparison:")
            print(f"  Baseline mean (12-18 months before): {baseline_mean:.2f}")
            print(f"  Peak elevation: {elevation_pct:+.1f}%")
        else:
            baseline_mean = None
            elevation_pct = None
        
        # Compute false positive rate (peaks that didn't lead to crises)
        # Look at all peaks in the year before crisis (excluding the 3-6 month window)
        year_before_start = crisis_date - pd.DateOffset(months=12)
        year_before_end = lookback_start
        year_before_mask = (df.index >= year_before_start) & (df.index < year_before_end)
        year_before_scores = df.loc[year_before_mask, 'fragility_score'].dropna()
        
        if len(year_before_scores) > 0:
            # Count peaks above 75th percentile that didn't lead to crisis
            threshold = year_before_scores.quantile(0.75)
            false_peaks = (year_before_scores > threshold).sum()
            false_positive_rate = false_peaks / len(year_before_scores)
            print(f"\nFalse positive analysis:")
            print(f"  Peaks above 75th percentile (6-12 months before): {false_peaks}")
            print(f"  False positive rate: {false_positive_rate:.2%}")
        else:
            false_positive_rate = None
        
        # Get actual crisis period fragility score
        crisis_window_start = crisis_date
        crisis_window_end = crisis_date + pd.DateOffset(months=1)
        crisis_mask = (df.index >= crisis_window_start) & (df.index <= crisis_window_end)
        crisis_scores = df.loc[crisis_mask, 'fragility_score'].dropna()
        
        if len(crisis_scores) > 0:
            crisis_mean = crisis_scores.mean()
            crisis_max = crisis_scores.max()
            print(f"\nActual crisis period fragility:")
            print(f"  Mean: {crisis_mean:.2f}")
            print(f"  Max: {crisis_max:.2f}")
        else:
            crisis_mean = None
            crisis_max = None
        
        # Store results
        results[crisis_name] = {
            'description': crisis['description'],
            'crisis_date': crisis_date.isoformat(),
            'peak_date': peak_date.isoformat(),
            'peak_score': float(peak_score),
            'lead_time_days': int(lead_time_days),
            'lead_time_months': float(lead_time_months),
            'peak_detected_3_6_months': bool(peak_detected),
            'baseline_mean': float(baseline_mean) if baseline_mean is not None else None,
            'elevation_pct': float(elevation_pct) if elevation_pct is not None else None,
            'false_positive_rate': float(false_positive_rate) if false_positive_rate is not None else None,
            'crisis_mean_score': float(crisis_mean) if crisis_mean is not None else None,
            'crisis_max_score': float(crisis_max) if crisis_max is not None else None
        }
    
    # Summary
    print("\n" + "=" * 60)
    print("CRISIS PREDICTION VALIDATION SUMMARY")
    print("=" * 60)
    
    successful_predictions = sum(1 for r in results.values() 
                                 if isinstance(r, dict) and r.get('peak_detected_3_6_months', False))
    total_crises = len([r for r in results.values() if isinstance(r, dict) and 'error' not in r])
    
    print(f"\nSuccessful predictions: {successful_predictions}/{total_crises}")
    
    if successful_predictions == total_crises:
        print("✓ Model successfully predicted all tested crises")
    elif successful_predictions > 0:
        print("⚠ Model predicted some but not all crises")
    else:
        print("✗ Model failed to predict crises in 3-6 month window")
    
    print("\n" + "=" * 60)
    
    return results



def compute_shap_values_b(df: pd.DataFrame, 
                         target_col: str = 'SP500',
                         feature_cols: List[str] = None) -> Dict:
    """
    Compute SHAP values for crisis periods to identify important macro signals.
    
    Focuses on:
    1. Pre-crisis periods (2007 H2, 2019 Q4)
    2. Crisis periods (2008, 2020)
    3. Regime comparison across all three regimes
    
    Args:
        df: DataFrame with features and target
        target_col: Target variable column name
        feature_cols: List of feature column names (if None, auto-detect)
        
    Returns:
        Dictionary with SHAP analysis results
        
    Requirements: 35.5, 35.6
    """
    print("\n" + "=" * 60)
    print("MODEL B: SHAP ANALYSIS FOR CRISIS PERIODS")
    print("=" * 60)
    
    try:
        import shap
    except ImportError:
        print("ERROR: shap library not installed. Install with: pip install shap")
        return {'error': 'shap_not_installed'}
    
    # Auto-detect feature columns if not provided
    if feature_cols is None:
        feature_cols = []
        
        # Market indices
        market_indices = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM', 
                         'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200']
        for col in market_indices:
            if col in df.columns and col != target_col:
                feature_cols.append(col)
        
        # Macro signals
        macro_signals = ['VIX', 'TED_SPREAD', 'YIELD_SPREAD', 'CREDIT_SPREAD']
        for col in macro_signals:
            if col in df.columns:
                feature_cols.append(col)
        
        # Engineered features
        engineered_features = ['mean_corr', 'eigenvalue_ratio', 'permutation_entropy', 
                              'rolling_volatility', 'volatility_synchrony']
        for col in engineered_features:
            if col in df.columns:
                feature_cols.append(col)
        
        # Regime encoding
        if 'regime' in df.columns:
            regime_encoding = {'HEDGE': 0, 'SPECULATIVE': 1, 'PONZI': 2}
            df['regime_encoded'] = df['regime'].map(regime_encoding)
            feature_cols.append('regime_encoded')
    
    print(f"\nTarget: {target_col}")
    print(f"Features ({len(feature_cols)}): {feature_cols}")
    
    # Train model on full dataset (2003-2019) to analyze 2020
    train_mask = (df.index >= '2003-01-01') & (df.index <= '2019-12-31')
    df_train = df[train_mask].copy()
    
    # Remove rows with NaN
    train_valid_mask = df_train[feature_cols + [target_col]].notna().all(axis=1)
    df_train_clean = df_train[train_valid_mask]
    
    print(f"\nTraining model on 2003-2019 data...")
    print(f"  Observations: {len(df_train_clean)}")
    
    X_train = df_train_clean[feature_cols]
    y_train = df_train_clean[target_col]
    
    # Train Random Forest
    rf_model = RandomForestRegressor(
        n_estimators=500,
        max_depth=10,
        min_samples_split=10,
        random_state=42,
        n_jobs=-1,
        verbose=0
    )
    
    rf_model.fit(X_train, y_train)
    
    print(f"Model trained successfully")
    
    # Define crisis periods for SHAP analysis
    crisis_periods = [
        {
            'name': 'pre_crisis_2007',
            'description': 'Pre-2008 Crisis (2007 H2)',
            'start': '2007-07-01',
            'end': '2007-12-31'
        },
        {
            'name': 'crisis_2008',
            'description': '2008 Financial Crisis',
            'start': '2008-01-01',
            'end': '2008-12-31'
        },
        {
            'name': 'pre_crisis_2019',
            'description': 'Pre-COVID Crisis (2019 Q4)',
            'start': '2019-10-01',
            'end': '2019-12-31'
        },
        {
            'name': 'crisis_2020',
            'description': '2020 COVID Crash',
            'start': '2020-01-01',
            'end': '2020-12-31'
        }
    ]
    
    # Initialize TreeExplainer
    print(f"\nInitializing SHAP TreeExplainer...")
    explainer = shap.TreeExplainer(rf_model)
    
    results = {
        'crisis_periods': {},
        'regime_comparison': {}
    }
    
    # Compute SHAP values for each crisis period
    for period in crisis_periods:
        period_name = period['name']
        print(f"\n{'=' * 60}")
        print(f"PERIOD: {period['description']}")
        print(f"{'=' * 60}")
        
        period_mask = (df.index >= period['start']) & (df.index <= period['end'])
        df_period = df[period_mask].copy()
        
        # Remove rows with NaN
        period_valid_mask = df_period[feature_cols].notna().all(axis=1)
        df_period_clean = df_period[period_valid_mask]
        
        print(f"\nPeriod: {period['start']} to {period['end']}")
        print(f"  Observations: {len(df_period_clean)}")
        
        if len(df_period_clean) == 0:
            warnings.warn(f"No data for {period_name}, skipping...")
            results['crisis_periods'][period_name] = {'error': 'no_data'}
            continue
        
        X_period = df_period_clean[feature_cols]
        
        # Compute SHAP values
        print(f"Computing SHAP values...")
        shap_values = explainer.shap_values(X_period)
        
        # Compute mean absolute SHAP per feature
        mean_abs_shap = {}
        for i, feature in enumerate(feature_cols):
            mean_abs_shap[feature] = float(np.mean(np.abs(shap_values[:, i])))
        
        # Identify dominant features
        sorted_shap = sorted(mean_abs_shap.items(), key=lambda x: x[1], reverse=True)
        
        print(f"\nTop 5 Most Important Features:")
        for feature, importance in sorted_shap[:5]:
            print(f"  {feature}: {importance:.6f}")
        
        # Identify dominant macro signal
        macro_signals_in_features = [f for f in feature_cols if f in ['VIX', 'TED_SPREAD', 'YIELD_SPREAD', 'CREDIT_SPREAD']]
        if macro_signals_in_features:
            macro_shap = {f: mean_abs_shap[f] for f in macro_signals_in_features}
            dominant_macro = max(macro_shap.items(), key=lambda x: x[1])[0]
            print(f"\nDominant Macro Signal: {dominant_macro} ({macro_shap[dominant_macro]:.6f})")
        else:
            dominant_macro = None
        
        # Store results
        results['crisis_periods'][period_name] = {
            'description': period['description'],
            'period': f"{period['start']} to {period['end']}",
            'observations': int(len(df_period_clean)),
            'mean_abs_shap': mean_abs_shap,
            'top_5_features': [{'feature': f, 'importance': float(imp)} for f, imp in sorted_shap[:5]],
            'dominant_macro_signal': dominant_macro
        }
    
    # Compute regime-specific SHAP analysis
    print(f"\n{'=' * 60}")
    print(f"REGIME COMPARISON")
    print(f"{'=' * 60}")
    
    if 'regime' in df.columns:
        # Use full dataset for regime comparison
        full_mask = df[feature_cols + [target_col]].notna().all(axis=1)
        df_full_clean = df[full_mask]
        
        X_full = df_full_clean[feature_cols]
        regimes_full = df_full_clean['regime']
        
        print(f"\nComputing SHAP values for full dataset...")
        print(f"  Observations: {len(X_full)}")
        
        shap_values_full = explainer.shap_values(X_full)
        
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            regime_mask = regimes_full == regime
            n_regime = regime_mask.sum()
            
            if n_regime > 0:
                print(f"\n{regime} Regime (n={n_regime}):")
                
                # Get SHAP values for this regime
                regime_shap_values = shap_values_full[regime_mask.values]
                
                # Compute mean absolute SHAP per feature
                regime_mean_abs_shap = {}
                for i, feature in enumerate(feature_cols):
                    regime_mean_abs_shap[feature] = float(np.mean(np.abs(regime_shap_values[:, i])))
                
                # Identify dominant feature
                sorted_regime_shap = sorted(regime_mean_abs_shap.items(), key=lambda x: x[1], reverse=True)
                dominant_feature = sorted_regime_shap[0][0]
                
                print(f"  Dominant feature: {dominant_feature} ({regime_mean_abs_shap[dominant_feature]:.6f})")
                print(f"  Top 3 features:")
                for feature, importance in sorted_regime_shap[:3]:
                    print(f"    {feature}: {importance:.6f}")
                
                # Store results
                results['regime_comparison'][regime] = {
                    'observations': int(n_regime),
                    'dominant_feature': dominant_feature,
                    'mean_abs_shap': regime_mean_abs_shap,
                    'top_5_features': [{'feature': f, 'importance': float(imp)} for f, imp in sorted_regime_shap[:5]]
                }
            else:
                print(f"\n{regime} Regime: No observations")
                results['regime_comparison'][regime] = {
                    'observations': 0,
                    'dominant_feature': None,
                    'mean_abs_shap': {},
                    'top_5_features': []
                }
    
    print("\n" + "=" * 60)
    print("SHAP ANALYSIS COMPLETE")
    print("=" * 60)
    
    return results



def export_model_outputs_b(walk_forward_results: Dict,
                           crisis_prediction_results: Dict,
                           shap_results: Dict,
                           filepath: str = "../../src/data/model_b_outputs.json") -> None:
    """
    Export Model B model outputs to JSON.
    
    Args:
        walk_forward_results: Walk-forward validation results
        crisis_prediction_results: Crisis prediction validation results
        shap_results: SHAP analysis results
        filepath: Output JSON file path
        
    JSON structure:
    {
        "metadata": {...},
        "walk_forward_validation": {
            "split_2008": {...},
            "split_2020": {...}
        },
        "crisis_prediction": {
            "2008_crisis": {...},
            "2020_covid": {...}
        },
        "shap": {
            "crisis_periods": {...},
            "regime_comparison": {...}
        }
    }
    """
    print("\n" + "=" * 60)
    print("EXPORTING MODEL B OUTPUTS TO JSON")
    print("=" * 60)
    
    # Create metadata
    metadata = {
        'model': 'Model B',
        'description': 'Extended 2003-2025 global data with macro signals and crisis prediction validation',
        'timestamp': datetime.now().isoformat(),
        'python_version': sys.version.split()[0],
        'libraries': {
            'pandas': pd.__version__,
            'numpy': np.__version__,
            'scikit-learn': __import__('sklearn').__version__
        }
    }
    
    # Try to add shap version if available
    try:
        import shap
        metadata['libraries']['shap'] = shap.__version__
    except ImportError:
        pass
    
    print(f"\nMetadata:")
    print(f"  Model: {metadata['model']}")
    print(f"  Timestamp: {metadata['timestamp']}")
    print(f"  Python version: {metadata['python_version']}")
    
    # Compile full output structure
    output = {
        'metadata': metadata,
        'walk_forward_validation': walk_forward_results,
        'crisis_prediction': crisis_prediction_results,
        'shap': shap_results
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
    file_size_mb = file_size_kb / 1024
    
    if file_size_mb >= 1:
        print(f"File size: {file_size_mb:.2f} MB")
    else:
        print(f"File size: {file_size_kb:.2f} KB")
    
    print("\n" + "=" * 60)
    print("MODEL B OUTPUTS EXPORT COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    print("=" * 60)
    print("MODEL B: CRISIS PREDICTION VALIDATION PIPELINE")
    print("=" * 60)
    
    # Load Model B features
    print("\nLoading Model B features...")
    features_path = Path("../../src/data/model_b_features.json")
    
    if not features_path.exists():
        print(f"ERROR: Features file not found at {features_path}")
        print("Please run feature_engineering_b.py and regime_labeling_b.py first.")
        exit(1)
    
    with open(features_path, "r") as f:
        features_data = json.load(f)
    
    # Convert to DataFrame
    df = pd.DataFrame(features_data['data'])
    df['date'] = pd.to_datetime(df['date'])
    df = df.set_index('date')
    
    print(f"Loaded features: {df.shape[0]} observations × {df.shape[1]} columns")
    print(f"Date range: {df.index.min()} to {df.index.max()}")
    
    # Check for required columns
    required_cols = ['fragility_score', 'regime']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        print(f"\nERROR: Missing required columns: {missing_cols}")
        print("Please ensure feature_engineering_b.py and regime_labeling_b.py have been run.")
        exit(1)
    
    # Run Model B pipeline
    print("\n" + "=" * 60)
    print("RUNNING MODEL B PIPELINE")
    print("=" * 60)
    
    # 1. Walk-forward validation
    print("\n[1/3] Walk-forward validation...")
    walk_forward_results = train_random_forest_walk_forward(df, target_col='SP500')
    
    # 2. Crisis prediction validation
    print("\n[2/3] Crisis prediction validation...")
    crisis_prediction_results = validate_crisis_prediction(df)
    
    # 3. SHAP analysis
    print("\n[3/3] SHAP analysis...")
    shap_results = compute_shap_values_b(df, target_col='SP500')
    
    # Export results
    print("\n[4/4] Exporting results...")
    export_model_outputs_b(
        walk_forward_results=walk_forward_results,
        crisis_prediction_results=crisis_prediction_results,
        shap_results=shap_results,
        filepath="../../src/data/model_b_outputs.json"
    )
    
    print("\n" + "=" * 60)
    print("MODEL B PIPELINE COMPLETE!")
    print("=" * 60)
    
    # Print summary
    print("\nSummary:")
    print(f"  Walk-forward splits: {len(walk_forward_results)}")
    print(f"  Crisis predictions tested: {len(crisis_prediction_results)}")
    print(f"  SHAP crisis periods analyzed: {len(shap_results.get('crisis_periods', {}))}")
    print(f"  SHAP regimes analyzed: {len(shap_results.get('regime_comparison', {}))}")
    
    # Check crisis prediction success
    successful_predictions = sum(1 for r in crisis_prediction_results.values() 
                                 if isinstance(r, dict) and r.get('peak_detected_3_6_months', False))
    total_crises = len([r for r in crisis_prediction_results.values() 
                       if isinstance(r, dict) and 'error' not in r])
    
    print(f"\nCrisis Prediction Success Rate: {successful_predictions}/{total_crises}")
    
    if successful_predictions == total_crises:
        print("✓ Model successfully predicted all tested crises")
    elif successful_predictions > 0:
        print("⚠ Model predicted some but not all crises")
    else:
        print("✗ Model failed to predict crises in 3-6 month window")
