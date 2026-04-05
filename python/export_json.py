"""
Pipeline orchestration script for Financial Fragility Clock.

This script runs preprocessing, feature engineering, and model training in sequence,
exporting all results to JSON files for dashboard consumption.

Usage:
    python export_json.py

Output:
    - src/data/cleaned_data.json
    - src/data/features.json
    - src/data/model_outputs.json
"""

import sys
import time
from datetime import datetime
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor

# Import modules
try:
    from preprocessing import (
        load_csv,
        handle_missing_values,
        compute_descriptive_stats,
        export_cleaned_data
    )
    from feature_engineering import (
        compute_rolling_correlation,
        compute_permutation_entropy,
        compute_rolling_volatility,
        label_minsky_regime,
        compute_fragility_score,
        export_features
    )
    from models import (
        train_ols,
        train_random_forest,
        compute_shap_values,
        compare_models,
        export_model_outputs
    )
except ImportError as e:
    print(f"ERROR: Failed to import required modules: {e}")
    print("Make sure you are running this script from the python/ directory")
    sys.exit(1)


def log_step(step_name: str, start_time: float = None) -> float:
    """
    Log a processing step with timestamp.
    
    Args:
        step_name: Name of the step
        start_time: Start time of previous step (for duration calculation)
        
    Returns:
        Current timestamp for next step
    """
    current_time = time.time()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if start_time is not None:
        duration = current_time - start_time
        print(f"\n[{timestamp}] ✓ {step_name} (completed in {duration:.2f}s)")
    else:
        print(f"\n[{timestamp}] → {step_name}")
    
    return current_time


