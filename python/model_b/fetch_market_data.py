"""
Model B Market Data Fetcher using yfinance.

This module fetches daily market data for 13 global indices from 2003-2025
using the yfinance library.
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
import warnings


def fetch_market_data(start_date: str = "2003-01-01", 
                     end_date: str = "2025-12-31") -> pd.DataFrame:
    """
    Fetch daily market data for 13 global indices using yfinance.
    
    Indices:
    - ^GSPC: S&P 500 (US)
    - ^GDAXI: DAX (Germany)
    - ^FTSE: FTSE 100 (UK)
    - ^N225: Nikkei 225 (Japan)
    - ^BVSP: Bovespa (Brazil)
    - EZU: MSCI Eurozone ETF (proxy for EU)
    - EEM: MSCI Emerging Markets ETF (proxy for EM)
    - XU100.IS: BIST 100 (Turkey/Istanbul)
    - 000001.SS: SSE Composite (Shanghai)
    - ^HSI: Hang Seng (Hong Kong)
    - ^KS11: KOSPI (South Korea)
    - ^AXJO: ASX 200 (Australia)
    - ^VIX: CBOE Volatility Index
    
    Args:
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        
    Returns:
        DataFrame with datetime index and 13 columns (adjusted close prices)
        
    Raises:
        ValueError: If data fetching fails or insufficient data is retrieved
    """
    # Define ticker symbols and their display names
    tickers = {
        '^GSPC': 'SP500',
        '^GDAXI': 'DAX',
        '^FTSE': 'FTSE',
        '^N225': 'NIKKEI',
        '^BVSP': 'BOVESPA',
        'EZU': 'EU',
        'EEM': 'EM',
        'XU100.IS': 'BIST100',
        '000001.SS': 'SHANGHAI',
        '^HSI': 'HANGSENG',
        '^KS11': 'KOSPI',
        '^AXJO': 'ASX200',
        '^VIX': 'VIX'
    }
    
    print(f"Fetching market data from {start_date} to {end_date}")
    print(f"Tickers: {len(tickers)}")
    
    # Fetch data for all tickers
    all_series = {}
    failed_tickers = []

    for ticker, name in tickers.items():
        try:
            print(f"  Fetching {name} ({ticker})...", end=" ")

            # Download data
            data = yf.download(
                ticker,
                start=start_date,
                end=end_date,
                progress=False,
                auto_adjust=True  # Use adjusted close prices
            )

            if data.empty:
                print("FAILED (no data)")
                failed_tickers.append((ticker, name))
                continue

            # yfinance ≥ 0.2 returns MultiIndex columns: (price_type, ticker_symbol)
            # Flatten to a plain Series of Close prices
            if isinstance(data.columns, pd.MultiIndex):
                # Grab the 'Close' level and squeeze to Series
                close = data["Close"]
                if isinstance(close, pd.DataFrame):
                    # Multi-ticker download: pick the one matching our ticker
                    if ticker in close.columns:
                        close = close[ticker]
                    else:
                        close = close.iloc[:, 0]
                prices = close.squeeze()
            else:
                prices = data["Close"]

            # Ensure it's a 1-D Series with a DatetimeIndex
            prices = pd.Series(prices.values, index=prices.index, name=name)

            all_series[name] = prices
            print(f"OK ({len(prices)} observations)")

        except Exception as e:
            print(f"FAILED ({str(e)})")
            failed_tickers.append((ticker, name))

    if not all_series:
        raise ValueError("Failed to fetch any market data")

    # Combine using concat so all date indices are aligned properly
    df = pd.concat(all_series, axis=1)
    
    # Report on failed tickers
    if failed_tickers:
        print(f"\nWarning: Failed to fetch data for {len(failed_tickers)} tickers:")
        for ticker, name in failed_tickers:
            print(f"  - {name} ({ticker})")
    
    # Align data to common date range (forward-fill for missing dates)
    print(f"\nAligning data to common date range...")
    print(f"  Raw data shape: {df.shape}")
    print(f"  Date range: {df.index.min()} to {df.index.max()}")
    print(f"  Missing values per column:")
    for col in df.columns:
        missing = df[col].isna().sum()
        pct = 100 * missing / len(df)
        print(f"    {col}: {missing} ({pct:.1f}%)")
    
    return df


def handle_missing_data(df: pd.DataFrame, max_gap: int = 5) -> pd.DataFrame:
    """
    Handle missing values using forward-fill for gaps <= max_gap days.
    
    Args:
        df: DataFrame with potential missing values
        max_gap: Maximum consecutive days to forward-fill
        
    Returns:
        DataFrame with missing values handled
    """
    df_clean = df.copy()
    excluded_ranges = []
    
    # Check each column for missing values
    for col in df_clean.columns:
        if df_clean[col].isna().any():
            # Find consecutive NaN groups
            is_nan = df_clean[col].isna()
            nan_groups = (is_nan != is_nan.shift()).cumsum()
            
            for group_id in nan_groups[is_nan].unique():
                group_mask = (nan_groups == group_id) & is_nan
                gap_size = group_mask.sum()
                
                if gap_size > max_gap:
                    # Flag this range
                    start_date = df_clean.index[group_mask][0]
                    end_date = df_clean.index[group_mask][-1]
                    excluded_ranges.append((col, start_date, end_date, gap_size))
                    warnings.warn(
                        f"Large gap in {col} from {start_date} to {end_date} "
                        f"({gap_size} days > {max_gap} days threshold)"
                    )
    
    # Apply forward-fill for all gaps (including large ones)
    # For Model B, we use forward-fill even for larger gaps to maintain data continuity
    df_clean = df_clean.ffill()
    
    # If there are still NaN values at the start, use backward-fill
    df_clean = df_clean.bfill()
    
    # Report on data quality
    remaining_nan = df_clean.isna().sum().sum()
    if remaining_nan > 0:
        print(f"\nWarning: {remaining_nan} NaN values remain after forward/backward fill")
        print("These will be dropped:")
        for col in df_clean.columns:
            nan_count = df_clean[col].isna().sum()
            if nan_count > 0:
                print(f"  {col}: {nan_count} NaN values")
        
        # Drop rows with any remaining NaN
        df_clean = df_clean.dropna()
    
    if excluded_ranges:
        print(f"\nLarge gaps detected (>{max_gap} days):")
        for col, start, end, gap in excluded_ranges:
            print(f"  {col}: {start} to {end} ({gap} days) - forward-filled")
    
    print(f"\nFinal data shape: {df_clean.shape}")
    print(f"Date range: {df_clean.index.min()} to {df_clean.index.max()}")
    
    return df_clean


def validate_data(df: pd.DataFrame) -> bool:
    """
    Validate data completeness and quality.
    
    Args:
        df: DataFrame to validate
        
    Returns:
        True if validation passes, False otherwise
    """
    print("\nValidating data...")
    
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
    min_obs = 5000  # Roughly 22 years * 252 trading days
    if len(df) < min_obs * 0.8:  # Allow 20% tolerance
        issues.append(f"Too few observations: {len(df)} (expected >{min_obs * 0.8:.0f})")
    
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
    print("Model B Market Data Fetcher")
    print("=" * 60)
    
    # Fetch market data
    df = fetch_market_data(start_date="2003-01-01", end_date="2025-12-31")
    
    # Handle missing data
    df_clean = handle_missing_data(df, max_gap=5)
    
    # Validate data
    is_valid = validate_data(df_clean)
    
    if is_valid:
        print("\nMarket data fetching complete!")
        print(f"Final dataset: {df_clean.shape[0]} observations × {df_clean.shape[1]} indices")
    else:
        print("\nWarning: Data validation failed. Review issues above.")
