"""
Compute per-index rolling volatility for MST visualization.

This script computes rolling volatility (standard deviation) for each market index
and adds it to the features.json file so the NetworkMST component can display
volatility-based node colors.
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path


def compute_per_index_volatility(features_path: str, window: int = 30) -> None:
    """
    Compute rolling volatility for each index and update features.json.
    
    Args:
        features_path: Path to features.json file
        window: Rolling window size for volatility computation (default 30)
    """
    print(f"\n{'='*60}")
    print("Computing Per-Index Volatility for MST Visualization")
    print(f"{'='*60}\n")
    
    # Load features data
    with open(features_path, 'r') as f:
        features_data = json.load(f)
    
    # Convert to DataFrame
    df = pd.DataFrame(features_data['data'])
    df['date'] = pd.to_datetime(df['date'])
    df = df.set_index('date').sort_index()
    
    # Get list of indices from metadata
    indices = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
    
    print(f"Computing {window}-day rolling volatility for {len(indices)} indices...")
    
    # Compute rolling volatility for each index
    for idx in indices:
        if idx in df.columns:
            # Compute rolling standard deviation
            rolling_vol = df[idx].rolling(window=window).std()
            
            # Store as new column
            vol_col_name = f'{idx}_volatility'
            df[vol_col_name] = rolling_vol
            
            # Print statistics
            non_null_count = rolling_vol.notna().sum()
            null_count = rolling_vol.isna().sum()
            print(f"  {idx}: {non_null_count} values, {null_count} null (first {window} observations)")
            if non_null_count > 0:
                print(f"    Range: {rolling_vol.min():.6f} to {rolling_vol.max():.6f}")
                print(f"    Median: {rolling_vol.median():.6f}")
        else:
            print(f"  WARNING: {idx} not found in features data")
    
    # Convert back to records format
    df_reset = df.reset_index()
    updated_records = []
    
    for _, row in df_reset.iterrows():
        record = row.to_dict()
        # Convert date to ISO format
        record['date'] = record['date'].isoformat()
        # Convert numpy types to Python types
        for key, value in record.items():
            if pd.isna(value):
                record[key] = None
            elif isinstance(value, (np.integer, np.floating)):
                record[key] = float(value)
        updated_records.append(record)
    
    # Update features data
    features_data['data'] = updated_records
    
    # Update metadata to include new volatility columns
    vol_columns = [f'{idx}_volatility' for idx in indices if idx in df.columns]
    if 'features' in features_data['metadata']:
        existing_features = features_data['metadata']['features']
        for vol_col in vol_columns:
            if vol_col not in existing_features:
                existing_features.append(vol_col)
    
    # Write updated data back to file
    with open(features_path, 'w') as f:
        json.dump(features_data, f, indent=2)
    
    print(f"\n✓ Updated {features_path} with per-index volatility columns")
    print(f"  Added columns: {', '.join(vol_columns)}")
    print(f"  Total records: {len(updated_records)}")


if __name__ == '__main__':
    # Compute for both Model A and Model B features
    features_a_path = Path(__file__).parent.parent / 'src' / 'data' / 'features.json'
    features_b_path = Path(__file__).parent.parent / 'src' / 'data' / 'model_b_features.json'
    
    if features_a_path.exists():
        print("\nProcessing Model A features...")
        compute_per_index_volatility(str(features_a_path), window=30)
    else:
        print(f"WARNING: {features_a_path} not found")
    
    if features_b_path.exists():
        print("\nProcessing Model B features...")
        compute_per_index_volatility(str(features_b_path), window=30)
    else:
        print(f"WARNING: {features_b_path} not found")
    
    print(f"\n{'='*60}")
    print("Per-Index Volatility Computation Complete")
    print(f"{'='*60}\n")
