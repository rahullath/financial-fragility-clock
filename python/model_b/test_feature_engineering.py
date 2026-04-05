"""
Test script for Model B feature engineering module.

This script tests the feature engineering functions with mock data.
"""

import pandas as pd
import numpy as np
from datetime import datetime
import sys
import os
import json

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from feature_engineering_b import (
    compute_rolling_correlation,
    compute_permutation_entropy,
    compute_rolling_volatility,
    normalize_macro_signals,
    compute_fragility_score_b,
    export_features
)


def create_mock_data(start_date: str = "2020-01-01", 
                    end_date: str = "2023-12-31") -> pd.DataFrame:
    """Create mock data for testing feature engineering."""
    print("Creating mock data for feature engineering test...")
    
    # Create date range (business days only)
    dates = pd.bdate_range(start=start_date, end=end_date)
    
    # Create random price data
    np.random.seed(42)
    data = {}
    
    # 13 market indices
    indices = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM', 
               'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200', 'VIX']
    
    for idx in indices:
        # Generate random walk prices with some correlation
        returns = np.random.normal(0.0005, 0.02, len(dates))
        # Add common factor to create correlation
        common_factor = np.random.normal(0, 0.01, len(dates))
        returns = returns + 0.5 * common_factor
        prices = 100 * np.exp(np.cumsum(returns))
        data[idx] = prices
    
    # Add macro indicators
    data['YIELD_SPREAD'] = 1.0 + 0.5 * np.random.randn(len(dates))
    data['TED_SPREAD'] = 0.5 + 0.3 * np.random.randn(len(dates))
    data['FED_FUNDS'] = 2.0 + 1.0 * np.random.randn(len(dates))
    data['CREDIT_SPREAD'] = 1.5 + 0.5 * np.random.randn(len(dates))
    
    df = pd.DataFrame(data, index=dates)
    
    print(f"  Created {len(df)} observations × {len(df.columns)} columns")
    print(f"  Date range: {df.index.min()} to {df.index.max()}")
    
    return df


def test_rolling_correlation():
    """Test rolling correlation computation."""
    print("\n" + "=" * 60)
    print("TEST 1: Rolling Correlation Computation")
    print("=" * 60)
    
    df = create_mock_data()
    
    # Compute rolling correlations
    corr_features = compute_rolling_correlation(df, window=60)
    
    # Assertions
    assert 'mean_corr' in corr_features.columns, "Missing mean_corr column"
    assert 'eigenvalue_ratio' in corr_features.columns, "Missing eigenvalue_ratio column"
    assert 'volatility_synchrony' in corr_features.columns, "Missing volatility_synchrony column"
    
    # Check that values are in expected ranges
    valid_mean_corr = corr_features['mean_corr'].dropna()
    assert (valid_mean_corr >= 0).all() and (valid_mean_corr <= 1).all(), "mean_corr out of range"
    
    valid_eigenvalue_ratio = corr_features['eigenvalue_ratio'].dropna()
    assert (valid_eigenvalue_ratio >= 0).all() and (valid_eigenvalue_ratio <= 1).all(), "eigenvalue_ratio out of range"
    
    print("\n✓ Rolling correlation test PASSED")
    return corr_features


def test_permutation_entropy():
    """Test permutation entropy computation."""
    print("\n" + "=" * 60)
    print("TEST 2: Permutation Entropy Computation")
    print("=" * 60)
    
    df = create_mock_data()
    
    # Compute permutation entropy
    pe_series = compute_permutation_entropy(df['SP500'], m=3, delay=1, window=30)
    
    # Assertions
    assert len(pe_series) == len(df), "Length mismatch"
    
    valid_pe = pe_series.dropna()
    assert (valid_pe >= 0).all() and (valid_pe <= 1).all(), "PE values out of range"
    
    print("\n✓ Permutation entropy test PASSED")
    return pe_series


def test_rolling_volatility():
    """Test rolling volatility computation."""
    print("\n" + "=" * 60)
    print("TEST 3: Rolling Volatility Computation")
    print("=" * 60)
    
    df = create_mock_data()
    
    # Compute rolling volatility
    rolling_vol = compute_rolling_volatility(df['SP500'], window=30)
    
    # Assertions
    assert len(rolling_vol) == len(df), "Length mismatch"
    
    valid_vol = rolling_vol.dropna()
    assert (valid_vol >= 0).all(), "Volatility should be non-negative"
    
    print("\n✓ Rolling volatility test PASSED")
    return rolling_vol


def test_normalize_macro_signals():
    """Test macro signal normalization."""
    print("\n" + "=" * 60)
    print("TEST 4: Macro Signal Normalization")
    print("=" * 60)
    
    df = create_mock_data()
    
    # Normalize macro signals
    macro_normalized = normalize_macro_signals(df)
    
    # Assertions
    assert 'VIX_norm' in macro_normalized.columns, "Missing VIX_norm column"
    assert 'TED_SPREAD_norm' in macro_normalized.columns, "Missing TED_SPREAD_norm column"
    assert 'YIELD_SPREAD_norm' in macro_normalized.columns, "Missing YIELD_SPREAD_norm column"
    
    # Check that normalized values are in [0, 1] range
    for col in macro_normalized.columns:
        valid_values = macro_normalized[col].dropna()
        if len(valid_values) > 0:
            assert (valid_values >= 0).all() and (valid_values <= 1).all(), f"{col} out of [0,1] range"
    
    print("\n✓ Macro signal normalization test PASSED")
    return macro_normalized


