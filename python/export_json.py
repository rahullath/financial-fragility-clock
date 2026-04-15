"""
Pipeline orchestration script for Financial Fragility Clock.

Classification engine (v2)
--------------------------
This version runs a forward-looking crash-probability classification pipeline
instead of a return-regression pipeline.

Pipeline steps
--------------
1. Preprocessing         — load & clean CSV, export cleaned_data.json
2. Feature Engineering   — rolling correlation, permutation entropy, volatility,
                           heuristic fragility score (unsupervised baseline)
3. Crash Target          — binary label: ISE_USD drop > 5% in next 30 days
4. Model Training        — Logistic Regression (bad) + RF Classifier (good)
                           → fragility_score = predict_proba[:, 1] * 100
5. Regime Derivation     — probability thresholds replace heuristic labels
6. SHAP                  — explains crash probability (not return magnitude)
7. Export                — features.json, model_outputs.json

Usage:
    cd python/ && python export_json.py

Output:
    - src/data/cleaned_data.json
    - src/data/features.json   (fragility_score + fragility_score_heuristic)
    - src/data/model_outputs.json  (classification metrics, ROC-AUC, SHAP)
"""

import sys
import time
import subprocess
from datetime import datetime
from pathlib import Path
import pandas as pd
import numpy as np

# Import modules
try:
    from preprocessing import (
        load_csv,
        handle_missing_values,
        compute_descriptive_stats,
        export_cleaned_data,
    )
    from feature_engineering import (
        compute_rolling_correlation,
        compute_permutation_entropy,
        compute_rolling_volatility,
        compute_heuristic_fragility_score,
        label_regime_from_probability,
        export_features,
    )
    from target_engineering import create_crash_target
    from models import (
        train_logistic_regression,
        train_random_forest_classifier,
        compute_shap_classifier,
        compare_classification_models,
        export_model_outputs_classification,
    )
except ImportError as e:
    print(f"ERROR: Failed to import required modules: {e}")
    print("Make sure you are running this script from the python/ directory")
    sys.exit(1)


def log_step(step_name: str, start_time: float = None) -> float:
    current_time = time.time()
    timestamp    = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if start_time is not None:
        duration = current_time - start_time
        print(f"\n[{timestamp}] ✓ {step_name} (completed in {duration:.2f}s)")
    else:
        print(f"\n[{timestamp}] → {step_name}")
    return current_time


