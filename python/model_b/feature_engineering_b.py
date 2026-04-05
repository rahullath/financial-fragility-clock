"""
Model B Feature Engineering Module.

This module extends Model A feature engineering with:
1. Extended correlation features for 13 indices (78 pairwise correlations)
2. Eigenvalue ratio and volatility synchrony measures
3. Normalized macro signal integration
4. Enhanced fragility score with macro signals

Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6
"""

import pandas as pd
import numpy as np
from scipy import stats
from scipy.spatial.distance import pdist, squareform
import json
from datetime import datetime
from pathlib import Path
import sys
import warnings
from itertools import combinations
from math import factorial, log


def compute_rolling_correlation(df: pd.DataFrame, window: int = 60) -> pd.DataFrame:
    """
    Compute pairwise rolling Pearson correlations for 13 market indices.
    
    This is an extended version of Model A's correlation computation,
    adapted for 13 indices instead of 8.
    
    Args:
        df: DataFrame with 13 market indices
        window: Rolling window size in days (default 60)
        
    Returns:
        DataFrame with columns: date, mean_corr, corr_concentration, max_eigenvalue,
        eigenvalue_ratio, volatility_synchrony, plus 78 pairwise correlation columns (13 choose 2)
        
    Requirements: 33.1, 33.2, 33.3
    """
    # Select the 13 market indices for correlation analysis
    indices = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM', 
               'BIST100', 'SHANGHAI', 'HANGSENG', 'KOSPI', 'ASX200', 'VIX']
    
    # Check which indices are available
    available_indices = [idx for idx in indices if idx in df.columns]
    if len(available_indices) < len(indices):
        missing = set(indices) - set(available_indices)
        warnings.warn(f"Missing indices: {missing}. Using {len(available_indices)} available indices.")
        indices = available_indices
    
    df_indices = df[indices].copy()
    
    # Initialize result DataFrame
    results = pd.DataFrame(index=df_indices.index)
    
    # Store all pairwise correlations
    pairwise_corrs = {}
    for idx1, idx2 in combinations(indices, 2):
        pair_name = f"{idx1}_{idx2}"
        pairwise_corrs[pair_name] = []
    
    mean_corrs = []
    corr_concentrations = []
    max_eigenvalues = []
    eigenvalue_ratios = []
    volatility_synchronies = []
    
    # Compute rolling correlations
    for i in range(len(df_indices)):
        if i < window - 1:
            # Not enough data for rolling window
            mean_corrs.append(np.nan)
            corr_concentrations.append(np.nan)
            max_eigenvalues.append(np.nan)
            eigenvalue_ratios.append(np.nan)
            volatility_synchronies.append(np.nan)
            for pair_name in pairwise_corrs:
                pairwise_corrs[pair_name].append(np.nan)
        else:
            # Get window data
            window_data = df_indices.iloc[i - window + 1:i + 1]
            
            # Compute correlation matrix
            corr_matrix = window_data.corr()
            
            # Extract upper triangle (excluding diagonal) for pairwise correlations
            for idx1, idx2 in combinations(indices, 2):
                pair_name = f"{idx1}_{idx2}"
                corr_value = corr_matrix.loc[idx1, idx2]
                pairwise_corrs[pair_name].append(corr_value)
            
            # Compute mean absolute correlation
            upper_triangle = corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)]
            mean_corr = np.mean(np.abs(upper_triangle))
            mean_corrs.append(mean_corr)
            
            # Compute correlation concentration (variance of correlation matrix)
            corr_concentration = np.var(upper_triangle)
            corr_concentrations.append(corr_concentration)
            
            # Compute eigenvalues — guard against degenerate / NaN matrices
            try:
                # Fill any NaN cells in the correlation matrix before eigendecomposition
                corr_vals = corr_matrix.values.copy()
                if not np.isfinite(corr_vals).all():
                    raise ValueError("Non-finite values in correlation matrix")
                eigenvalues = np.linalg.eigvalsh(corr_vals)
                max_eigenvalue = float(np.max(eigenvalues))
                eigenvalue_sum = float(np.sum(eigenvalues))
                eigenvalue_ratio = (max_eigenvalue / eigenvalue_sum
                                    if eigenvalue_sum > 0 else np.nan)
            except (np.linalg.LinAlgError, ValueError):
                max_eigenvalue = np.nan
                eigenvalue_ratio = np.nan

            max_eigenvalues.append(max_eigenvalue)
            eigenvalue_ratios.append(eigenvalue_ratio)
            
            # Compute volatility synchrony (mean of rolling volatilities)
            # This measures how synchronized volatility is across markets
            window_volatilities = window_data.std()
            volatility_synchrony = window_volatilities.mean()
            volatility_synchronies.append(volatility_synchrony)
    
    # Add results to DataFrame
    results['mean_corr'] = mean_corrs
    results['corr_concentration'] = corr_concentrations
    results['max_eigenvalue'] = max_eigenvalues
    results['eigenvalue_ratio'] = eigenvalue_ratios
    results['volatility_synchrony'] = volatility_synchronies
    
    # Add all pairwise correlations
    for pair_name, values in pairwise_corrs.items():
        results[pair_name] = values
    
    print(f"Computed rolling correlations with {window}-day window for {len(indices)} indices")
    print(f"  Mean correlation range: {results['mean_corr'].min():.4f} to {results['mean_corr'].max():.4f}")
    print(f"  Eigenvalue ratio range: {results['eigenvalue_ratio'].min():.4f} to {results['eigenvalue_ratio'].max():.4f}")
    print(f"  Volatility synchrony range: {results['volatility_synchrony'].min():.6f} to {results['volatility_synchrony'].max():.6f}")
    print(f"  Pairwise correlations: {len(pairwise_corrs)}")
    
    return results


