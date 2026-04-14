"""
Compute Feature Importance Time Series using Rolling Window SHAP Values.

This script computes SHAP values over rolling time windows to show how
feature importance changes over time. This fixes Bug 3 where the Feature
Importance Over Time chart shows empty or uses raw feature values instead
of actual SHAP time-series data.

Requirements: 1.5, 1.6, 1.7, 2.5, 2.6
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime
import sys
from sklearn.ensemble import RandomForestRegressor
import warnings

warnings.filterwarnings('ignore')


def compute_rolling_shap_timeseries(
    df: pd.DataFrame,
    feature_cols: list,
    target_col: str,
    window_size: int = 30,
    step_size: int = 5
) -> list:
    """
    Compute SHAP values over rolling time windows.
    
    Args:
        df: DataFrame with features and target, indexed by date
        feature_cols: List of feature column names (7 global indices)
        target_col: Target column name (ISE_USD)
        window_size: Number of days in each window (default: 30)
        step_size: Number of days to step forward (default: 5)
    
    Returns:
        List of dictionaries with structure:
        [
            {
                "timestamp": "2024-01-15",
                "feature_importance": {
                    "SP500": 0.0045,
                    "DAX": 0.0038,
                    ...
                }
            },
            ...
        ]
    """
    print(f"\nComputing rolling window SHAP time series...")
    print(f"  Window size: {window_size} days")
    print(f"  Step size: {step_size} days")
    print(f"  Features: {feature_cols}")
    
    # Import SHAP
    try:
        import shap
    except ImportError:
        print("ERROR: shap library not installed. Install with: pip install shap")
        raise
    
    # Prepare data
    df_clean = df[feature_cols + [target_col]].dropna()
    
    if len(df_clean) < window_size:
        print(f"ERROR: Not enough data points ({len(df_clean)}) for window size {window_size}")
        return []
    
    print(f"  Total observations: {len(df_clean)}")
    print(f"  Date range: {df_clean.index.min()} to {df_clean.index.max()}")
    
    timeseries_data = []
    
    # Iterate over rolling windows
    start_idx = 0
    window_count = 0
    
    while start_idx + window_size <= len(df_clean):
        end_idx = start_idx + window_size
        
        # Extract window data
        window_df = df_clean.iloc[start_idx:end_idx]
        window_date = window_df.index[-1]  # Use last date in window as timestamp
        
        X_window = window_df[feature_cols]
        y_window = window_df[target_col]
        
        # Train a small Random Forest on this window
        rf_window = RandomForestRegressor(
            n_estimators=100,
            max_depth=5,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        
        try:
            rf_window.fit(X_window, y_window)
            
            # Compute SHAP values for this window
            explainer = shap.TreeExplainer(rf_window)
            shap_values = explainer.shap_values(X_window)
            
            # Compute mean absolute SHAP for each feature
            feature_importance = {}
            for i, feature in enumerate(feature_cols):
                mean_abs_shap = float(np.mean(np.abs(shap_values[:, i])))
                feature_importance[feature] = mean_abs_shap
            
            # Store result
            timeseries_data.append({
                "timestamp": window_date.strftime('%Y-%m-%d'),
                "feature_importance": feature_importance
            })
            
            window_count += 1
            
            if window_count % 10 == 0:
                print(f"    Processed {window_count} windows...")
        
        except Exception as e:
            print(f"    Warning: Failed to compute SHAP for window ending {window_date}: {e}")
        
        # Move to next window
        start_idx += step_size
    
    print(f"  Completed: {len(timeseries_data)} time points generated")
    
    return timeseries_data


def add_feature_importance_timeseries_to_outputs(
    model_outputs_path: str,
    timeseries_data: list
) -> None:
    """
    Add feature_importance_timeseries field to model outputs JSON.
    
    Args:
        model_outputs_path: Path to model_outputs.json or model_b_outputs.json
        timeseries_data: List of time series data points
    """
    print(f"\nAdding feature_importance_timeseries to {model_outputs_path}...")
    
    # Read existing model outputs
    with open(model_outputs_path, 'r') as f:
        model_data = json.load(f)
    
    # Add feature_importance_timeseries field
    model_data['feature_importance_timeseries'] = timeseries_data
    
    # Write back to file
    with open(model_outputs_path, 'w') as f:
        json.dump(model_data, f, indent=2)
    
    print(f"  Added {len(timeseries_data)} time points to {model_outputs_path}")


def main():
    """
    Main function to compute feature importance time series for both models.
    """
    print("=" * 60)
    print("COMPUTING FEATURE IMPORTANCE TIME SERIES")
    print("=" * 60)
    
    # Define paths
    src_data_dir = Path(__file__).parent.parent / 'src' / 'data'
    cleaned_data_path = src_data_dir / 'cleaned_data.json'
    model_a_outputs_path = src_data_dir / 'model_outputs.json'
    model_b_outputs_path = src_data_dir / 'model_b_outputs.json'
    
    # Check if files exist
    if not cleaned_data_path.exists():
        print(f"ERROR: {cleaned_data_path} not found")
        return
    
    if not model_a_outputs_path.exists():
        print(f"ERROR: {model_a_outputs_path} not found")
        return
    
    if not model_b_outputs_path.exists():
        print(f"ERROR: {model_b_outputs_path} not found")
        return
    
    # Load cleaned data
    print(f"\nLoading cleaned data from {cleaned_data_path}...")
    with open(cleaned_data_path, 'r') as f:
        cleaned_data = json.load(f)
    
    df = pd.DataFrame(cleaned_data['data'])
    df['date'] = pd.to_datetime(df['date'])
    df = df.set_index('date')
    
    print(f"  Loaded {len(df)} observations")
    print(f"  Date range: {df.index.min()} to {df.index.max()}")
    
    # Define feature columns (7 global indices)
    feature_cols = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
    target_col = 'ISE_USD'
    
    # Verify all columns exist
    missing_cols = [col for col in feature_cols + [target_col] if col not in df.columns]
    if missing_cols:
        print(f"ERROR: Missing columns in cleaned_data.json: {missing_cols}")
        return
    
    print(f"\nFeatures: {feature_cols}")
    print(f"Target: {target_col}")
    
    # Compute rolling window SHAP time series
    print("\n" + "=" * 60)
    print("MODEL A: Computing Feature Importance Time Series")
    print("=" * 60)
    
    timeseries_data_a = compute_rolling_shap_timeseries(
        df=df,
        feature_cols=feature_cols,
        target_col=target_col,
        window_size=30,
        step_size=5
    )
    
    if timeseries_data_a:
        # Add to Model A outputs
        add_feature_importance_timeseries_to_outputs(
            model_outputs_path=str(model_a_outputs_path),
            timeseries_data=timeseries_data_a
        )
        
        # Print sample
        print("\n  Sample time points (first 3):")
        for i, point in enumerate(timeseries_data_a[:3]):
            print(f"    {i+1}. {point['timestamp']}")
            sorted_features = sorted(
                point['feature_importance'].items(),
                key=lambda x: x[1],
                reverse=True
            )
            for feature, importance in sorted_features[:3]:
                print(f"       {feature}: {importance:.6f}")
    
    # Compute for Model B (same process)
    print("\n" + "=" * 60)
    print("MODEL B: Computing Feature Importance Time Series")
    print("=" * 60)
    
    timeseries_data_b = compute_rolling_shap_timeseries(
        df=df,
        feature_cols=feature_cols,
        target_col=target_col,
        window_size=30,
        step_size=5
    )
    
    if timeseries_data_b:
        # Add to Model B outputs
        add_feature_importance_timeseries_to_outputs(
            model_outputs_path=str(model_b_outputs_path),
            timeseries_data=timeseries_data_b
        )
        
        # Print sample
        print("\n  Sample time points (first 3):")
        for i, point in enumerate(timeseries_data_b[:3]):
            print(f"    {i+1}. {point['timestamp']}")
            sorted_features = sorted(
                point['feature_importance'].items(),
                key=lambda x: x[1],
                reverse=True
            )
            for feature, importance in sorted_features[:3]:
                print(f"       {feature}: {importance:.6f}")
    
    print("\n" + "=" * 60)
    print("FEATURE IMPORTANCE TIME SERIES COMPUTATION COMPLETE")
    print("=" * 60)
    
    print("\nSummary:")
    print(f"  Model A: {len(timeseries_data_a)} time points added")
    print(f"  Model B: {len(timeseries_data_b)} time points added")
    print(f"\nAll 7 features included in each time point:")
    print(f"  {', '.join(feature_cols)}")


if __name__ == "__main__":
    main()
