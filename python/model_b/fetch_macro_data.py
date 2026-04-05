"""
Model B Macro Data Fetcher using FRED API.

This module fetches daily/monthly macro economic indicators from FRED
and resamples them to daily frequency.
"""

from fredapi import Fred
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
import warnings
import os


def fetch_macro_data(api_key: str = None,
                    start_date: str = "2003-01-01", 
                    end_date: str = "2025-12-31") -> pd.DataFrame:
    """
    Fetch macro economic indicators from FRED API.
    
    Indicators:
    - VIXCLS: CBOE Volatility Index (daily)
    - T10Y2Y: 10-Year Treasury Constant Maturity Minus 2-Year (daily)
    - TEDRATE: TED Spread (daily)
    - FEDFUNDS: Federal Funds Effective Rate (monthly)
    - BAA10Y: Moody's Seasoned Baa Corporate Bond Yield Relative to 10-Year Treasury (daily)
    
    Args:
        api_key: FRED API key (if None, reads from FRED_API_KEY environment variable)
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        
    Returns:
        DataFrame with datetime index and 5 macro indicator columns (daily frequency)
        
    Raises:
        ValueError: If API key is not provided or data fetching fails
    """
    # Get API key
    if api_key is None:
        api_key = os.environ.get('FRED_API_KEY')
    
    if api_key is None:
        raise ValueError(
            "FRED API key not provided. Either pass api_key parameter or set FRED_API_KEY environment variable.\n"
            "Get a free API key at: https://fred.stlouisfed.org/docs/api/api_key.html"
        )
    
    # Initialize FRED client
    try:
        fred = Fred(api_key=api_key)
    except Exception as e:
        raise ValueError(f"Failed to initialize FRED client: {str(e)}")
    
    # Define series IDs and their display names
    series = {
        'VIXCLS': 'VIX',
        'T10Y2Y': 'YIELD_SPREAD',
        'TEDRATE': 'TED_SPREAD',
        'FEDFUNDS': 'FED_FUNDS',
        'BAA10Y': 'CREDIT_SPREAD'
    }
    
    print(f"Fetching macro data from FRED API")
    print(f"Date range: {start_date} to {end_date}")
    print(f"Series: {len(series)}")
    
    # Fetch data for all series
    all_data = {}
    failed_series = []
    
    for series_id, name in series.items():
        try:
            print(f"  Fetching {name} ({series_id})...", end=" ")
            
            # Fetch data with rate limiting consideration
            data = fred.get_series(
                series_id,
                observation_start=start_date,
                observation_end=end_date
            )
            
            if data.empty:
                print(f"FAILED (no data)")
                failed_series.append((series_id, name))
                continue
            
            # Store with display name
            all_data[name] = data
            
            # Determine frequency
            freq = "daily" if len(data) > 1000 else "monthly"
            print(f"OK ({len(data)} observations, {freq})")
            
        except Exception as e:
            print(f"FAILED ({str(e)})")
            failed_series.append((series_id, name))
    
    if not all_data:
        raise ValueError("Failed to fetch any macro data from FRED")
    
    # Combine all data into single DataFrame
    df = pd.DataFrame(all_data)
    
    # Report on failed series
    if failed_series:
        print(f"\nWarning: Failed to fetch data for {len(failed_series)} series:")
        for series_id, name in failed_series:
            print(f"  - {name} ({series_id})")
    
    print(f"\nRaw data shape: {df.shape}")
    print(f"Date range: {df.index.min()} to {df.index.max()}")
    print(f"Missing values per column:")
    for col in df.columns:
        missing = df[col].isna().sum()
        pct = 100 * missing / len(df)
        print(f"  {col}: {missing} ({pct:.1f}%)")
    
    return df


def resample_to_daily(df: pd.DataFrame) -> pd.DataFrame:
    """
    Resample all series to daily frequency using forward-fill.
    
    Monthly series (like FEDFUNDS) are forward-filled to daily values.
    This assumes that monthly values remain constant until the next update.
    
    Args:
        df: DataFrame with potentially mixed frequencies
        
    Returns:
        DataFrame resampled to daily frequency
    """
    print("\nResampling to daily frequency...")
    
    # Create a complete daily date range
    date_range = pd.date_range(
        start=df.index.min(),
        end=df.index.max(),
        freq='D'
    )
    
    # Reindex to daily frequency
    df_daily = df.reindex(date_range)
    
    # Forward-fill to propagate values
    df_daily = df_daily.ffill()
    
    print(f"  Resampled shape: {df_daily.shape}")
    print(f"  Date range: {df_daily.index.min()} to {df_daily.index.max()}")
    print(f"  Missing values after forward-fill:")
    for col in df_daily.columns:
        missing = df_daily[col].isna().sum()
        pct = 100 * missing / len(df_daily)
        print(f"    {col}: {missing} ({pct:.1f}%)")
    
    return df_daily


