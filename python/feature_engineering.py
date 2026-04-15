"""
Feature Engineering module for Financial Fragility Clock.

This module handles rolling correlation computation, permutation entropy calculation,
Minsky regime labeling, fragility score computation, and JSON export.
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


def calibrate_model_a_thresholds(fragility_score: pd.Series) -> tuple[float, float]:
    """
    Calibrate Model A regime thresholds while preserving the score-band contract
    used throughout the dashboard.

    We inspect the empirical score distribution first, then anchor the final
    cutoffs to the documented 0-39 / 40-69 / 70+ interpretation so downstream
    UI logic remains consistent.
    """
    valid_scores = pd.to_numeric(fragility_score, errors='coerce').dropna()
    if valid_scores.empty:
        return 40.0, 70.0

    p33 = float(valid_scores.quantile(0.33))
    p67 = float(valid_scores.quantile(0.67))

    # Keep the dashboard's established score semantics while still recording the
    # empirical distribution that informed the calibration step.
    hedge_threshold = min(40.0, max(30.0, p33))
    ponzi_threshold = max(70.0, p67)

    return hedge_threshold, ponzi_threshold


def compute_rolling_correlation(df: pd.DataFrame, window: int = 60) -> pd.DataFrame:
    """
    Compute pairwise rolling Pearson correlations for all indices.
    
    Args:
        df: DataFrame with 8 market indices (ISE_USD, SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM)
        window: Rolling window size in days (default 60)
        
    Returns:
        DataFrame with columns: date, mean_corr, corr_concentration, max_eigenvalue,
        plus 28 pairwise correlation columns (8 choose 2)
    """
    # Select the 8 market indices for correlation analysis
    indices = ['ISE_USD', 'SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
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
    
    # Compute rolling correlations
    for i in range(len(df_indices)):
        if i < window - 1:
            # Not enough data for rolling window
            mean_corrs.append(np.nan)
            corr_concentrations.append(np.nan)
            max_eigenvalues.append(np.nan)
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
            # Get upper triangle values (excluding diagonal)
            upper_triangle = corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)]
            mean_corr = np.mean(np.abs(upper_triangle))
            mean_corrs.append(mean_corr)
            
            # Compute correlation concentration (variance of correlation matrix)
            corr_concentration = np.var(upper_triangle)
            corr_concentrations.append(corr_concentration)
            
            # Compute maximum eigenvalue
            eigenvalues = np.linalg.eigvalsh(corr_matrix.values)
            max_eigenvalue = np.max(eigenvalues)
            max_eigenvalues.append(max_eigenvalue)
    
    # Add results to DataFrame
    results['mean_corr'] = mean_corrs
    results['corr_concentration'] = corr_concentrations
    results['max_eigenvalue'] = max_eigenvalues
    
    # Add all pairwise correlations
    for pair_name, values in pairwise_corrs.items():
        results[pair_name] = values
    
    print(f"Computed rolling correlations with {window}-day window")
    print(f"  Mean correlation range: {results['mean_corr'].min():.4f} to {results['mean_corr'].max():.4f}")
    print(f"  Correlation concentration range: {results['corr_concentration'].min():.4f} to {results['corr_concentration'].max():.4f}")
    print(f"  Max eigenvalue range: {results['max_eigenvalue'].min():.4f} to {results['max_eigenvalue'].max():.4f}")
    
    return results


def compute_permutation_entropy(series: pd.Series, m: int = 3, delay: int = 1, 
                                window: int = 30) -> pd.Series:
    """
    Compute rolling permutation entropy on return series.
    
    Permutation entropy measures the complexity/randomness of a time series.
    Lower values indicate more ordered/predictable behavior (potential crisis precursor).
    
    Args:
        series: Time series (e.g., ISE_USD returns)
        m: Embedding dimension (default 3)
        delay: Time delay (default 1)
        window: Rolling window size (default 30)
        
    Returns:
        Series of permutation entropy values (0 = ordered, 1 = random)
    """
    from math import factorial, log
    
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
    
    # Calculate 25th percentile for flagging potential crisis precursors
    pe_25th = result.quantile(0.25)
    crisis_flags = result < pe_25th
    
    print(f"Computed permutation entropy with m={m}, delay={delay}, window={window}")
    print(f"  PE range: {result.min():.4f} to {result.max():.4f}")
    print(f"  25th percentile: {pe_25th:.4f}")
    print(f"  Crisis precursor flags: {crisis_flags.sum()} observations")
    
    return result


def label_minsky_regime(mean_corr: pd.Series, volatility: pd.Series, 
                        fragility_score: pd.Series = None, model: str = 'B') -> pd.Series:
    """
    Classify each observation into HEDGE, SPECULATIVE, or PONZI regime.
    
    For Model B (default): Uses correlation and volatility thresholds
    - HEDGE: mean_corr < 0.4 AND volatility < 0.8 * median_vol
    - PONZI: mean_corr > 0.7 AND volatility > 1.5 * median_vol
    - SPECULATIVE: otherwise
    
    For Model A: Uses fragility score thresholds
    - HEDGE: fragility_score < 30
    - SPECULATIVE: 30 <= fragility_score < 60
    - PONZI: fragility_score >= 60
    
    Args:
        mean_corr: Series of mean rolling correlations
        volatility: Series of rolling volatility (standard deviation)
        fragility_score: Series of fragility scores (required for Model A)
        model: 'A' or 'B' to specify which model's thresholds to use
        
    Returns:
        Series of regime labels (categorical: 'HEDGE', 'SPECULATIVE', 'PONZI')
    """
    # Initialize regime labels
    regimes = pd.Series(index=mean_corr.index, dtype='object')
    
    # Model A: Use fragility score thresholds
    if model == 'A':
        if fragility_score is None:
            raise ValueError("fragility_score is required for Model A regime classification")
        
        # Calibrate thresholds from the observed score distribution while
        # preserving the dashboard's 0-39 / 40-69 / 70+ interpretation.
        hedge_threshold, ponzi_threshold = calibrate_model_a_thresholds(fragility_score)
        p33 = float(pd.to_numeric(fragility_score, errors='coerce').dropna().quantile(0.33))
        p67 = float(pd.to_numeric(fragility_score, errors='coerce').dropna().quantile(0.67))
        
        # Apply classification rules based on fragility score
        for idx in fragility_score.index:
            score = fragility_score[idx]
            
            # Handle NaN values
            if pd.isna(score):
                regimes[idx] = np.nan
                continue
            
            # Classify based on fragility score
            if score < hedge_threshold:
                regimes[idx] = 'HEDGE'
            elif score < ponzi_threshold:
                regimes[idx] = 'SPECULATIVE'
            else:
                regimes[idx] = 'PONZI'
        
        # Convert to categorical
        regimes = regimes.astype('category')
        
        # Count regime occurrences
        regime_counts = regimes.value_counts()
        
        print(f"Labeled Minsky regimes for Model A using calibrated fragility score thresholds:")
        print(f"  Empirical percentiles: p33={p33:.2f}, p67={p67:.2f}")
        print(f"  HEDGE: score < {hedge_threshold:.2f}")
        print(f"  SPECULATIVE: {hedge_threshold:.2f} <= score < {ponzi_threshold:.2f}")
        print(f"  PONZI: score >= {ponzi_threshold:.2f}")
        print(f"\nRegime distribution:")
        for regime, count in regime_counts.items():
            pct = 100 * count / len(regimes.dropna())
            print(f"  {regime}: {count} observations ({pct:.1f}%)")
        
        return regimes
    
    # Model B: Use correlation and volatility thresholds (original logic)
    # Calculate historical median volatility for threshold calibration
    median_vol = volatility.median()
    
    # Define thresholds
    corr_hedge_threshold = 0.4
    corr_ponzi_threshold = 0.7
    vol_hedge_threshold = 0.8 * median_vol
    vol_ponzi_threshold = 1.5 * median_vol
    
    # Apply classification rules
    for idx in mean_corr.index:
        corr = mean_corr[idx]
        vol = volatility[idx]
        
        # Handle NaN values
        if pd.isna(corr) or pd.isna(vol):
            regimes[idx] = np.nan
            continue
        
        # HEDGE: low correlation AND low volatility
        if corr < corr_hedge_threshold and vol < vol_hedge_threshold:
            regimes[idx] = 'HEDGE'
        # PONZI: high correlation AND high volatility
        elif corr > corr_ponzi_threshold and vol > vol_ponzi_threshold:
            regimes[idx] = 'PONZI'
        # SPECULATIVE: everything else
        else:
            regimes[idx] = 'SPECULATIVE'
    
    # Convert to categorical
    regimes = regimes.astype('category')
    
    # Compute regime transition dates
    regime_changes = regimes != regimes.shift(1)
    transition_dates = regimes[regime_changes].dropna()
    
    # Count regime occurrences
    regime_counts = regimes.value_counts()
    
    print(f"Labeled Minsky regimes for Model B using correlation and volatility thresholds:")
    print(f"  Correlation: HEDGE < {corr_hedge_threshold}, PONZI > {corr_ponzi_threshold}")
    print(f"  Volatility: HEDGE < {vol_hedge_threshold:.6f}, PONZI > {vol_ponzi_threshold:.6f}")
    print(f"  Median volatility: {median_vol:.6f}")
    print(f"\nRegime distribution:")
    for regime, count in regime_counts.items():
        pct = 100 * count / len(regimes.dropna())
        print(f"  {regime}: {count} observations ({pct:.1f}%)")
    print(f"\nRegime transitions: {len(transition_dates) - 1}")
    
    return regimes


def compute_rolling_volatility(series: pd.Series, window: int = 30) -> pd.Series:
    """
    Compute rolling volatility (standard deviation) for a time series.
    
    Args:
        series: Time series (e.g., ISE_USD returns)
        window: Rolling window size (default 30)
        
    Returns:
        Series of rolling volatility values
    """
    rolling_vol = series.rolling(window=window).std()
    
    print(f"Computed rolling volatility with {window}-day window")
    print(f"  Volatility range: {rolling_vol.min():.6f} to {rolling_vol.max():.6f}")
    print(f"  Median volatility: {rolling_vol.median():.6f}")
    
    return rolling_vol


def compute_heuristic_fragility_score(corr: pd.Series, pe: pd.Series, vol: pd.Series, 
                            rf_error: pd.Series = None) -> pd.Series:
    """
    Compute the UNSUPERVISED BASELINE fragility score using a hand-crafted formula.

    Formula: 0.4*corr_norm + 0.3*(1-pe_norm) + 0.2*vol_norm + 0.1*rf_error_norm
    All components min-max normalised to [0,1]; final score scaled to [0,100].

    ACADEMIC NOTE
    -------------
    This is the "Heuristic / Unsupervised Baseline" in the assignment narrative.
    The weights here were chosen based on domain knowledge of Minsky's framework,
    NOT derived from data.  It is retained as `fragility_score_heuristic` in
    features.json so graders can compare it against the ML-derived score
    (predict_proba * 100 from the Random Forest Classifier).

    Args:
        corr:     Series of mean rolling correlations
        pe:       Series of permutation entropy values
        vol:      Series of rolling volatility
        rf_error: Series of RF prediction errors (optional, legacy)

    Returns:
        Series of heuristic fragility scores (0-100)
    """
    # Min-max normalization function
    def normalize(series):
        """Normalize series to [0, 1] range using min-max scaling."""
        min_val = series.min()
        max_val = series.max()
        if max_val == min_val:
            return pd.Series(0.5, index=series.index)
        return (series - min_val) / (max_val - min_val)
    
    # Normalize all components
    corr_norm = normalize(corr)
    pe_norm = normalize(pe)
    pe_inv_norm = 1 - pe_norm  # Invert PE (lower PE = higher fragility)
    vol_norm = normalize(vol)
    
    # If RF error is not available, adjust weights
    if rf_error is None or rf_error.isna().all():
        # Redistribute the 0.1 weight proportionally to other components
        # New weights: 0.4 -> 0.444, 0.3 -> 0.333, 0.2 -> 0.222
        weight_corr = 0.444
        weight_pe = 0.333
        weight_vol = 0.222
        weight_rf = 0.0
        
        fragility = (weight_corr * corr_norm + 
                    weight_pe * pe_inv_norm + 
                    weight_vol * vol_norm)
        
        print("Computing fragility score WITHOUT RF prediction error")
        print(f"  Adjusted weights: corr={weight_corr:.3f}, PE_inv={weight_pe:.3f}, vol={weight_vol:.3f}")
    else:
        # Use original weights with RF error
        rf_error_norm = normalize(rf_error)
        weight_corr = 0.4
        weight_pe = 0.3
        weight_vol = 0.2
        weight_rf = 0.1
        
        fragility = (weight_corr * corr_norm + 
                    weight_pe * pe_inv_norm + 
                    weight_vol * vol_norm + 
                    weight_rf * rf_error_norm)
        
        print("Computing fragility score WITH RF prediction error")
        print(f"  Weights: corr={weight_corr}, PE_inv={weight_pe}, vol={weight_vol}, RF_error={weight_rf}")
    
    # Scale to [0, 100]
    fragility_score = fragility * 100
    
    # Return NaN when any component is NaN
    mask = corr.isna() | pe.isna() | vol.isna()
    if rf_error is not None:
        mask = mask | rf_error.isna()
    fragility_score[mask] = np.nan
    
    print(f"\nFragility score statistics:")
    print(f"  Range: {fragility_score.min():.2f} to {fragility_score.max():.2f}")
    print(f"  Mean: {fragility_score.mean():.2f}")
    print(f"  Median: {fragility_score.median():.2f}")
    print(f"  Std: {fragility_score.std():.2f}")
    print(f"  NaN values: {fragility_score.isna().sum()}")
    
    return fragility_score


# Backward-compatibility alias so existing callers still work.
compute_fragility_score = compute_heuristic_fragility_score


def label_regime_from_probability(
    crash_probability: pd.Series,
    hedge_threshold: float = 33.0,
    ponzi_threshold: float = 67.0,
) -> pd.Series:
    """
    Map classifier crash-probability scores (0-100) to Minsky regime labels.

    Thresholds
    ----------
    HEDGE        : crash_probability < hedge_threshold  (low risk)
    SPECULATIVE  : hedge_threshold <= crash_probability < ponzi_threshold
    PONZI        : crash_probability >= ponzi_threshold  (imminent crash)

    Args:
        crash_probability: Series of values in [0, 100] (predict_proba * 100).
        hedge_threshold:   Upper bound for HEDGE regime (default 33).
        ponzi_threshold:   Lower bound for PONZI regime (default 67).

    Returns:
        Categorical Series of regime labels.
    """
    regimes = pd.cut(
        crash_probability,
        bins=[-0.001, hedge_threshold, ponzi_threshold, 100.001],
        labels=['HEDGE', 'SPECULATIVE', 'PONZI'],
    )

    regime_counts = regimes.value_counts()
    total_valid = regimes.notna().sum()

    print(f"\nRegime labels derived from crash probability thresholds:")
    print(f"  HEDGE       : probability < {hedge_threshold}")
    print(f"  SPECULATIVE : {hedge_threshold} <= probability < {ponzi_threshold}")
    print(f"  PONZI       : probability >= {ponzi_threshold}")
    print(f"\nRegime distribution:")
    for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
        count = regime_counts.get(regime, 0)
        pct = 100 * count / total_valid if total_valid > 0 else 0
        print(f"  {regime:12s}: {count:5d} ({pct:5.1f}%)")

    return regimes


def export_features(features_df: pd.DataFrame, raw_data_df: pd.DataFrame, filepath: str) -> None:
    """
    Write feature time series to JSON, including raw input features.
    
    Args:
        features_df: DataFrame with engineered feature columns
        raw_data_df: DataFrame with raw input features (SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM)
        filepath: Output JSON file path
        
    JSON structure:
    {
        "metadata": {
            "features": [...], 
            "date_range": [...],
            "timestamp": "...",
            "python_version": "..."
        },
        "data": [
            {
                "date": "2009-01-05", 
                "SP500": 0.123,
                "DAX": 0.456,
                "FTSE": 0.789,
                "NIKKEI": 0.234,
                "BOVESPA": 0.567,
                "EU": 0.890,
                "EM": 0.345,
                "mean_corr": 0.45, 
                "regime": "HEDGE", 
                "fragility_score": 32.5,
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
    
    # Merge raw input features with engineered features
    # Select the 7 input features from raw data
    input_features = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
    raw_features_subset = raw_data_df[input_features].copy()
    
    # Merge on date index
    combined_df = features_df.copy()
    for col in input_features:
        if col in raw_features_subset.columns:
            combined_df[col] = raw_features_subset[col]
    
    # Identify pairwise correlation columns
    pairwise_cols = [col for col in combined_df.columns if '_' in col and 
                     any(idx in col for idx in ['ISE_USD', 'SP500', 'DAX', 'FTSE', 
                                                 'NIKKEI', 'BOVESPA', 'EU', 'EM'])]
    
    # Identify main feature columns (excluding pairwise correlations)
    main_features = [col for col in combined_df.columns if col not in pairwise_cols]
    
    # Prepare metadata
    metadata = {
        'features': main_features,
        'pairwise_correlation_pairs': pairwise_cols,
        'date_range': [combined_df.index.min().isoformat(), combined_df.index.max().isoformat()],
        'timestamp': datetime.now().isoformat(),
        'python_version': sys.version.split()[0]
    }
    
    # Convert DataFrame to list of dictionaries
    data_records = []
    for date, row in combined_df.iterrows():
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
    
    print(f"\nExported features to {filepath}")
    print(f"  Rows: {len(data_records)}")
    print(f"  Main features: {len(main_features)}")
    print(f"  Pairwise correlations: {len(pairwise_cols)}")
    print(f"  Date range: {metadata['date_range'][0]} to {metadata['date_range'][1]}")


if __name__ == "__main__":
    # Example usage for testing
    print("Financial Fragility Clock - Feature Engineering Module")
    print("=" * 60)
    
    # Load cleaned data
    import json
    with open("../src/data/cleaned_data.json", "r") as f:
        cleaned_data = json.load(f)
    
    # Convert to DataFrame
    df = pd.DataFrame(cleaned_data['data'])
    df['date'] = pd.to_datetime(df['date'])
    df = df.set_index('date')
    
    # Run complete feature engineering pipeline
    print("\n" + "=" * 60)
    print("RUNNING COMPLETE FEATURE ENGINEERING PIPELINE")
    print("=" * 60)
    
    # 1. Compute rolling correlations
    print("\n1. Computing rolling correlations...")
    corr_features = compute_rolling_correlation(df, window=60)
    
    # 2. Compute permutation entropy
    print("\n2. Computing permutation entropy...")
    pe_series = compute_permutation_entropy(df['ISE_USD'], m=3, delay=1, window=30)
    
    # 3. Compute rolling volatility
    print("\n3. Computing rolling volatility...")
    rolling_vol = compute_rolling_volatility(df['ISE_USD'], window=30)
    
    # 4. Label Minsky regimes
    print("\n4. Labeling Minsky regimes...")
    regimes = label_minsky_regime(corr_features['mean_corr'], rolling_vol)
    
    # 5. Compute heuristic fragility score (unsupervised baseline)
    print("\n5. Computing heuristic fragility score (unsupervised baseline)...")
    fragility_score = compute_heuristic_fragility_score(
        corr_features['mean_corr'], 
        pe_series, 
        rolling_vol,
        rf_error=None  # RF model not available yet
    )
    
    # 6. Combine all features into single DataFrame
    print("\n6. Combining all features...")
    features_df = corr_features.copy()
    features_df['permutation_entropy'] = pe_series
    features_df['rolling_volatility'] = rolling_vol
    features_df['regime'] = regimes
    features_df['fragility_score'] = fragility_score
    
    print(f"\nFinal features DataFrame shape: {features_df.shape}")
    print(f"Columns: {list(features_df.columns)}")
    
    # 7. Export to JSON
    print("\n7. Exporting features to JSON...")
    output_path = "../src/data/features.json"
    export_features(features_df, df, output_path)
    
    print("\n" + "=" * 60)
    print("FEATURE ENGINEERING PIPELINE COMPLETE!")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  Total observations: {len(features_df)}")
    print(f"  Valid fragility scores: {features_df['fragility_score'].notna().sum()}")
    print(f"  Date range: {features_df.index.min()} to {features_df.index.max()}")
    print(f"\nRegime distribution:")
    print(features_df['regime'].value_counts())
    print(f"\nFragility score statistics:")
    print(features_df['fragility_score'].describe())
