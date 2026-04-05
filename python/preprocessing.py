"""
Preprocessing module for Financial Fragility Clock.

This module handles CSV parsing, missing value handling, descriptive statistics,
and JSON export for the ISE dataset.
"""

import pandas as pd
import numpy as np
from scipy import stats
import json
from datetime import datetime
from pathlib import Path
import sys
import warnings


def load_csv(filepath: str) -> pd.DataFrame:
    """
    Parse ISE dataset CSV with flexible delimiter and date format detection.
    
    Args:
        filepath: Path to Group_5.csv
        
    Returns:
        DataFrame with datetime index and 8 numeric columns
        
    Raises:
        FileNotFoundError: If CSV file doesn't exist
        ValueError: If row count != 536 after parsing
    """
    # Check if file exists
    if not Path(filepath).exists():
        raise FileNotFoundError(f"CSV file not found: {filepath}")
    
    try:
        # Read CSV with flexible parsing
        # The CSV has an extra unnamed column at the start and a header row
        df = pd.read_csv(filepath, skiprows=1)
        
        # Drop the first unnamed column if it exists
        if df.columns[0] == 'Unnamed: 0' or df.iloc[:, 0].name in ['', 'Unnamed: 0']:
            df = df.iloc[:, 1:]
        
        # Rename columns to standard names
        expected_columns = ['date', 'ISE_TL', 'ISE_USD', 'SP500', 'DAX', 'FTSE', 
                          'NIKKEI', 'BOVESPA', 'EU', 'EM']
        
        if len(df.columns) == len(expected_columns):
            df.columns = expected_columns
        else:
            # Try to match columns by position
            print(f"Warning: Expected {len(expected_columns)} columns, got {len(df.columns)}")
            print(f"Columns found: {list(df.columns)}")
        
        # Convert date column to datetime with flexible parsing
        try:
            df['date'] = pd.to_datetime(df['date'], format='%d-%b-%y')
        except:
            try:
                df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d')
            except:
                df['date'] = pd.to_datetime(df['date'], infer_datetime_format=True)
        
        # Set date as index
        df = df.set_index('date')
        # Note: Not setting freq='D' as the data may have gaps (weekends, holidays)
        
        # Convert all numeric columns to float
        numeric_columns = ['ISE_TL', 'ISE_USD', 'SP500', 'DAX', 'FTSE', 
                          'NIKKEI', 'BOVESPA', 'EU', 'EM']
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Validate row count
        if len(df) != 536:
            raise ValueError(f"Expected exactly 536 rows, but parsed {len(df)} rows")
        
        print(f"Successfully loaded {len(df)} observations from {filepath}")
        print(f"Date range: {df.index.min()} to {df.index.max()}")
        print(f"Columns: {list(df.columns)}")
        
        return df
        
    except Exception as e:
        if isinstance(e, ValueError) and "536 rows" in str(e):
            raise
        raise ValueError(f"Error parsing CSV file: {str(e)}")


def handle_missing_values(df: pd.DataFrame, max_gap: int = 3) -> pd.DataFrame:
    """
    Forward-fill missing values for gaps <= max_gap days, flag longer gaps.
    
    Args:
        df: Raw DataFrame with potential NaN values
        max_gap: Maximum consecutive days to forward-fill
        
    Returns:
        DataFrame with missing values handled, flagged rows excluded
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
                    # Flag and exclude this range
                    start_date = df_clean.index[group_mask][0]
                    end_date = df_clean.index[group_mask][-1]
                    excluded_ranges.append((col, start_date, end_date, gap_size))
                    warnings.warn(
                        f"Excluding {gap_size} observations in {col} from {start_date} to {end_date} "
                        f"(gap > {max_gap} days)"
                    )
                    # Mark these rows for exclusion
                    df_clean.loc[group_mask, col] = np.nan
    
    # Apply forward-fill for remaining gaps (≤ max_gap)
    df_clean = df_clean.ffill(limit=max_gap)
    
    # Remove rows that still have NaN values (these are the excluded ones)
    rows_before = len(df_clean)
    df_clean = df_clean.dropna()
    rows_after = len(df_clean)
    
    if rows_before != rows_after:
        print(f"Excluded {rows_before - rows_after} rows due to missing value gaps > {max_gap} days")
    
    if excluded_ranges:
        print(f"\nExcluded date ranges:")
        for col, start, end, gap in excluded_ranges:
            print(f"  {col}: {start} to {end} ({gap} days)")
    
    return df_clean


def compute_descriptive_stats(df: pd.DataFrame) -> dict:
    """
    Compute mean, std, min, max, quartiles for all numeric columns.
    
    Args:
        df: DataFrame with numeric columns
        
    Returns:
        Dictionary with column names as keys, stats dict as values
    """
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
        
        # Perform Shapiro-Wilk normality test
        try:
            shapiro_stat, shapiro_p = stats.shapiro(df[col].dropna())
            col_stats['shapiro_stat'] = float(shapiro_stat)
            col_stats['shapiro_p'] = float(shapiro_p)
            col_stats['is_normal'] = bool(shapiro_p > 0.05)
        except Exception as e:
            print(f"Warning: Could not perform Shapiro-Wilk test for {col}: {e}")
            col_stats['shapiro_stat'] = None
            col_stats['shapiro_p'] = None
            col_stats['is_normal'] = None
        
        stats_dict[col] = col_stats
    
    return stats_dict


def export_cleaned_data(df: pd.DataFrame, stats: dict, filepath: str) -> None:
    """
    Write cleaned data and metadata to JSON.
    
    Args:
        df: Cleaned DataFrame
        stats: Descriptive statistics dictionary
        filepath: Output JSON file path
        
    JSON structure:
    {
        "metadata": {
            "rows": 536, 
            "columns": 8, 
            "date_range": [...], 
            "stats": {...},
            "timestamp": "...",
            "python_version": "..."
        },
        "data": [{"date": "2009-01-05", "ISE_USD": 0.0123, ...}, ...]
    }
    """
    # Create output directory if it doesn't exist
    output_path = Path(filepath)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Prepare metadata
    metadata = {
        'rows': len(df),
        'columns': len(df.columns),
        'date_range': [df.index.min().isoformat(), df.index.max().isoformat()],
        'stats': stats,
        'timestamp': datetime.now().isoformat(),
        'python_version': sys.version.split()[0]
    }
    
    # Convert DataFrame to list of dictionaries
    data_records = []
    for date, row in df.iterrows():
        record = {'date': date.isoformat()}
        for col in df.columns:
            record[col] = float(row[col]) if not pd.isna(row[col]) else None
        data_records.append(record)
    
    # Create final JSON structure
    output_data = {
        'metadata': metadata,
        'data': data_records
    }
    
    # Write to file
    with open(filepath, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"\nExported cleaned data to {filepath}")
    print(f"  Rows: {metadata['rows']}")
    print(f"  Columns: {metadata['columns']}")
    print(f"  Date range: {metadata['date_range'][0]} to {metadata['date_range'][1]}")


if __name__ == "__main__":
    # Example usage
    print("Financial Fragility Clock - Preprocessing Module")
    print("=" * 60)
    
    # Load CSV (path relative to workspace root)
    csv_path = "../context-dump/converted/Group_5.csv"
    df = load_csv(csv_path)
    
    # Handle missing values
    df_clean = handle_missing_values(df, max_gap=3)
    
    # Compute descriptive statistics
    stats = compute_descriptive_stats(df_clean)
    
    # Export to JSON (path relative to workspace root)
    output_path = "../src/data/cleaned_data.json"
    export_cleaned_data(df_clean, stats, output_path)
    
    print("\nPreprocessing complete!")
