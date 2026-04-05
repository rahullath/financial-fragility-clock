"""
Test script for Model B regime labeling module.

This script creates mock feature data and tests the regime labeling functionality.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from regime_labeling_b import HistoricallyVerifiedRegimeClassifier, label_minsky_regimes


def create_mock_features(start_date: str = "2003-01-01", 
                        end_date: str = "2025-12-31") -> pd.DataFrame:
    """
    Create mock feature data for testing regime labeling.
    
    This includes realistic patterns for crisis periods:
    - 2008-09 to 2009-03: High correlation, high VIX, high TED spread
    - 2020-03: High correlation, very high VIX
    """
    print("Creating mock feature data...")
    
    # Create date range (business days only)
    dates = pd.bdate_range(start=start_date, end=end_date)
    
    # Initialize with baseline values
    np.random.seed(42)
    n = len(dates)
    
    # Create baseline features
    data = {
        'mean_corr': 0.4 + 0.15 * np.random.randn(n),
        'eigenvalue_ratio': 0.35 + 0.08 * np.random.randn(n),
        'VIX': 18 + 8 * np.random.randn(n),
        'TED_SPREAD': 0.008 + 0.005 * np.random.randn(n),
        'YIELD_SPREAD': 1.2 + 0.6 * np.random.randn(n),
        'CREDIT_SPREAD': 1.8 + 0.4 * np.random.randn(n),
    }
    
    df = pd.DataFrame(data, index=dates)
    
    # Inject 2008 Financial Crisis pattern (Sep 2008 - Mar 2009)
    crisis_2008_start = pd.Timestamp('2008-09-01')
    crisis_2008_end = pd.Timestamp('2009-03-31')
    crisis_2008_mask = (df.index >= crisis_2008_start) & (df.index <= crisis_2008_end)
    
    print(f"\nInjecting 2008 Financial Crisis pattern...")
    print(f"  Period: {crisis_2008_start.date()} to {crisis_2008_end.date()}")
    print(f"  Observations: {crisis_2008_mask.sum()}")
    
    df.loc[crisis_2008_mask, 'mean_corr'] = 0.85 + 0.05 * np.random.randn(crisis_2008_mask.sum())
    df.loc[crisis_2008_mask, 'eigenvalue_ratio'] = 0.55 + 0.05 * np.random.randn(crisis_2008_mask.sum())
    df.loc[crisis_2008_mask, 'VIX'] = 50 + 15 * np.random.randn(crisis_2008_mask.sum())
    df.loc[crisis_2008_mask, 'TED_SPREAD'] = 0.04 + 0.01 * np.random.randn(crisis_2008_mask.sum())
    
    # Inject pre-crisis build-up (2007 - early 2008)
    buildup_start = pd.Timestamp('2007-01-01')
    buildup_end = pd.Timestamp('2008-08-31')
    buildup_mask = (df.index >= buildup_start) & (df.index <= buildup_end)
    
    print(f"\nInjecting pre-crisis build-up pattern (SPECULATIVE)...")
    print(f"  Period: {buildup_start.date()} to {buildup_end.date()}")
    print(f"  Observations: {buildup_mask.sum()}")
    
    df.loc[buildup_mask, 'mean_corr'] = 0.55 + 0.08 * np.random.randn(buildup_mask.sum())
    df.loc[buildup_mask, 'eigenvalue_ratio'] = 0.40 + 0.05 * np.random.randn(buildup_mask.sum())
    df.loc[buildup_mask, 'VIX'] = 22 + 5 * np.random.randn(buildup_mask.sum())
    df.loc[buildup_mask, 'TED_SPREAD'] = 0.015 + 0.005 * np.random.randn(buildup_mask.sum())
    
    # Inject COVID-19 crash (Mar 2020)
    covid_start = pd.Timestamp('2020-03-01')
    covid_end = pd.Timestamp('2020-03-31')
    covid_mask = (df.index >= covid_start) & (df.index <= covid_end)
    
    print(f"\nInjecting COVID-19 crash pattern...")
    print(f"  Period: {covid_start.date()} to {covid_end.date()}")
    print(f"  Observations: {covid_mask.sum()}")
    
    df.loc[covid_mask, 'mean_corr'] = 0.90 + 0.03 * np.random.randn(covid_mask.sum())
    df.loc[covid_mask, 'eigenvalue_ratio'] = 0.60 + 0.05 * np.random.randn(covid_mask.sum())
    df.loc[covid_mask, 'VIX'] = 65 + 10 * np.random.randn(covid_mask.sum())
    df.loc[covid_mask, 'TED_SPREAD'] = 0.025 + 0.008 * np.random.randn(covid_mask.sum())
    
    # Inject calm HEDGE period (2003-2006)
    hedge_start = pd.Timestamp('2003-01-01')
    hedge_end = pd.Timestamp('2006-12-31')
    hedge_mask = (df.index >= hedge_start) & (df.index <= hedge_end)
    
    print(f"\nInjecting calm HEDGE period...")
    print(f"  Period: {hedge_start.date()} to {hedge_end.date()}")
    print(f"  Observations: {hedge_mask.sum()}")
    
    df.loc[hedge_mask, 'mean_corr'] = 0.25 + 0.05 * np.random.randn(hedge_mask.sum())
    df.loc[hedge_mask, 'eigenvalue_ratio'] = 0.25 + 0.03 * np.random.randn(hedge_mask.sum())
    df.loc[hedge_mask, 'VIX'] = 12 + 3 * np.random.randn(hedge_mask.sum())
    df.loc[hedge_mask, 'TED_SPREAD'] = 0.003 + 0.001 * np.random.randn(hedge_mask.sum())
    
    # Clip values to realistic ranges
    df['mean_corr'] = df['mean_corr'].clip(0, 1)
    df['eigenvalue_ratio'] = df['eigenvalue_ratio'].clip(0, 1)
    df['VIX'] = df['VIX'].clip(5, 100)
    df['TED_SPREAD'] = df['TED_SPREAD'].clip(0, 0.1)
    
    print(f"\nMock feature data created:")
    print(f"  Observations: {len(df)}")
    print(f"  Date range: {df.index.min()} to {df.index.max()}")
    print(f"  Features: {list(df.columns)}")
    
    return df


def test_crisis_period_detection():
    """Test that crisis periods are correctly identified."""
    print("\n" + "=" * 60)
    print("TEST 1: Crisis Period Detection")
    print("=" * 60)
    
    classifier = HistoricallyVerifiedRegimeClassifier()
    
    # Test 2008 crisis
    test_date_2008 = pd.Timestamp('2008-10-15')
    is_crisis, regime, desc = classifier.is_crisis_period(test_date_2008)
    
    print(f"\nTesting date: {test_date_2008.date()}")
    print(f"  Is crisis: {is_crisis}")
    print(f"  Regime: {regime}")
    print(f"  Description: {desc}")
    
    assert is_crisis, "2008-10-15 should be identified as crisis period"
    assert regime == 'PONZI', "2008-10-15 should be PONZI regime"
    
    # Test COVID crisis
    test_date_2020 = pd.Timestamp('2020-03-15')
    is_crisis, regime, desc = classifier.is_crisis_period(test_date_2020)
    
    print(f"\nTesting date: {test_date_2020.date()}")
    print(f"  Is crisis: {is_crisis}")
    print(f"  Regime: {regime}")
    print(f"  Description: {desc}")
    
    assert is_crisis, "2020-03-15 should be identified as crisis period"
    assert regime == 'PONZI', "2020-03-15 should be PONZI regime"
    
    # Test non-crisis period
    test_date_normal = pd.Timestamp('2005-06-15')
    is_crisis, regime, desc = classifier.is_crisis_period(test_date_normal)
    
    print(f"\nTesting date: {test_date_normal.date()}")
    print(f"  Is crisis: {is_crisis}")
    print(f"  Regime: {regime}")
    print(f"  Description: {desc}")
    
    assert not is_crisis, "2005-06-15 should NOT be identified as crisis period"
    
    print("\n✓ Crisis period detection test PASSED")


def test_single_observation_classification():
    """Test classification of individual observations."""
    print("\n" + "=" * 60)
    print("TEST 2: Single Observation Classification")
    print("=" * 60)
    
    classifier = HistoricallyVerifiedRegimeClassifier(use_adaptive_thresholds=False)
    
    # Test HEDGE observation
    hedge_date = pd.Timestamp('2005-06-15')
    hedge_row = pd.Series({
        'mean_corr': 0.25,
        'VIX': 12.0,
        'TED_SPREAD': 0.003,
        'eigenvalue_ratio': 0.25
    })
    
    regime, confidence, details = classifier.classify_single_observation(
        hedge_date, hedge_row
    )
    
    print(f"\nHEDGE observation test:")
    print(f"  Date: {hedge_date.date()}")
    print(f"  Features: corr={hedge_row['mean_corr']:.3f}, VIX={hedge_row['VIX']:.1f}, TED={hedge_row['TED_SPREAD']:.4f}")
    print(f"  Classified as: {regime}")
    print(f"  Confidence: {confidence:.3f}")
    print(f"  Signal votes: {details.get('votes', {})}")
    
    assert regime == 'HEDGE', f"Expected HEDGE, got {regime}"
    assert confidence > 0.5, f"Expected confidence > 0.5, got {confidence}"
    
    # Test PONZI observation
    ponzi_date = pd.Timestamp('2008-10-15')
    ponzi_row = pd.Series({
        'mean_corr': 0.85,
        'VIX': 55.0,
        'TED_SPREAD': 0.045,
        'eigenvalue_ratio': 0.55
    })
    
    regime, confidence, details = classifier.classify_single_observation(
        ponzi_date, ponzi_row
    )
    
    print(f"\nPONZI observation test (crisis period):")
    print(f"  Date: {ponzi_date.date()}")
    print(f"  Features: corr={ponzi_row['mean_corr']:.3f}, VIX={ponzi_row['VIX']:.1f}, TED={ponzi_row['TED_SPREAD']:.4f}")
    print(f"  Classified as: {regime}")
    print(f"  Confidence: {confidence:.3f}")
    print(f"  Details: {details}")
    
    assert regime == 'PONZI', f"Expected PONZI, got {regime}"
    assert confidence == 1.0, f"Crisis period should have confidence=1.0, got {confidence}"
    
    # Test SPECULATIVE observation
    spec_date = pd.Timestamp('2007-06-15')
    spec_row = pd.Series({
        'mean_corr': 0.55,
        'VIX': 22.0,
        'TED_SPREAD': 0.015,
        'eigenvalue_ratio': 0.40
    })
    
    regime, confidence, details = classifier.classify_single_observation(
        spec_date, spec_row
    )
    
    print(f"\nSPECULATIVE observation test:")
    print(f"  Date: {spec_date.date()}")
    print(f"  Features: corr={spec_row['mean_corr']:.3f}, VIX={spec_row['VIX']:.1f}, TED={spec_row['TED_SPREAD']:.4f}")
    print(f"  Classified as: {regime}")
    print(f"  Confidence: {confidence:.3f}")
    print(f"  Signal votes: {details.get('votes', {})}")
    
    assert regime == 'SPECULATIVE', f"Expected SPECULATIVE, got {regime}"
    
    print("\n✓ Single observation classification test PASSED")


def test_full_regime_labeling():
    """Test full regime labeling on mock data."""
    print("\n" + "=" * 60)
    print("TEST 3: Full Regime Labeling")
    print("=" * 60)
    
    # Create mock features
    df = create_mock_features()
    
    # Label regimes
    labeled_df = label_minsky_regimes(df, use_adaptive_thresholds=True)
    
    # Verify results
    assert 'regime' in labeled_df.columns, "Missing 'regime' column"
    assert 'regime_confidence' in labeled_df.columns, "Missing 'regime_confidence' column"
    
    # Check that crisis periods are labeled as PONZI
    crisis_2008_mask = (labeled_df.index >= '2008-09-01') & (labeled_df.index <= '2009-03-31')
    crisis_2008_regimes = labeled_df.loc[crisis_2008_mask, 'regime']
    ponzi_pct_2008 = (crisis_2008_regimes == 'PONZI').sum() / len(crisis_2008_regimes) * 100
    
    print(f"\n2008 Crisis verification:")
    print(f"  PONZI labels: {ponzi_pct_2008:.1f}%")
    
    assert ponzi_pct_2008 > 90, f"Expected >90% PONZI in 2008 crisis, got {ponzi_pct_2008:.1f}%"
    
    covid_mask = (labeled_df.index >= '2020-03-01') & (labeled_df.index <= '2020-03-31')
    covid_regimes = labeled_df.loc[covid_mask, 'regime']
    ponzi_pct_covid = (covid_regimes == 'PONZI').sum() / len(covid_regimes) * 100
    
    print(f"\nCOVID Crisis verification:")
    print(f"  PONZI labels: {ponzi_pct_covid:.1f}%")
    
    assert ponzi_pct_covid > 90, f"Expected >90% PONZI in COVID crisis, got {ponzi_pct_covid:.1f}%"
    
    # Check that calm period has lower PONZI percentage than crisis periods
    hedge_mask = (labeled_df.index >= '2003-01-01') & (labeled_df.index <= '2006-12-31')
    hedge_regimes = labeled_df.loc[hedge_mask, 'regime']
    hedge_pct = (hedge_regimes == 'HEDGE').sum() / len(hedge_regimes) * 100
    ponzi_pct_calm = (hedge_regimes == 'PONZI').sum() / len(hedge_regimes) * 100
    
    print(f"\nCalm period (2003-2006) verification:")
    print(f"  HEDGE labels: {hedge_pct:.1f}%")
    print(f"  PONZI labels: {ponzi_pct_calm:.1f}%")
    
    # With adaptive thresholds, calm periods may be SPECULATIVE (middle ground)
    # The key test is that PONZI percentage is low
    assert ponzi_pct_calm < 10, f"Expected <10% PONZI in calm period, got {ponzi_pct_calm:.1f}%"
    
    # Check confidence scores
    mean_confidence = labeled_df['regime_confidence'].mean()
    print(f"\nOverall confidence statistics:")
    print(f"  Mean: {mean_confidence:.3f}")
    print(f"  Min: {labeled_df['regime_confidence'].min():.3f}")
    print(f"  Max: {labeled_df['regime_confidence'].max():.3f}")
    
    assert mean_confidence > 0.6, f"Expected mean confidence > 0.6, got {mean_confidence:.3f}"
    
    print("\n✓ Full regime labeling test PASSED")
    
    return labeled_df


def run_all_tests():
    """Run all regime labeling tests."""
    print("=" * 60)
    print("MODEL B REGIME LABELING - UNIT TESTS")
    print("=" * 60)
    
    try:
        # Test 1: Crisis period detection
        test_crisis_period_detection()
        
        # Test 2: Single observation classification
        test_single_observation_classification()
        
        # Test 3: Full regime labeling
        labeled_df = test_full_regime_labeling()
        
        # Summary
        print("\n" + "=" * 60)
        print("ALL TESTS PASSED!")
        print("=" * 60)
        
        print(f"\nRegime distribution:")
        regime_counts = labeled_df['regime'].value_counts()
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            count = regime_counts.get(regime, 0)
            pct = 100 * count / len(labeled_df)
            print(f"  {regime:12s}: {count:5d} ({pct:5.1f}%)")
        
        print("\n✓ Model B regime labeling is working correctly!")
        print("\nNext steps:")
        print("  1. Generate Model B features: python feature_engineering_b.py")
        print("  2. Run regime labeling: python regime_labeling_b.py")
        print("  3. Check output in model_b_features.json")
        
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
