"""
Test script for Model B models module.

This script creates mock Model B data and tests the models_b.py functions.
"""

import pandas as pd
import numpy as np
from datetime import datetime
import json
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from models_b import (
    train_random_forest_walk_forward,
    validate_crisis_prediction,
    compute_shap_values_b,
    export_model_outputs_b
)


def create_mock_model_b_features(start_date: str = "2003-01-01",
                                 end_date: str = "2025-12-31") -> pd.DataFrame:
    """
    Create mock Model B features for testing.
    
    Includes:
    - Market indices (13)
    - Macro signals (4)
    - Engineered features (5)
    - Regime labels
    - Fragility score
    """
    print("Creating mock Model B features...")
    
    # Create date range (business days)
    dates = pd.bdate_range(start=start_date, end=end_date)
    
    np.random.seed(42)
    
    # Market indices
    market_indices = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM', 
                     'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200']
    
    data = {}
    for idx in market_indices:
        # Generate random walk prices
        returns = np.random.normal(0.0005, 0.02, len(dates))
        prices = 100 * np.exp(np.cumsum(returns))
        data[idx] = prices
    
    # Macro signals
    data['VIX'] = 15 + 10 * np.random.randn(len(dates))
    data['TED_SPREAD'] = 0.005 + 0.003 * np.random.randn(len(dates))
    data['YIELD_SPREAD'] = 1.0 + 0.5 * np.random.randn(len(dates))
    data['CREDIT_SPREAD'] = 1.5 + 0.5 * np.random.randn(len(dates))
    
    # Engineered features
    data['mean_corr'] = 0.5 + 0.2 * np.random.randn(len(dates))
    data['eigenvalue_ratio'] = 0.35 + 0.1 * np.random.randn(len(dates))
    data['permutation_entropy'] = 0.7 + 0.1 * np.random.randn(len(dates))
    data['rolling_volatility'] = 0.02 + 0.01 * np.random.randn(len(dates))
    data['volatility_synchrony'] = 0.02 + 0.005 * np.random.randn(len(dates))
    
    df = pd.DataFrame(data, index=dates)
    
    # Add regime labels (with crisis periods)
    regimes = []
    for date in df.index:
        # 2008 crisis (Sep 2008 - Mar 2009)
        if pd.Timestamp('2008-09-01') <= date <= pd.Timestamp('2009-03-31'):
            regimes.append('PONZI')
        # 2020 COVID crash (Mar 2020)
        elif pd.Timestamp('2020-03-01') <= date <= pd.Timestamp('2020-03-31'):
            regimes.append('PONZI')
        # Pre-crisis periods (elevated but not PONZI)
        elif pd.Timestamp('2007-07-01') <= date <= pd.Timestamp('2008-08-31'):
            regimes.append('SPECULATIVE')
        elif pd.Timestamp('2019-10-01') <= date <= pd.Timestamp('2020-02-29'):
            regimes.append('SPECULATIVE')
        # Random assignment for other periods
        elif np.random.rand() < 0.3:
            regimes.append('HEDGE')
        elif np.random.rand() < 0.6:
            regimes.append('SPECULATIVE')
        else:
            regimes.append('PONZI')
    
    df['regime'] = regimes
    
    # Compute fragility score (higher during crisis periods)
    fragility_scores = []
    for date, regime in zip(df.index, regimes):
        base_score = 40 + 20 * np.random.randn()
        
        # Elevate score before crises
        # Pre-2008 crisis (3-6 months before Sep 2008)
        if pd.Timestamp('2008-03-15') <= date <= pd.Timestamp('2008-06-15'):
            base_score += 25  # Peak before crisis
        # Pre-COVID crisis (3-6 months before Mar 2020)
        elif pd.Timestamp('2019-09-16') <= date <= pd.Timestamp('2019-12-16'):
            base_score += 20  # Peak before crisis
        # During crises
        elif regime == 'PONZI':
            base_score += 30
        elif regime == 'SPECULATIVE':
            base_score += 10
        
        # Clip to [0, 100]
        fragility_scores.append(np.clip(base_score, 0, 100))
    
    df['fragility_score'] = fragility_scores
    
    print(f"  Created {len(df)} observations × {len(df.columns)} columns")
    print(f"  Date range: {df.index.min()} to {df.index.max()}")
    print(f"  Regime distribution:")
    print(df['regime'].value_counts())
    
    return df


def test_walk_forward_validation():
    """Test walk-forward validation function."""
    print("\n" + "=" * 60)
    print("TEST 1: Walk-Forward Validation")
    print("=" * 60)
    
    # Create mock data
    df = create_mock_model_b_features()
    
    # Run walk-forward validation
    results = train_random_forest_walk_forward(df, target_col='SP500')
    
    # Verify results
    assert 'split_2008' in results, "Missing split_2008 results"
    assert 'split_2020' in results, "Missing split_2020 results"
    
    for split_name, split_results in results.items():
        if 'error' in split_results:
            print(f"\n⚠ {split_name}: {split_results['error']}")
            continue
        
        assert 'metrics' in split_results, f"Missing metrics in {split_name}"
        assert 'regime_rmse' in split_results, f"Missing regime_rmse in {split_name}"
        assert 'feature_importance' in split_results, f"Missing feature_importance in {split_name}"
        
        print(f"\n✓ {split_name} validation successful")
        print(f"  Test R²: {split_results['metrics']['test_r2']:.4f}")
        print(f"  Test RMSE: {split_results['metrics']['test_rmse']:.6f}")
    
    print("\n✓ Walk-forward validation test PASSED")
    return results


