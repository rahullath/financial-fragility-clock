"""
Model B Preprocessing Module.

This module merges market data and macro data, handles missing values,
validates data completeness, and exports to JSON format.
"""

import pandas as pd
import numpy as np
import json
from datetime import datetime
from pathlib import Path
import sys
import warnings

# Import Model B data fetchers
from fetch_market_data import fetch_market_data, handle_missing_data as handle_market_missing, validate_data as validate_market
from fetch_macro_data import fetch_macro_data, resample_to_daily, handle_missing_data as handle_macro_missing, validate_data as validate_macro


def merge_market_and_macro(market_df: pd.DataFrame, macro_df: pd.DataFrame) -> pd.DataFrame:
    """
    Merge market data and macro data on date index.
    
    Args:
        market_df: DataFrame with market indices (daily)
        macro_df: DataFrame with macro indicators (daily)
        
    Returns:
        Merged DataFrame with both market and macro data
    """
    print("\nMerging market and macro data...")
    print(f"  Market data: {market_df.shape}")
    print(f"  Macro data: {macro_df.shape}")
    
    # Merge on date index (inner join to keep only common dates)
    merged_df = market_df.join(macro_df, how='inner')
    
    print(f"  Merged data: {merged_df.shape}")
    print(f"  Date range: {merged_df.index.min()} to {merged_df.index.max()}")
    
    # Check for missing values
    missing_counts = merged_df.isna().sum()
    if missing_counts.sum() > 0:
        print(f"  Missing values after merge:")
        for col in merged_df.columns:
            if missing_counts[col] > 0:
                pct = 100 * missing_counts[col] / len(merged_df)
                print(f"    {col}: {missing_counts[col]} ({pct:.1f}%)")
    
    return merged_df


def handle_missing_values(df: pd.DataFrame, max_gap: int = 5) -> pd.DataFrame:
    """
    Handle missing values with forward-fill for gaps ≤ max_gap days.
    
    Args:
        df: DataFrame with potential missing values
        max_gap: Maximum consecutive days to forward-fill
        
    Returns:
        DataFrame with missing values handled
    """
    print(f"\nHandling missing values (max_gap={max_gap} days)...")
    
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
    
    # Apply forward-fill for all gaps
    df_clean = df_clean.ffill()
    
    # Backward-fill for leading NaN values
    df_clean = df_clean.bfill()
    
    # Check for remaining NaN
    remaining_nan = df_clean.isna().sum()
    if remaining_nan.sum() > 0:
        print(f"  Remaining NaN values after forward/backward fill:")
        for col in df_clean.columns:
            if remaining_nan[col] > 0:
                print(f"    {col}: {remaining_nan[col]}")
        
        # Drop rows with any remaining NaN
        rows_before = len(df_clean)
        df_clean = df_clean.dropna()
        rows_after = len(df_clean)
        print(f"  Dropped {rows_before - rows_after} rows with NaN values")
    
    if excluded_ranges:
        print(f"\n  Large gaps detected (>{max_gap} days):")
        for col, start, end, gap in excluded_ranges[:10]:  # Show first 10
            print(f"    {col}: {start} to {end} ({gap} days)")
        if len(excluded_ranges) > 10:
            print(f"    ... and {len(excluded_ranges) - 10} more")
    
    print(f"\n  Final shape: {df_clean.shape}")
    print(f"  Date range: {df_clean.index.min()} to {df_clean.index.max()}")
    
    return df_clean


def validate_data_completeness(df: pd.DataFrame) -> bool:
    """
    Validate data completeness and quality.
    
    Args:
        df: DataFrame to validate
        
    Returns:
        True if validation passes, False otherwise
    """
    print("\nValidating data completeness...")
    
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
    if actual_years < expected_years * 0.5:  # Allow 50% tolerance for merged data
        issues.append(f"Date range too short: {actual_years:.1f} years (expected ~{expected_years})")
    
    # Check minimum observations
    min_obs = 4000  # Roughly 16 years * 252 trading days (allowing for gaps)
    if len(df) < min_obs:
        issues.append(f"Too few observations: {len(df)} (expected >{min_obs})")
    
    # Check expected columns
    expected_market_cols = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM', 
                           'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200', 'VIX']
    expected_macro_cols = ['YIELD_SPREAD', 'TED_SPREAD', 'FED_FUNDS', 'CREDIT_SPREAD']
    
    missing_cols = []
    for col in expected_market_cols + expected_macro_cols:
        if col not in df.columns:
            missing_cols.append(col)
    
    if missing_cols:
        issues.append(f"Missing expected columns: {', '.join(missing_cols)}")
    
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
        print(f"    Market indices: {len([c for c in df.columns if c in expected_market_cols])}")
        print(f"    Macro indicators: {len([c for c in df.columns if c in expected_macro_cols])}")
        return True


def compute_descriptive_stats(df: pd.DataFrame) -> dict:
    """
    Compute descriptive statistics for all columns.
    
    Args:
        df: DataFrame with numeric columns
        
    Returns:
        Dictionary with column names as keys, stats dict as values
    """
    print("\nComputing descriptive statistics...")
    
    stats_dict = {}
    
    for col in df.columns:
        col_stats = {
            'mean': float(df[col].mean()),
            'std': float(df[col].std()),
            'min': float(df[col].min()),
            'max': float(df[col].max()),
            'q25': float(df[col].quantile(0.25)),
            'q50': float(df[col].quantile(0.50)),
            'q75': float(df[col].quantile(0.75))
        }
        
        stats_dict[col] = col_stats
    
    print(f"  Computed statistics for {len(stats_dict)} columns")
    
    return stats_dict