def compute_permutation_entropy(series: pd.Series, m: int = 3, delay: int = 1, 
                                window: int = 30) -> pd.Series:
    """
    Compute rolling permutation entropy on return series.
    
    This is identical to Model A's implementation.
    
    Args:
        series: Time series (e.g., SP500 returns)
        m: Embedding dimension (default 3)
        delay: Time delay (default 1)
        window: Rolling window size (default 30)
        
    Returns:
        Series of permutation entropy values (0 = ordered, 1 = random)
    """
    def _permutation_entropy_single(data, m, delay):
        """Compute permutation entropy for a single window."""
        n = len(data)
        permutations = {}
        
        # Generate all possible permutations
        for i in range(n - delay * (m - 1)):
            # Extract the pattern
            pattern = []
            for j in range(m):
                pattern.append(data[i + j * delay])
            
            # Convert to ordinal pattern (rank)
            sorted_indices = sorted(range(len(pattern)), key=lambda k: pattern[k])
            ordinal_pattern = tuple(sorted_indices)
            
            # Count this pattern
            permutations[ordinal_pattern] = permutations.get(ordinal_pattern, 0) + 1
        
        # Calculate entropy
        total = sum(permutations.values())
        if total == 0:
            return np.nan
        
        entropy = 0
        for count in permutations.values():
            if count > 0:
                p = count / total
                entropy -= p * log(p)
        
        # Normalize by maximum possible entropy
        max_entropy = log(factorial(m))
        if max_entropy == 0:
            return 0
        
        normalized_entropy = entropy / max_entropy
        return normalized_entropy
    
    # Compute rolling permutation entropy
    pe_values = []
    data_array = series.values
    
    for i in range(len(series)):
        if i < window - 1:
            # Not enough data for rolling window
            pe_values.append(np.nan)
        else:
            # Get window data
            window_data = data_array[i - window + 1:i + 1]
            
            # Compute permutation entropy for this window
            pe = _permutation_entropy_single(window_data, m, delay)
            pe_values.append(pe)
    
    result = pd.Series(pe_values, index=series.index, name='permutation_entropy')
    
    print(f"Computed permutation entropy with m={m}, delay={delay}, window={window}")
    print(f"  PE range: {result.min():.4f} to {result.max():.4f}")
    
    return result


def compute_rolling_volatility(series: pd.Series, window: int = 30) -> pd.Series:
    """
    Compute rolling volatility (standard deviation) for a time series.
    
    Args:
        series: Time series (e.g., SP500 returns)
        window: Rolling window size (default 30)
        
    Returns:
        Series of rolling volatility values
    """
    rolling_vol = series.rolling(window=window).std()
    
    print(f"Computed rolling volatility with {window}-day window")
    print(f"  Volatility range: {rolling_vol.min():.6f} to {rolling_vol.max():.6f}")
    
    return rolling_vol