def main():
    """
    Main pipeline orchestration function.
    
    Runs the complete ML pipeline from raw CSV to JSON outputs.
    """
    pipeline_start = time.time()
    
    print("=" * 80)
    print("FINANCIAL FRAGILITY CLOCK - ML PIPELINE")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    try:
        # ========================================================================
        # STEP 1: PREPROCESSING
        # ========================================================================
        step_start = log_step("STEP 1: Data Preprocessing")
        
        # Define file paths (relative to workspace root)
        csv_path = "context-dump/converted/Group_5.csv"
        cleaned_data_path = "src/data/cleaned_data.json"
        
        # Check if input file exists
        if not Path(csv_path).exists():
            raise FileNotFoundError(
                f"Input CSV file not found: {csv_path}\n"
                f"Expected location: context-dump/converted/Group_5.csv\n"
                f"Please ensure the CSV file is in the correct location."
            )
        
        # Load CSV
        print(f"\n  Loading CSV from: {csv_path}")
        df_raw = load_csv(csv_path)
        
        # Handle missing values
        print(f"\n  Handling missing values...")
        df_clean = handle_missing_values(df_raw, max_gap=3)
        
        # Compute descriptive statistics
        print(f"\n  Computing descriptive statistics...")
        stats = compute_descriptive_stats(df_clean)
        
        # Export cleaned data
        print(f"\n  Exporting cleaned data to: {cleaned_data_path}")
        export_cleaned_data(df_clean, stats, cleaned_data_path)
        
        step_start = log_step("Data Preprocessing", step_start)
        
        # ========================================================================
        # STEP 2: FEATURE ENGINEERING
        # ========================================================================
        step_start = log_step("STEP 2: Feature Engineering")
        
        features_path = "../src/data/features.json"
        
        # Compute rolling correlations
        print(f"\n  Computing rolling correlations (60-day window)...")
        corr_features = compute_rolling_correlation(df_clean, window=60)
        
        # Compute permutation entropy
        print(f"\n  Computing permutation entropy (30-day window)...")
        pe_series = compute_permutation_entropy(df_clean['ISE_USD'], m=3, delay=1, window=30)
        
        # Compute rolling volatility
        print(f"\n  Computing rolling volatility (30-day window)...")
        rolling_vol = compute_rolling_volatility(df_clean['ISE_USD'], window=30)
        
        # Label Minsky regimes
        print(f"\n  Labeling Minsky regimes...")
        regimes = label_minsky_regime(corr_features['mean_corr'], rolling_vol)
        
        # Compute fragility score (without RF error initially)
        print(f"\n  Computing fragility score...")
        fragility_score = compute_fragility_score(
            corr_features['mean_corr'],
            pe_series,
            rolling_vol,
            rf_error=None  # Will be updated after RF training
        )
        
        # Combine all features
        print(f"\n  Combining all features...")
        features_df = corr_features.copy()
        features_df['permutation_entropy'] = pe_series
        features_df['rolling_volatility'] = rolling_vol
        features_df['regime'] = regimes
        features_df['fragility_score'] = fragility_score
        
        # Export features
        print(f"\n  Exporting features to: {features_path}")
        export_features(features_df, features_path)
        
        step_start = log_step("Feature Engineering", step_start)
        
        # ========================================================================
        # STEP 3: MODEL TRAINING
        # ========================================================================
        step_start = log_step("STEP 3: Model Training")
        
        model_outputs_path = "../src/data/model_outputs.json"
        
        # Prepare data for modeling
        print(f"\n  Preparing data for modeling...")
        
        # OLS features: 7 global indices
        ols_feature_cols = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
        target_col = 'ISE_USD'
        
        # Remove rows with NaN values in features or target
        valid_mask = df_clean[ols_feature_cols + [target_col]].notna().all(axis=1)
        df_model = df_clean[valid_mask].copy()
        
        print(f"  Valid observations for modeling: {len(df_model)}")
        
        # 80/20 time-based train-test split (first 428 obs for training)
        train_size = int(len(df_model) * 0.8)
        
        X = df_model[ols_feature_cols]
        y = df_model[target_col]
        
        X_train = X.iloc[:train_size]
        y_train = y.iloc[:train_size]
        X_test = X.iloc[train_size:]
        y_test = y.iloc[train_size:]
        
        print(f"  Train: {len(X_train)} obs, Test: {len(X_test)} obs")
        
        # Get regime labels for test set
        regimes_test = features_df.loc[X_test.index, 'regime']
        
        # Train OLS model
        print(f"\n  Training OLS baseline model...")
        ols_results = train_ols(X_train, y_train, X_test, y_test, regimes_test)
        
        # Prepare Random Forest features (includes engineered features)
        print(f"\n  Preparing Random Forest features...")
        rf_feature_cols = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
        engineered_feature_cols = ['mean_corr', 'permutation_entropy', 'regime']
        
        # Create combined dataset
        df_rf = df_clean[[target_col] + rf_feature_cols].copy()
        
        # Add engineered features
        for col in engineered_feature_cols:
            if col in features_df.columns:
                df_rf[col] = features_df[col]
        
        # Encode regime as numeric (HEDGE=0, SPECULATIVE=1, PONZI=2)
        regime_encoding = {'HEDGE': 0, 'SPECULATIVE': 1, 'PONZI': 2}
        df_rf['regime_encoded'] = df_rf['regime'].map(regime_encoding)
        
        # Remove rows with NaN values
        rf_valid_mask = df_rf.notna().all(axis=1)
        df_rf_clean = df_rf[rf_valid_mask].copy()
        
        print(f"  Valid observations for Random Forest: {len(df_rf_clean)}")
        
        # Split into train/test (same time-based split)
        split_date = X_train.index.max()
        
        X_rf_train = df_rf_clean[df_rf_clean.index <= split_date][
            rf_feature_cols + ['mean_corr', 'permutation_entropy', 'regime_encoded']
        ]
        y_rf_train = df_rf_clean[df_rf_clean.index <= split_date][target_col]
        X_rf_test = df_rf_clean[df_rf_clean.index > split_date][
            rf_feature_cols + ['mean_corr', 'permutation_entropy', 'regime_encoded']
        ]
        y_rf_test = df_rf_clean[df_rf_clean.index > split_date][target_col]
        regimes_rf_test = df_rf_clean[df_rf_clean.index > split_date]['regime']
        
        print(f"  RF Train: {len(X_rf_train)} obs, RF Test: {len(X_rf_test)} obs")
        
        # Train Random Forest model
        print(f"\n  Training Random Forest model...")
        rf_results = train_random_forest(
            X_rf_train, y_rf_train, X_rf_test, y_rf_test, regimes_rf_test
        )
        
        # Train RF model again to get model object for SHAP
        print(f"\n  Training Random Forest for SHAP computation...")
        rf_model = RandomForestRegressor(
            n_estimators=500,
            max_depth=10,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1,
            verbose=0
        )
        rf_model.fit(X_rf_train, y_rf_train)
        
        # Compute SHAP values
        print(f"\n  Computing SHAP values...")
        shap_results = compute_shap_values(rf_model, X_rf_test, regimes_rf_test)
        
        # Compare models
        print(f"\n  Comparing model performance...")
        comparison_results = compare_models(ols_results, rf_results)
        
        # Export all model outputs
        print(f"\n  Exporting model outputs to: {model_outputs_path}")
        export_model_outputs(
            ols=ols_results,
            rf=rf_results,
            shap_results=shap_results,
            comparison=comparison_results,
            filepath=model_outputs_path
        )
        
        step_start = log_step("Model Training", step_start)
        
        # ========================================================================
        # PIPELINE COMPLETE
        # ========================================================================
        pipeline_duration = time.time() - pipeline_start
        
        print("\n" + "=" * 80)
        print("PIPELINE EXECUTION COMPLETE!")
        print("=" * 80)
        print(f"Total duration: {pipeline_duration:.2f}s ({pipeline_duration/60:.2f} minutes)")
        print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\nGenerated files:")
        print(f"  ✓ {cleaned_data_path}")
        print(f"  ✓ {features_path}")
        print(f"  ✓ {model_outputs_path}")
        print("\nNext steps:")
        print("  1. Review the generated JSON files")
        print("  2. Run the React dashboard: npm run dev")
        print("  3. Deploy to Vercel: vercel deploy")
        print("=" * 80)
        
        return 0
        
    except FileNotFoundError as e:
        print("\n" + "=" * 80)
        print("ERROR: File Not Found")
        print("=" * 80)
        print(str(e))
        print("\nTroubleshooting:")
        print("  1. Check that the CSV file exists at the expected location")
        print("  2. Verify you are running the script from the python/ directory")
        print("  3. Ensure all required directories exist")
        print("=" * 80)
        return 1
        
    except Exception as e:
        print("\n" + "=" * 80)
        print("ERROR: Pipeline Execution Failed")
        print("=" * 80)
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("\nTroubleshooting:")
        print("  1. Check that all required Python packages are installed")
        print("  2. Verify input data format matches expected schema")
        print("  3. Check console output above for detailed error messages")
        print("  4. Ensure sufficient memory is available")
        print("=" * 80)
        
        # Print full traceback for debugging
        import traceback
        print("\nFull traceback:")
        traceback.print_exc()
        
        return 1


if __name__ == "__main__":
    sys.exit(main())
