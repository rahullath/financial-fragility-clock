"""
Integration test for Model B data fetching infrastructure.

This script tests the complete pipeline without actually fetching data
(to avoid API rate limits and long execution times during testing).
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch_market_data import handle_missing_data as handle_market_missing, validate_data as validate_market
from fetch_macro_data import resample_to_daily, handle_missing_data as handle_macro_missing, validate_data as validate_macro
from preprocessing_b import merge_market_and_macro, handle_missing_values, validate_data_completeness, compute_descriptive_stats


def create_mock_market_data(start_date: str = "2003-01-01", 
                            end_date: str = "2025-12-31",
                            num_indices: int = 13) -> pd.DataFrame:
    """Create mock market data for testing."""
    print("Creating mock market data...")
    
    # Create date range (business days only)
    dates = pd.bdate_range(start=start_date, end=end_date)
    
    # Create random price data
    np.random.seed(42)
    data = {}
    
    indices = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM', 
               'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200', 'VIX']
    
    for idx in indices[:num_indices]:
        # Generate random walk prices
        returns = np.random.normal(0.0005, 0.02, len(dates))
        prices = 100 * np.exp(np.cumsum(returns))
        data[idx] = prices
    
    df = pd.DataFrame(data, index=dates)
    
    # Introduce some missing values
    for col in df.columns:
        missing_indices = np.random.choice(df.index, size=10, replace=False)
        df.loc[missing_indices, col] = np.nan
    
    print(f"  Created {len(df)} observations × {len(df.columns)} indices")
    print(f"  Date range: {df.index.min()} to {df.index.max()}")
    
    return df


def create_mock_macro_data(start_date: str = "2003-01-01",
                           end_date: str = "2025-12-31") -> pd.DataFrame:
    """Create mock macro data for testing."""
    print("Creating mock macro data...")
    
    # Create date range (all days)
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    
    # Create random macro data
    np.random.seed(43)
    data = {
        'VIX': 15 + 10 * np.random.randn(len(dates)),
        'YIELD_SPREAD': 1.0 + 0.5 * np.random.randn(len(dates)),
        'TED_SPREAD': 0.5 + 0.3 * np.random.randn(len(dates)),
        'FED_FUNDS': 2.0 + 1.0 * np.random.randn(len(dates)),
        'CREDIT_SPREAD': 1.5 + 0.5 * np.random.randn(len(dates))
    }
    
    df = pd.DataFrame(data, index=dates)
    
    # Introduce some missing values
    for col in df.columns:
        missing_indices = np.random.choice(df.index, size=20, replace=False)
        df.loc[missing_indices, col] = np.nan
    
    print(f"  Created {len(df)} observations × {len(df.columns)} indicators")
    print(f"  Date range: {df.index.min()} to {df.index.max()}")
    
    return df


def test_market_data_handling():
    """Test market data handling functions."""
    print("\n" + "=" * 60)
    print("TEST 1: Market Data Handling")
    print("=" * 60)
    
    # Create mock data
    df = create_mock_market_data()
    
    # Test missing value handling
    print("\nTesting missing value handling...")
    df_clean = handle_market_missing(df, max_gap=5)
    
    # Test validation
    print("\nTesting validation...")
    is_valid = validate_market(df_clean)
    
    assert is_valid, "Market data validation failed"
    assert df_clean.isna().sum().sum() == 0, "Missing values remain after handling"
    
    print("\n✓ Market data handling test PASSED")
    return df_clean


def test_macro_data_handling():
    """Test macro data handling functions."""
    print("\n" + "=" * 60)
    print("TEST 2: Macro Data Handling")
    print("=" * 60)
    
    # Create mock data
    df = create_mock_macro_data()
    
    # Test resampling (already daily, so should be no-op)
    print("\nTesting resampling to daily...")
    df_daily = resample_to_daily(df)
    
    # Test missing value handling
    print("\nTesting missing value handling...")
    df_clean = handle_macro_missing(df_daily)
    
    # Test validation
    print("\nTesting validation...")
    is_valid = validate_macro(df_clean)
    
    assert is_valid, "Macro data validation failed"
    assert df_clean.isna().sum().sum() == 0, "Missing values remain after handling"
    
    print("\n✓ Macro data handling test PASSED")
    return df_clean


def test_data_merging():
    """Test data merging and preprocessing."""
    print("\n" + "=" * 60)
    print("TEST 3: Data Merging and Preprocessing")
    print("=" * 60)
    
    # Create mock data
    market_df = create_mock_market_data()
    macro_df = create_mock_macro_data()
    
    # Clean data
    market_df = handle_market_missing(market_df, max_gap=5)
    macro_df = handle_macro_missing(macro_df)
    
    # Test merging
    print("\nTesting data merging...")
    merged_df = merge_market_and_macro(market_df, macro_df)
    
    assert len(merged_df) > 0, "Merged data is empty"
    assert len(merged_df.columns) == len(market_df.columns) + len(macro_df.columns), "Column count mismatch"
    
    # Test missing value handling
    print("\nTesting missing value handling on merged data...")
    clean_df = handle_missing_values(merged_df, max_gap=5)
    
    # Test validation
    print("\nTesting data completeness validation...")
    is_valid = validate_data_completeness(clean_df)
    
    assert is_valid, "Data completeness validation failed"
    assert clean_df.isna().sum().sum() == 0, "Missing values remain after handling"
    
    # Test statistics computation
    print("\nTesting descriptive statistics computation...")
    stats = compute_descriptive_stats(clean_df)
    
    assert len(stats) == len(clean_df.columns), "Statistics count mismatch"
    for col, col_stats in stats.items():
        assert 'mean' in col_stats, f"Missing 'mean' in stats for {col}"
        assert 'std' in col_stats, f"Missing 'std' in stats for {col}"
        assert 'min' in col_stats, f"Missing 'min' in stats for {col}"
        assert 'max' in col_stats, f"Missing 'max' in stats for {col}"
    
    print("\n✓ Data merging and preprocessing test PASSED")
    return clean_df, stats


def run_all_tests():
    """Run all integration tests."""
    print("=" * 60)
    print("MODEL B DATA FETCHING INFRASTRUCTURE - INTEGRATION TESTS")
    print("=" * 60)
    
    try:
        # Test 1: Market data handling
        market_df = test_market_data_handling()
        
        # Test 2: Macro data handling
        macro_df = test_macro_data_handling()
        
        # Test 3: Data merging and preprocessing
        clean_df, stats = test_data_merging()
        
        # Summary
        print("\n" + "=" * 60)
        print("ALL TESTS PASSED!")
        print("=" * 60)
        print(f"\nFinal dataset summary:")
        print(f"  Observations: {len(clean_df)}")
        print(f"  Columns: {len(clean_df.columns)}")
        print(f"  Date range: {clean_df.index.min()} to {clean_df.index.max()}")
        print(f"  Market indices: {len([c for c in clean_df.columns if c not in ['VIX', 'YIELD_SPREAD', 'TED_SPREAD', 'FED_FUNDS', 'CREDIT_SPREAD']])}")
        print(f"  Macro indicators: {len([c for c in clean_df.columns if c in ['VIX', 'YIELD_SPREAD', 'TED_SPREAD', 'FED_FUNDS', 'CREDIT_SPREAD']])}")
        print(f"  Statistics computed: {len(stats)} columns")
        
        print("\n✓ Model B data fetching infrastructure is working correctly!")
        print("\nNext steps:")
        print("  1. Set FRED_API_KEY environment variable")
        print("  2. Run: python preprocessing_b.py")
        print("  3. Check output: ../../src/data/model_b_cleaned_data.json")
        
        return True
        
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {str(e)}")
        return False
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