def export_to_json(df: pd.DataFrame, stats: dict, filepath: str) -> None:
    """
    Export cleaned data and metadata to JSON.
    
    Args:
        df: Cleaned DataFrame
        stats: Descriptive statistics dictionary
        filepath: Output JSON file path
        
    JSON structure:
    {
        "metadata": {
            "rows": 5700,
            "columns": 18,
            "date_range": ["2003-01-01", "2025-12-31"],
            "stats": {...},
            "timestamp": "...",
            "python_version": "..."
        },
        "data": [
            {"date": "2003-01-02", "SP500": 879.82, "VIX": 21.43, ...},
            ...
        ]
    }
    """
    print(f"\nExporting to JSON: {filepath}")
    
    # Create output directory if it doesn't exist
    output_path = Path(filepath)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Prepare metadata
    metadata = {
        'model': 'Model B',
        'description': 'Extended 2003-2025 global data with macro signals',
        'rows': len(df),
        'columns': len(df.columns),
        'date_range': [df.index.min().isoformat(), df.index.max().isoformat()],
        'market_indices': [col for col in df.columns if col not in ['VIX', 'YIELD_SPREAD', 'TED_SPREAD', 'FED_FUNDS', 'CREDIT_SPREAD']],
        'macro_indicators': [col for col in df.columns if col in ['VIX', 'YIELD_SPREAD', 'TED_SPREAD', 'FED_FUNDS', 'CREDIT_SPREAD']],
        'stats': stats,
        'timestamp': datetime.now().isoformat(),
        'python_version': sys.version.split()[0]
    }
    
    # Convert DataFrame to list of dictionaries
    data_records = []
    for date, row in df.iterrows():
        record = {'date': date.isoformat()}
        for col in df.columns:
            value = row[col]
            record[col] = float(value) if not pd.isna(value) else None
        data_records.append(record)
    
    # Create final JSON structure
    output_data = {
        'metadata': metadata,
        'data': data_records
    }
    
    # Write to file
    with open(filepath, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"  Successfully exported {len(data_records)} observations")
    print(f"  File size: {output_path.stat().st_size / 1024 / 1024:.2f} MB")


def run_preprocessing_pipeline(api_key: str = None,
                               start_date: str = "2003-01-01",
                               end_date: str = "2025-12-31",
                               output_path: str = "../../src/data/model_b_cleaned_data.json") -> pd.DataFrame:
    """
    Run the complete Model B preprocessing pipeline.
    
    Args:
        api_key: FRED API key (optional, reads from environment if not provided)
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        output_path: Path to output JSON file
        
    Returns:
        Cleaned and merged DataFrame
    """
    print("=" * 60)
    print("MODEL B PREPROCESSING PIPELINE")
    print("=" * 60)
    
    # Step 1: Fetch market data
    print("\n[1/7] Fetching market data from yfinance...")
    market_df = fetch_market_data(start_date=start_date, end_date=end_date)
    market_df = handle_market_missing(market_df, max_gap=5)
    validate_market(market_df)
    
    # Step 2: Fetch macro data
    print("\n[2/7] Fetching macro data from FRED...")
    macro_df = fetch_macro_data(api_key=api_key, start_date=start_date, end_date=end_date)
    macro_df = resample_to_daily(macro_df)
    macro_df = handle_macro_missing(macro_df)
    validate_macro(macro_df)
    
    # Step 3: Merge data
    print("\n[3/7] Merging market and macro data...")
    merged_df = merge_market_and_macro(market_df, macro_df)
    
    # Step 4: Handle missing values
    print("\n[4/7] Handling missing values...")
    clean_df = handle_missing_values(merged_df, max_gap=5)
    
    # Step 5: Validate completeness
    print("\n[5/7] Validating data completeness...")
    is_valid = validate_data_completeness(clean_df)
    
    if not is_valid:
        warnings.warn("Data validation failed. Proceeding with export anyway.")
    
    # Step 6: Compute statistics
    print("\n[6/7] Computing descriptive statistics...")
    stats = compute_descriptive_stats(clean_df)
    
    # Step 7: Export to JSON
    print("\n[7/7] Exporting to JSON...")
    export_to_json(clean_df, stats, output_path)
    
    print("\n" + "=" * 60)
    print("MODEL B PREPROCESSING COMPLETE!")
    print("=" * 60)
    print(f"\nFinal dataset:")
    print(f"  Observations: {len(clean_df)}")
    print(f"  Columns: {len(clean_df.columns)}")
    print(f"  Date range: {clean_df.index.min()} to {clean_df.index.max()}")
    print(f"  Output file: {output_path}")
    
    return clean_df


if __name__ == "__main__":
    import os
    
    # Check for FRED API key
    api_key = os.environ.get('FRED_API_KEY')
    if not api_key:
        print("\nWARNING: FRED_API_KEY environment variable not set")
        print("Get a free API key at: https://fred.stlouisfed.org/docs/api/api_key.html")
        print("Then set it with: export FRED_API_KEY='your_key_here'")
        print("\nAttempting to proceed without macro data...")
        
        # Run with market data only
        print("\n" + "=" * 60)
        print("MODEL B PREPROCESSING PIPELINE (MARKET DATA ONLY)")
        print("=" * 60)
        
        market_df = fetch_market_data(start_date="2003-01-01", end_date="2025-12-31")
        market_df = handle_market_missing(market_df, max_gap=5)
        validate_market(market_df)
        
        stats = compute_descriptive_stats(market_df)
        export_to_json(market_df, stats, "../../src/data/model_b_cleaned_data.json")
        
        print("\nNote: Macro indicators not included. Set FRED_API_KEY to fetch macro data.")
    else:
        # Run full pipeline
        clean_df = run_preprocessing_pipeline(
            api_key=api_key,
            start_date="2003-01-01",
            end_date="2025-12-31",
            output_path="../../src/data/model_b_cleaned_data.json"
        )