def test_fragility_score():
    """Test Model B fragility score computation."""
    print("\n" + "=" * 60)
    print("TEST 5: Model B Fragility Score Computation")
    print("=" * 60)
    
    df = create_mock_data()
    
    # Compute all required features
    corr_features = compute_rolling_correlation(df, window=60)
    pe_series = compute_permutation_entropy(df['SP500'], m=3, delay=1, window=30)
    rolling_vol = compute_rolling_volatility(df['SP500'], window=30)
    macro_normalized = normalize_macro_signals(df)
    
    # Compute fragility score
    fragility_score = compute_fragility_score_b(
        corr_features['mean_corr'],
        pe_series,
        rolling_vol,
        corr_features['eigenvalue_ratio'],
        vix_norm=macro_normalized.get('VIX_norm'),
        ted_norm=macro_normalized.get('TED_SPREAD_norm'),
        yield_spread_norm=macro_normalized.get('YIELD_SPREAD_norm')
    )
    
    # Assertions
    assert len(fragility_score) == len(df), "Length mismatch"
    
    valid_scores = fragility_score.dropna()
    assert len(valid_scores) > 0, "No valid fragility scores computed"
    assert (valid_scores >= 0).all() and (valid_scores <= 100).all(), "Fragility score out of [0,100] range"
    
    print(f"\n  Valid scores: {len(valid_scores)}/{len(fragility_score)}")
    print(f"  Score range: [{valid_scores.min():.2f}, {valid_scores.max():.2f}]")
    print(f"  Mean score: {valid_scores.mean():.2f}")
    
    print("\n✓ Fragility score test PASSED")
    return fragility_score


def test_export_features():
    """Test feature export to JSON."""
    print("\n" + "=" * 60)
    print("TEST 6: Feature Export to JSON")
    print("=" * 60)
    
    df = create_mock_data()
    
    # Compute all features
    corr_features = compute_rolling_correlation(df, window=60)
    pe_series = compute_permutation_entropy(df['SP500'], m=3, delay=1, window=30)
    rolling_vol = compute_rolling_volatility(df['SP500'], window=30)
    macro_normalized = normalize_macro_signals(df)
    fragility_score = compute_fragility_score_b(
        corr_features['mean_corr'],
        pe_series,
        rolling_vol,
        corr_features['eigenvalue_ratio'],
        vix_norm=macro_normalized.get('VIX_norm'),
        ted_norm=macro_normalized.get('TED_SPREAD_norm'),
        yield_spread_norm=macro_normalized.get('YIELD_SPREAD_norm')
    )
    
    # Combine all features
    features_df = corr_features.copy()
    features_df['permutation_entropy'] = pe_series
    features_df['rolling_volatility'] = rolling_vol
    features_df['fragility_score'] = fragility_score
    
    for col in macro_normalized.columns:
        features_df[col] = macro_normalized[col]
    
    # Export to JSON
    output_path = "/tmp/test_model_b_features.json"
    export_features(features_df, output_path)
    
    # Verify JSON file was created and is valid
    assert os.path.exists(output_path), "JSON file not created"
    
    with open(output_path, 'r') as f:
        data = json.load(f)
    
    assert 'metadata' in data, "Missing metadata in JSON"
    assert 'data' in data, "Missing data in JSON"
    assert data['metadata']['model'] == 'Model B', "Incorrect model identifier"
    assert len(data['data']) == len(features_df), "Data length mismatch"
    
    print(f"\n  JSON file created: {output_path}")
    print(f"  File size: {os.path.getsize(output_path) / 1024:.2f} KB")
    
    print("\n✓ Feature export test PASSED")
    
    # Clean up
    os.remove(output_path)
    
    return True


def run_all_tests():
    """Run all feature engineering tests."""
    print("=" * 60)
    print("MODEL B FEATURE ENGINEERING - UNIT TESTS")
    print("=" * 60)
    
    try:
        # Test 1: Rolling correlation
        corr_features = test_rolling_correlation()
        
        # Test 2: Permutation entropy
        pe_series = test_permutation_entropy()
        
        # Test 3: Rolling volatility
        rolling_vol = test_rolling_volatility()
        
        # Test 4: Macro signal normalization
        macro_normalized = test_normalize_macro_signals()
        
        # Test 5: Fragility score
        fragility_score = test_fragility_score()
        
        # Test 6: Export features
        test_export_features()
        
        # Summary
        print("\n" + "=" * 60)
        print("ALL TESTS PASSED!")
        print("=" * 60)
        print("\n✓ Model B feature engineering module is working correctly!")
        print("\nNext steps:")
        print("  1. Ensure Model B cleaned data exists: src/data/model_b_cleaned_data.json")
        print("  2. Run: python feature_engineering_b.py")
        print("  3. Check output: src/data/model_b_features.json")
        
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