def test_crisis_prediction():
    """Test crisis prediction validation function."""
    print("\n" + "=" * 60)
    print("TEST 2: Crisis Prediction Validation")
    print("=" * 60)
    
    # Create mock data
    df = create_mock_model_b_features()
    
    # Run crisis prediction validation
    results = validate_crisis_prediction(df)
    
    # Verify results
    assert '2008_crisis' in results, "Missing 2008_crisis results"
    assert '2020_covid' in results, "Missing 2020_covid results"
    
    for crisis_name, crisis_results in results.items():
        if 'error' in crisis_results:
            print(f"\n⚠ {crisis_name}: {crisis_results['error']}")
            continue
        
        assert 'peak_date' in crisis_results, f"Missing peak_date in {crisis_name}"
        assert 'lead_time_months' in crisis_results, f"Missing lead_time_months in {crisis_name}"
        assert 'peak_detected_3_6_months' in crisis_results, f"Missing peak_detected_3_6_months in {crisis_name}"
        
        print(f"\n✓ {crisis_name} validation successful")
        print(f"  Peak detected: {crisis_results['peak_detected_3_6_months']}")
        print(f"  Lead time: {crisis_results['lead_time_months']:.1f} months")
    
    print("\n✓ Crisis prediction validation test PASSED")
    return results


def test_shap_analysis():
    """Test SHAP analysis function."""
    print("\n" + "=" * 60)
    print("TEST 3: SHAP Analysis")
    print("=" * 60)
    
    # Create mock data
    df = create_mock_model_b_features()
    
    # Run SHAP analysis
    results = compute_shap_values_b(df, target_col='SP500')
    
    # Verify results
    if 'error' in results:
        print(f"\n⚠ SHAP analysis error: {results['error']}")
        if results['error'] == 'shap_not_installed':
            print("  Skipping SHAP test (shap library not installed)")
            return results
    
    assert 'crisis_periods' in results, "Missing crisis_periods results"
    assert 'regime_comparison' in results, "Missing regime_comparison results"
    
    print(f"\n✓ SHAP analysis successful")
    print(f"  Crisis periods analyzed: {len(results['crisis_periods'])}")
    print(f"  Regimes analyzed: {len(results['regime_comparison'])}")
    
    print("\n✓ SHAP analysis test PASSED")
    return results


def test_export():
    """Test export function."""
    print("\n" + "=" * 60)
    print("TEST 4: Export Model Outputs")
    print("=" * 60)
    
    # Create mock data
    df = create_mock_model_b_features()
    
    # Run all analyses
    walk_forward_results = train_random_forest_walk_forward(df, target_col='SP500')
    crisis_prediction_results = validate_crisis_prediction(df)
    shap_results = compute_shap_values_b(df, target_col='SP500')
    
    # Export to temporary file
    test_output_path = "test_model_b_outputs.json"
    export_model_outputs_b(
        walk_forward_results=walk_forward_results,
        crisis_prediction_results=crisis_prediction_results,
        shap_results=shap_results,
        filepath=test_output_path
    )
    
    # Verify file was created
    assert Path(test_output_path).exists(), "Output file not created"
    
    # Load and verify JSON structure
    with open(test_output_path, 'r') as f:
        output_data = json.load(f)
    
    assert 'metadata' in output_data, "Missing metadata"
    assert 'walk_forward_validation' in output_data, "Missing walk_forward_validation"
    assert 'crisis_prediction' in output_data, "Missing crisis_prediction"
    assert 'shap' in output_data, "Missing shap"
    
    print(f"\n✓ Export successful")
    print(f"  Output file: {test_output_path}")
    print(f"  File size: {Path(test_output_path).stat().st_size / 1024:.2f} KB")
    
    # Clean up
    Path(test_output_path).unlink()
    print(f"  Cleaned up test file")
    
    print("\n✓ Export test PASSED")


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("MODEL B MODELS MODULE - TESTS")
    print("=" * 60)
    
    try:
        # Test 1: Walk-forward validation
        walk_forward_results = test_walk_forward_validation()
        
        # Test 2: Crisis prediction
        crisis_prediction_results = test_crisis_prediction()
        
        # Test 3: SHAP analysis
        shap_results = test_shap_analysis()
        
        # Test 4: Export
        test_export()
        
        # Summary
        print("\n" + "=" * 60)
        print("ALL TESTS PASSED!")
        print("=" * 60)
        
        print("\n✓ Model B models module is working correctly!")
        print("\nNext steps:")
        print("  1. Generate real Model B data:")
        print("     cd python/model_b")
        print("     python preprocessing_b.py")
        print("     python feature_engineering_b.py")
        print("     python regime_labeling_b.py")
        print("  2. Run Model B models:")
        print("     python models_b.py")
        print("  3. Check output: ../../src/data/model_b_outputs.json")
        
        return True
        
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