def main():
    pipeline_start = time.time()

    print("=" * 80)
    print("FINANCIAL FRAGILITY CLOCK — CLASSIFICATION PIPELINE (v2)")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    try:
        # ====================================================================
        # STEP 1: PREPROCESSING
        # ====================================================================
        step_start = log_step("STEP 1: Data Preprocessing")

        csv_path          = "../context-dump/converted/Group_5.csv"
        cleaned_data_path = "../src/data/cleaned_data.json"

        if not Path(csv_path).exists():
            raise FileNotFoundError(
                f"Input CSV not found: {csv_path}\n"
                f"Expected: context-dump/converted/Group_5.csv"
            )

        print(f"\n  Loading CSV from: {csv_path}")
        df_raw = load_csv(csv_path)

        print(f"\n  Handling missing values...")
        df_clean = handle_missing_values(df_raw, max_gap=3)

        print(f"\n  Computing descriptive statistics...")
        stats = compute_descriptive_stats(df_clean)

        print(f"\n  Exporting cleaned data to: {cleaned_data_path}")
        export_cleaned_data(df_clean, stats, cleaned_data_path)

        step_start = log_step("Data Preprocessing", step_start)

        # ====================================================================
        # STEP 2: FEATURE ENGINEERING
        # ====================================================================
        step_start = log_step("STEP 2: Feature Engineering")

        # 2a. Rolling correlations (60-day window)
        print(f"\n  Computing rolling correlations (60-day window)...")
        corr_features = compute_rolling_correlation(df_clean, window=60)

        # 2b. Permutation entropy (30-day window)
        print(f"\n  Computing permutation entropy (30-day window)...")
        pe_series = compute_permutation_entropy(df_clean['ISE_USD'], m=3, delay=1, window=30)

        # 2c. Rolling volatility (30-day window)
        print(f"\n  Computing rolling volatility (30-day window)...")
        rolling_vol = compute_rolling_volatility(df_clean['ISE_USD'], window=30)

        # 2d. Heuristic fragility score — UNSUPERVISED BASELINE (kept for comparison)
        print(f"\n  Computing heuristic fragility score (unsupervised baseline)...")
        heuristic_score = compute_heuristic_fragility_score(
            corr_features['mean_corr'],
            pe_series,
            rolling_vol,
            rf_error=None,
        )

        # Build features DataFrame (regime & ML fragility_score filled in Step 4)
        print(f"\n  Assembling features DataFrame...")
        features_df = corr_features.copy()
        features_df['permutation_entropy']       = pe_series
        features_df['rolling_volatility']        = rolling_vol
        features_df['fragility_score_heuristic'] = heuristic_score
        # Placeholders — overwritten after model training
        features_df['fragility_score']           = np.nan
        features_df['regime']                    = None

        step_start = log_step("Feature Engineering", step_start)

        # ====================================================================
        # STEP 3: CRASH TARGET CREATION
        # ====================================================================
        step_start = log_step("STEP 3: Crash Target Engineering")

        crash_target = create_crash_target(
            df_clean,
            col='ISE_USD',
            horizon=30,
            threshold=-0.10,
        )

        # Store class‑balance stats for model_outputs.json
        valid_target = crash_target.dropna()
        n_crash  = int(valid_target.sum())
        n_normal = int((valid_target == 0).sum())
        crash_target_stats = {
            'col':        'ISE_USD',
            'horizon':    30,
            'threshold':  -0.05,
            'n_total':    len(valid_target),
            'n_crash':    n_crash,
            'n_normal':   n_normal,
            'crash_pct':  float(100.0 * n_crash / len(valid_target)) if len(valid_target) else 0.0,
        }
        print(f"\n  Crash target stats: {crash_target_stats}")

        step_start = log_step("Crash Target Engineering", step_start)

        # ====================================================================
        # STEP 4: MODEL TRAINING (CLASSIFICATION)
        # ====================================================================
        step_start = log_step("STEP 4: Classification Model Training")

        model_outputs_path = "../src/data/model_outputs.json"
        features_path      = "../src/data/features.json"

        # --- Assemble X (feature matrix) ------------------------------------
        rf_feature_cols = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
        lr_feature_cols = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
        # RF gets the engineered features; LR uses only raw market indices
        rf_all_cols = rf_feature_cols + ['mean_corr', 'permutation_entropy']

        df_model = df_clean[['ISE_USD'] + rf_feature_cols].copy()
        df_model['crash_target']         = crash_target
        df_model['mean_corr']            = features_df['mean_corr']
        df_model['permutation_entropy']  = features_df['permutation_entropy']
        df_model['rolling_volatility']   = features_df['rolling_volatility']

        # Drop rows with NaN in required model columns or in the crash target
        required_cols = rf_all_cols + ['crash_target']
        df_model_clean = df_model.dropna(subset=required_cols)
        # Coerce all numeric columns
        for col in rf_all_cols:
            df_model_clean = df_model_clean.copy()
            df_model_clean[col] = pd.to_numeric(df_model_clean[col], errors='coerce')
        df_model_clean = df_model_clean.dropna(subset=required_cols)

        print(f"\n  Valid observations for modeling: {len(df_model_clean)}")

        # 80/20 temporal split
        train_size = int(len(df_model_clean) * 0.8)
        split_date = df_model_clean.index[train_size - 1]

        X_rf    = df_model_clean[rf_all_cols]
        X_lr    = df_model_clean[lr_feature_cols]
        y_crash = df_model_clean['crash_target'].astype(int)

        X_rf_train = X_rf.iloc[:train_size];    X_rf_test  = X_rf.iloc[train_size:]
        X_lr_train = X_lr.iloc[:train_size];    X_lr_test  = X_lr.iloc[train_size:]
        y_train    = y_crash.iloc[:train_size]; y_test     = y_crash.iloc[train_size:]

        print(f"  Split date: {split_date.date()}")
        print(f"  Train: {len(X_rf_train)} obs | Test: {len(X_rf_test)} obs")
        print(f"  Crash rate — train: {y_train.mean():.2%} | test: {y_test.mean():.2%}")

        # --- Logistic Regression (linear bad baseline) ----------------------
        print(f"\n  Training Logistic Regression (linear baseline)...")
        lr_results = train_logistic_regression(
            X_lr_train, y_train, X_lr_test, y_test,
            regimes_test=None,  # regimes not yet available; set after RF
        )

        # --- Random Forest Classifier (good model) --------------------------
        print(f"\n  Training Random Forest Classifier (good model)...")
        rf_results = train_random_forest_classifier(
            X_rf_train, y_train, X_rf_test, y_test,
            regimes_test=None,  # regimes derived after
        )

        # --- Derive fragility_score and regime from RF probabilities ---------
        #
        # Generate probabilities for ALL valid observations (train + test)
        # so the dashboard has a complete time series.  Training-set points
        # are in-sample and will be flagged, but are visually useful.
        rf_classifier = rf_results['model']
        all_probas    = rf_classifier.predict_proba(X_rf)[:, 1]
        fragility_all = pd.Series(all_probas * 100.0, index=df_model_clean.index)

        # Map to regime labels using probability thresholds
        regime_all = label_regime_from_probability(fragility_all)

        # Backfill features_df with ML-derived values
        features_df.loc[fragility_all.index, 'fragility_score'] = fragility_all
        features_df.loc[regime_all.index,    'regime']          = regime_all.astype(str)

        # --- Re-run regiment metrics using probability-derived regime --------
        regimes_test_labels = regime_all.loc[X_rf_test.index] if X_rf_test.index.isin(regime_all.index).all() else None

        # --- SHAP on RF Classifier ------------------------------------------
        print(f"\n  Computing SHAP values for crash classifier...")
        shap_results = compute_shap_classifier(
            rf_classifier,
            X_rf_test,
            regimes_test=regimes_test_labels,
        )

        # --- Compare models --------------------------------------------------
        print(f"\n  Comparing models...")
        comparison = compare_classification_models(lr_results, rf_results)

        step_start = log_step("Classification Model Training", step_start)

        # ====================================================================
        # STEP 5: EXPORT
        # ====================================================================
        step_start = log_step("STEP 5: Exporting outputs")

        # --- Export features.json -------------------------------------------
        print(f"\n  Exporting features to: {features_path}")
        export_features(features_df, df_clean, features_path)

        # --- Export model_outputs.json (classification) ---------------------
        print(f"\n  Exporting model outputs to: {model_outputs_path}")
        export_model_outputs_classification(
            lr_results=lr_results,
            rf_results=rf_results,
            shap_results=shap_results,
            comparison=comparison,
            crash_target_stats=crash_target_stats,
            filepath=model_outputs_path,
        )

        step_start = log_step("Export", step_start)

        # ====================================================================
        # STEP 6: ADDITIONAL BACKEND SCRIPTS
        # ====================================================================
        step_start = log_step("STEP 6: Additional Backend Scripts")

        def _run_script(name, timeout=600):
            print(f"\n  Running {name}...")
            try:
                result = subprocess.run(
                    [sys.executable, name],
                    cwd=Path(__file__).parent,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
                if result.returncode == 0:
                    print(f"  ✓ {name} completed")
                else:
                    print(f"  ⚠ {name} failed (code {result.returncode})")
                    print(f"  {result.stderr[:500]}")
            except FileNotFoundError:
                print(f"  ⚠ {name} not found — skipping")
            except subprocess.TimeoutExpired:
                print(f"  ⚠ {name} timed out")
            except Exception as exc:
                print(f"  ⚠ {name} error: {exc}")

        _run_script("train_extended_models.py", timeout=600)
        _run_script("compute_lead_time.py",     timeout=300)
        _run_script("compute_dtw_similarity.py", timeout=300)
        _run_script("compute_regime_transitions.py", timeout=300)

        step_start = log_step("Additional Backend Scripts", step_start)

        # ====================================================================
        # PIPELINE COMPLETE
        # ====================================================================
        total = time.time() - pipeline_start
        print("\n" + "=" * 80)
        print("PIPELINE EXECUTION COMPLETE!")
        print("=" * 80)
        print(f"Total duration: {total:.2f}s ({total/60:.2f} minutes)")
        print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\nGenerated files:")
        print(f"  ✓ {cleaned_data_path}")
        print(f"  ✓ {features_path}")
        print(f"  ✓ {model_outputs_path}")
        print("\nAdditional files (if scripts succeeded):")
        print(f"  • ../src/data/ml_models_extended.json")
        print(f"  • ../src/data/lead_time_stats.json")
        print(f"  • ../src/data/dtw_similarity.json")
        print(f"  • ../src/data/regime_transitions.json")
        print(f"\nKey metrics:")
        print(f"  RF Classifier ROC-AUC : {rf_results['metrics'].get('roc_auc', 'N/A')}")
        print(f"  LR Baseline ROC-AUC   : {lr_results['metrics'].get('roc_auc', 'N/A')}")
        print("=" * 80)

        return 0

    except FileNotFoundError as e:
        print("\n" + "=" * 80)
        print("ERROR: File Not Found")
        print("=" * 80)
        print(str(e))
        return 1

    except Exception as e:
        print("\n" + "=" * 80)
        print("ERROR: Pipeline Execution Failed")
        print("=" * 80)
        print(f"Type: {type(e).__name__}")
        print(f"Message: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