def normalize_macro_signals(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize macro signals to [0,1] range using min-max scaling.
    
    Handles missing data gracefully (TED spread discontinued in 2023).
    
    Args:
        df: DataFrame with macro signal columns (VIX, TED_SPREAD, YIELD_SPREAD, CREDIT_SPREAD)
        
    Returns:
        DataFrame with normalized macro signals
        
    Requirements: 33.4
    """
    print("\nNormalizing macro signals to [0,1] range...")
    
    macro_cols = ['VIX', 'TED_SPREAD', 'YIELD_SPREAD', 'CREDIT_SPREAD']
    available_cols = [col for col in macro_cols if col in df.columns]
    
    if not available_cols:
        warnings.warn("No macro signal columns found in DataFrame")
        return pd.DataFrame(index=df.index)
    
    normalized_df = pd.DataFrame(index=df.index)
    
    for col in available_cols:
        # Check data availability
        non_null_count = df[col].notna().sum()
        total_count = len(df)
        availability_pct = 100 * non_null_count / total_count
        
        print(f"  {col}: {non_null_count}/{total_count} observations ({availability_pct:.1f}%)")
        
        if non_null_count == 0:
            warnings.warn(f"{col} has no data, skipping normalization")
            normalized_df[f"{col}_norm"] = np.nan
            continue
        
        # Min-max normalization
        min_val = df[col].min()
        max_val = df[col].max()
        
        if max_val == min_val:
            # Constant value, normalize to 0.5
            normalized_df[f"{col}_norm"] = 0.5
        else:
            normalized_df[f"{col}_norm"] = (df[col] - min_val) / (max_val - min_val)
        
        print(f"    Range: [{min_val:.4f}, {max_val:.4f}]")
    
    return normalized_df


def compute_fragility_score_b(corr: pd.Series, pe: pd.Series, vol: pd.Series,
                              eigenvalue_ratio: pd.Series,
                              vix_norm: pd.Series = None,
                              ted_norm: pd.Series = None,
                              yield_spread_norm: pd.Series = None) -> pd.Series:
    """
    Compute Model B fragility score with macro signals.
    
    Formula: 0.25×corr + 0.20×PE_inv + 0.15×vol + 0.15×eigenvalue_ratio + 
             0.10×TED + 0.10×VIX + 0.05×yield_spread
    
    All components normalized to [0,1] before weighting.
    Handles missing macro signals gracefully by adjusting weights.
    
    Args:
        corr: Series of mean rolling correlations
        pe: Series of permutation entropy values
        vol: Series of rolling volatility
        eigenvalue_ratio: Series of eigenvalue ratios
        vix_norm: Normalized VIX values (optional)
        ted_norm: Normalized TED spread values (optional)
        yield_spread_norm: Normalized yield spread values (optional)
        
    Returns:
        Series of fragility scores (0-100)
        
    Requirements: 33.5, 33.6
    """
    # Min-max normalization function
    def normalize(series):
        """Normalize series to [0, 1] range using min-max scaling."""
        min_val = series.min()
        max_val = series.max()
        if max_val == min_val:
            return pd.Series(0.5, index=series.index)
        return (series - min_val) / (max_val - min_val)
    
    # Normalize core components
    corr_norm = normalize(corr)
    pe_norm = normalize(pe)
    pe_inv_norm = 1 - pe_norm  # Invert PE (lower PE = higher fragility)
    vol_norm = normalize(vol)
    eigenvalue_ratio_norm = normalize(eigenvalue_ratio)
    
    # Base weights for core components
    weight_corr = 0.25
    weight_pe = 0.20
    weight_vol = 0.15
    weight_eigenvalue = 0.15
    
    # Macro signal weights (may be adjusted if signals unavailable)
    weight_ted = 0.10
    weight_vix = 0.10
    weight_yield = 0.05
    
    # Track which macro signals are available
    available_macro = []
    unavailable_macro = []
    
    # Check VIX availability
    if vix_norm is not None and vix_norm.notna().sum() > 0:
        available_macro.append(('VIX', weight_vix, vix_norm))
    else:
        unavailable_macro.append(('VIX', weight_vix))
        vix_norm = pd.Series(0, index=corr.index)
        weight_vix = 0
    
    # Check TED spread availability
    if ted_norm is not None and ted_norm.notna().sum() > 0:
        available_macro.append(('TED', weight_ted, ted_norm))
    else:
        unavailable_macro.append(('TED', weight_ted))
        ted_norm = pd.Series(0, index=corr.index)
        weight_ted = 0
    
    # Check yield spread availability
    if yield_spread_norm is not None and yield_spread_norm.notna().sum() > 0:
        available_macro.append(('YIELD', weight_yield, yield_spread_norm))
    else:
        unavailable_macro.append(('YIELD', weight_yield))
        yield_spread_norm = pd.Series(0, index=corr.index)
        weight_yield = 0
    
    # Adjust weights if macro signals are missing
    if unavailable_macro:
        print("\nAdjusting fragility score weights due to missing macro signals:")
        print(f"  Unavailable: {', '.join([name for name, _, in unavailable_macro])}")
        
        # Redistribute unavailable weights proportionally to core components
        total_unavailable_weight = sum([w for _, w in unavailable_macro])
        total_core_weight = weight_corr + weight_pe + weight_vol + weight_eigenvalue
        
        if total_core_weight > 0:
            redistribution_factor = 1 + (total_unavailable_weight / total_core_weight)
            weight_corr *= redistribution_factor
            weight_pe *= redistribution_factor
            weight_vol *= redistribution_factor
            weight_eigenvalue *= redistribution_factor
        
        print(f"  Adjusted weights:")
        print(f"    corr={weight_corr:.3f}, PE_inv={weight_pe:.3f}, vol={weight_vol:.3f}, eigenvalue={weight_eigenvalue:.3f}")
        print(f"    VIX={weight_vix:.3f}, TED={weight_ted:.3f}, yield={weight_yield:.3f}")
    else:
        print("\nComputing Model B fragility score with all macro signals:")
        print(f"  Weights: corr={weight_corr}, PE_inv={weight_pe}, vol={weight_vol}, eigenvalue={weight_eigenvalue}")
        print(f"           VIX={weight_vix}, TED={weight_ted}, yield={weight_yield}")
    
    # Compute weighted fragility score
    fragility = (weight_corr * corr_norm + 
                weight_pe * pe_inv_norm + 
                weight_vol * vol_norm + 
                weight_eigenvalue * eigenvalue_ratio_norm +
                weight_vix * vix_norm +
                weight_ted * ted_norm +
                weight_yield * yield_spread_norm)
    
    # Scale to [0, 100]
    fragility_score = fragility * 100
    
    # Return NaN when core components are NaN
    mask = corr.isna() | pe.isna() | vol.isna() | eigenvalue_ratio.isna()
    fragility_score[mask] = np.nan
    
    print(f"\nModel B fragility score statistics:")
    print(f"  Range: {fragility_score.min():.2f} to {fragility_score.max():.2f}")
    print(f"  Mean: {fragility_score.mean():.2f}")
    print(f"  Median: {fragility_score.median():.2f}")
    print(f"  Std: {fragility_score.std():.2f}")
    print(f"  NaN values: {fragility_score.isna().sum()}")
    
    return fragility_score


def export_features(features_df: pd.DataFrame, filepath: str) -> None:
    """
    Write Model B feature time series to JSON.
    
    Args:
        features_df: DataFrame with all feature columns
        filepath: Output JSON file path
        
    JSON structure:
    {
        "metadata": {
            "model": "Model B",
            "features": [...], 
            "date_range": [...],
            "timestamp": "...",
            "python_version": "..."
        },
        "data": [
            {
                "date": "2003-01-02", 
                "mean_corr": 0.45, 
                "eigenvalue_ratio": 0.32,
                "fragility_score": 42.5,
                "pairwise_correlations": {...},
                ...
            }, 
            ...
        ]
    }
    """
    # Create output directory if it doesn't exist
    output_path = Path(filepath)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Identify pairwise correlation columns
    pairwise_cols = [col for col in features_df.columns if '_' in col and 
                     any(idx in col for idx in ['SP500', 'DAX', 'FTSE', 'NIKKEI', 
                                                 'BOVESPA', 'EU', 'EM', 'BIST100',
                                                 'SHANGHAI', 'HANGSENG', 'KOSPI', 
                                                 'ASX200', 'VIX'])]
    
    # Identify main feature columns (excluding pairwise correlations)
    main_features = [col for col in features_df.columns if col not in pairwise_cols]
    
    # Prepare metadata
    metadata = {
        'model': 'Model B',
        'description': 'Extended 2003-2025 feature engineering with macro signals',
        'features': main_features,
        'pairwise_correlation_pairs': pairwise_cols,
        'date_range': [features_df.index.min().isoformat(), features_df.index.max().isoformat()],
        'timestamp': datetime.now().isoformat(),
        'python_version': sys.version.split()[0]
    }
    
    # Convert DataFrame to list of dictionaries
    data_records = []
    for date, row in features_df.iterrows():
        record = {'date': date.isoformat()}
        
        # Add main features
        for col in main_features:
            value = row[col]
            if pd.isna(value):
                record[col] = None
            elif isinstance(value, (np.integer, np.floating)):
                record[col] = float(value)
            else:
                record[col] = str(value)
        
        # Add pairwise correlations as nested object
        pairwise_dict = {}
        for col in pairwise_cols:
            value = row[col]
            if pd.isna(value):
                pairwise_dict[col] = None
            else:
                pairwise_dict[col] = float(value)
        record['pairwise_correlations'] = pairwise_dict
        
        data_records.append(record)
    
    # Create final JSON structure
    output_data = {
        'metadata': metadata,
        'data': data_records
    }
    
    # Write to file
    with open(filepath, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"\nExported Model B features to {filepath}")
    print(f"  Rows: {len(data_records)}")
    print(f"  Main features: {len(main_features)}")
    print(f"  Pairwise correlations: {len(pairwise_cols)}")
    print(f"  Date range: {metadata['date_range'][0]} to {metadata['date_range'][1]}")


if __name__ == "__main__":
    print("Model B Feature Engineering Module")
    print("=" * 60)
    
    # Load cleaned Model B data
    print("\nLoading Model B cleaned data...")
    with open("../../src/data/model_b_cleaned_data.json", "r") as f:
        cleaned_data = json.load(f)
    
    # Convert to DataFrame
    df = pd.DataFrame(cleaned_data['data'])
    df['date'] = pd.to_datetime(df['date'])
    df = df.set_index('date')
    
    print(f"Loaded data: {df.shape[0]} observations × {df.shape[1]} columns")
    print(f"Date range: {df.index.min()} to {df.index.max()}")
    
    # Run complete feature engineering pipeline
    print("\n" + "=" * 60)
    print("RUNNING MODEL B FEATURE ENGINEERING PIPELINE")
    print("=" * 60)
    
    # 1. Compute rolling correlations (extended for 13 indices)
    print("\n[1/7] Computing rolling correlations...")
    corr_features = compute_rolling_correlation(df, window=60)
    
    # 2. Compute permutation entropy (use SP500 as reference index)
    print("\n[2/7] Computing permutation entropy...")
    pe_series = compute_permutation_entropy(df['SP500'], m=3, delay=1, window=30)
    
    # 3. Compute rolling volatility
    print("\n[3/7] Computing rolling volatility...")
    rolling_vol = compute_rolling_volatility(df['SP500'], window=30)
    
    # 4. Normalize macro signals
    print("\n[4/7] Normalizing macro signals...")
    macro_normalized = normalize_macro_signals(df)
    
    # 5. Compute Model B fragility score
    print("\n[5/7] Computing Model B fragility score...")
    fragility_score = compute_fragility_score_b(
        corr_features['mean_corr'],
        pe_series,
        rolling_vol,
        corr_features['eigenvalue_ratio'],
        vix_norm=macro_normalized.get('VIX_norm'),
        ted_norm=macro_normalized.get('TED_SPREAD_norm'),
        yield_spread_norm=macro_normalized.get('YIELD_SPREAD_norm')
    )
    
    # 6. Combine all features into single DataFrame
    print("\n[6/7] Combining all features...")
    features_df = corr_features.copy()
    features_df['permutation_entropy'] = pe_series
    features_df['rolling_volatility'] = rolling_vol
    features_df['fragility_score'] = fragility_score
    
    # Add normalized macro signals
    for col in macro_normalized.columns:
        features_df[col] = macro_normalized[col]
    
    print(f"\nFinal features DataFrame shape: {features_df.shape}")
    print(f"Columns: {len(features_df.columns)}")
    
    # 7. Export to JSON
    print("\n[7/7] Exporting features to JSON...")
    output_path = "../../src/data/model_b_features.json"
    export_features(features_df, output_path)
    
    print("\n" + "=" * 60)
    print("MODEL B FEATURE ENGINEERING COMPLETE!")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  Total observations: {len(features_df)}")
    print(f"  Valid fragility scores: {features_df['fragility_score'].notna().sum()}")
    print(f"  Date range: {features_df.index.min()} to {features_df.index.max()}")
    print(f"\nFragility score statistics:")
    print(features_df['fragility_score'].describe())