def handle_missing_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Handle remaining missing values gracefully.
    
    Strategy:
    1. Forward-fill any remaining gaps
    2. Backward-fill for leading NaN values
    3. If still NaN, use column median as last resort
    
    Args:
        df: DataFrame with potential missing values
        
    Returns:
        DataFrame with missing values handled
    """
    df_clean = df.copy()
    
    print("\nHandling missing data...")
    
    # Forward-fill
    df_clean = df_clean.ffill()
    
    # Backward-fill for leading NaN
    df_clean = df_clean.bfill()
    
    # Check for remaining NaN
    remaining_nan = df_clean.isna().sum()
    
    if remaining_nan.sum() > 0:
        print("  Remaining NaN values after forward/backward fill:")
        for col in df_clean.columns:
            if remaining_nan[col] > 0:
                print(f"    {col}: {remaining_nan[col]} - filling with median")
                # Fill with median as last resort
                df_clean[col] = df_clean[col].fillna(df_clean[col].median())
    
    # Final check
    final_nan = df_clean.isna().sum().sum()
    if final_nan > 0:
        print(f"  Warning: {final_nan} NaN values remain after all filling strategies")
        # Drop rows with any remaining NaN
        df_clean = df_clean.dropna()
        print(f"  Dropped rows with NaN. New shape: {df_clean.shape}")
    else:
        print("  All missing values handled successfully")
    
    return df_clean


def validate_data(df: pd.DataFrame) -> bool:
    """
    Validate macro data completeness and quality.
    
    Args:
        df: DataFrame to validate
        
    Returns:
        True if validation passes, False otherwise
    """
    print("\nValidating macro data...")
    
    issues = []
    
    # Check for NaN values
    nan_count = df.isna().sum().sum()
    if nan_count > 0:
        issues.append(f"Found {nan_count} NaN values")
    
    # Check for infinite values
    inf_count = np.isinf(df.select_dtypes(include=[np.number])).sum().sum()
    if inf_count > 0:
        issues.append(f"Found {inf_count} infinite values")
    
    # Check date range
    expected_years = 22  # 2003-2025
    actual_years = (df.index.max() - df.index.min()).days / 365.25
    if actual_years < expected_years * 0.8:  # Allow 20% tolerance
        issues.append(f"Date range too short: {actual_years:.1f} years (expected ~{expected_years})")
    
    # Check minimum observations
    min_obs = 7000  # Roughly 22 years * 365 days (daily data)
    if len(df) < min_obs * 0.8:  # Allow 20% tolerance
        issues.append(f"Too few observations: {len(df)} (expected >{min_obs * 0.8:.0f})")
    
    # Check for reasonable value ranges
    if 'VIX' in df.columns:
        vix_max = df['VIX'].max()
        if vix_max > 100:
            issues.append(f"VIX values seem unreasonable (max: {vix_max})")
    
    # Report validation results
    if issues:
        print("  Validation FAILED:")
        for issue in issues:
            print(f"    - {issue}")
        return False
    else:
        print("  Validation PASSED")
        print(f"    Observations: {len(df)}")
        print(f"    Date range: {df.index.min()} to {df.index.max()}")
        print(f"    Years: {actual_years:.1f}")
        print(f"    Columns: {len(df.columns)}")
        return True


if __name__ == "__main__":
    print("Model B Macro Data Fetcher")
    print("=" * 60)
    
    # Check for API key
    api_key = os.environ.get('FRED_API_KEY')
    if not api_key:
        print("\nERROR: FRED_API_KEY environment variable not set")
        print("Get a free API key at: https://fred.stlouisfed.org/docs/api/api_key.html")
        print("Then set it with: export FRED_API_KEY='your_key_here'")
        exit(1)
    
    # Fetch macro data
    df = fetch_macro_data(api_key=api_key, start_date="2003-01-01", end_date="2025-12-31")
    
    # Resample to daily frequency
    df_daily = resample_to_daily(df)
    
    # Handle missing data
    df_clean = handle_missing_data(df_daily)
    
    # Validate data
    is_valid = validate_data(df_clean)
    
    if is_valid:
        print("\nMacro data fetching complete!")
        print(f"Final dataset: {df_clean.shape[0]} observations × {df_clean.shape[1]} indicators")
    else:
        print("\nWarning: Data validation failed. Review issues above.")
