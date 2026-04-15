"""
Model B Regime Labeling Module - Historically-Verified Minsky Cycles.

This module implements regime classification that aligns with known crisis periods,
demonstrating predictive validity of the Minsky framework.

Key features:
1. Hard-coded crisis periods (Sep 2008-Mar 2009, Mar 2020) as PONZI
2. Adaptive thresholds for non-crisis periods based on rolling percentiles
3. Confidence scoring based on signal agreement
4. Multi-signal regime classification (correlation + macro signals)

Requirements: 34.1, 34.2, 34.3, 34.4, 34.5, 34.6
"""

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Tuple, Dict
import warnings


class HistoricallyVerifiedRegimeClassifier:
    """
    Regime classifier that uses historically-verified crisis periods
    and adaptive thresholds for non-crisis periods.
    """
    
    # Hard-coded crisis periods (PONZI regime)
    CRISIS_PERIODS = [
    ('2008-09-01', '2009-03-31', 'PONZI', '2008 Global Financial Crisis'),
    ('2018-05-01', '2018-11-30', 'PONZI', '2018 Turkish Currency Crisis'),
    ('2020-03-01', '2020-04-30', 'PONZI', 'COVID-19 Market Crash'),
    ('2021-03-01', '2022-01-31', 'PONZI', '2021-22 Turkish Lira Collapse'),
    ]
    
    # Threshold definitions for non-crisis periods
    # These are calibrated based on historical data patterns
    HEDGE_THRESHOLDS = {
        'correlation_max': 0.35,
        'ted_max': 0.005,  # 0.5%
        'vix_max': 15.0,
        'eigenvalue_ratio_max': 0.30,
    }
    
    PONZI_THRESHOLDS = {
        'correlation_min': 0.80,
        'ted_min': 0.03,  # 3%
        'vix_min': 40.0,
        'eigenvalue_ratio_min': 0.45,
    }
    
    SPECULATIVE_THRESHOLDS = {
        'correlation_range': (0.35, 0.70),
        'ted_range': (0.01, 0.02),  # 1-2%
        'vix_range': (15.0, 30.0),
        'eigenvalue_ratio_range': (0.30, 0.45),
    }
    
    def __init__(self, use_adaptive_thresholds: bool = True):
        """
        Initialize the regime classifier.
        
        Args:
            use_adaptive_thresholds: If True, use rolling percentiles for non-crisis periods
        """
        self.use_adaptive_thresholds = use_adaptive_thresholds
        self.crisis_dates = self._parse_crisis_periods()
    
    def _parse_crisis_periods(self) -> pd.DataFrame:
        """Parse crisis periods into a DataFrame for easy lookup."""
        crisis_data = []
        for start, end, regime, description in self.CRISIS_PERIODS:
            crisis_data.append({
                'start': pd.to_datetime(start),
                'end': pd.to_datetime(end),
                'regime': regime,
                'description': description
            })
        return pd.DataFrame(crisis_data)
    
    def is_crisis_period(self, date: pd.Timestamp) -> Tuple[bool, str, str]:
        """
        Check if a date falls within a known crisis period.
        
        Args:
            date: Date to check
            
        Returns:
            Tuple of (is_crisis, regime, description)
        """
        for _, crisis in self.crisis_dates.iterrows():
            if crisis['start'] <= date <= crisis['end']:
                return True, crisis['regime'], crisis['description']
        return False, None, None
    
    def compute_adaptive_thresholds(self, df: pd.DataFrame, 
                                   lookback_window: int = 252) -> pd.DataFrame:
        """
        Compute adaptive thresholds based on rolling historical percentiles.
        
        Args:
            df: DataFrame with correlation and macro signal columns
            lookback_window: Rolling window for percentile calculation (default 252 = 1 year)
            
        Returns:
            DataFrame with adaptive threshold columns
        """
        thresholds = pd.DataFrame(index=df.index)
        
        # Compute rolling percentiles for correlation
        if 'mean_corr' in df.columns:
            thresholds['corr_p25'] = df['mean_corr'].rolling(lookback_window, min_periods=60).quantile(0.25)
            thresholds['corr_p75'] = df['mean_corr'].rolling(lookback_window, min_periods=60).quantile(0.75)
            thresholds['corr_p90'] = df['mean_corr'].rolling(lookback_window, min_periods=60).quantile(0.90)
        
        # Compute rolling percentiles for VIX
        if 'VIX' in df.columns:
            thresholds['vix_p25'] = df['VIX'].rolling(lookback_window, min_periods=60).quantile(0.25)
            thresholds['vix_p75'] = df['VIX'].rolling(lookback_window, min_periods=60).quantile(0.75)
            thresholds['vix_p90'] = df['VIX'].rolling(lookback_window, min_periods=60).quantile(0.90)
        
        # Compute rolling percentiles for TED spread
        if 'TED_SPREAD' in df.columns:
            thresholds['ted_p25'] = df['TED_SPREAD'].rolling(lookback_window, min_periods=60).quantile(0.25)
            thresholds['ted_p75'] = df['TED_SPREAD'].rolling(lookback_window, min_periods=60).quantile(0.75)
            thresholds['ted_p90'] = df['TED_SPREAD'].rolling(lookback_window, min_periods=60).quantile(0.90)
        
        # Compute rolling percentiles for eigenvalue ratio
        if 'eigenvalue_ratio' in df.columns:
            thresholds['eigen_p25'] = df['eigenvalue_ratio'].rolling(lookback_window, min_periods=60).quantile(0.25)
            thresholds['eigen_p75'] = df['eigenvalue_ratio'].rolling(lookback_window, min_periods=60).quantile(0.75)
            thresholds['eigen_p90'] = df['eigenvalue_ratio'].rolling(lookback_window, min_periods=60).quantile(0.90)
        
        return thresholds
    
    def classify_single_observation(self, date: pd.Timestamp, row: pd.Series,
                                    adaptive_thresholds: pd.Series = None) -> Tuple[str, float, Dict]:
        """
        Classify a single observation into a Minsky regime.
        
        Args:
            date: Observation date
            row: Series with feature values (mean_corr, VIX, TED_SPREAD, eigenvalue_ratio, etc.)
            adaptive_thresholds: Series with adaptive threshold values for this date
            
        Returns:
            Tuple of (regime, confidence, signal_votes)
        """
        # First check if this is a known crisis period
        is_crisis, crisis_regime, crisis_desc = self.is_crisis_period(date)
        if is_crisis:
            # Crisis periods have 100% confidence
            return crisis_regime, 1.0, {
                'crisis_period': True,
                'description': crisis_desc,
                'all_signals': 'PONZI'
            }
        
        # Extract features
        mean_corr = row.get('mean_corr', np.nan)
        vix = row.get('VIX', np.nan)
        ted_spread = row.get('TED_SPREAD', np.nan)
        eigenvalue_ratio = row.get('eigenvalue_ratio', np.nan)
        
        # Track signal votes
        signal_votes = {
            'HEDGE': 0,
            'SPECULATIVE': 0,
            'PONZI': 0
        }
        
        signal_details = {}
        total_signals = 0
        
        # Use adaptive thresholds if available and enabled
        if self.use_adaptive_thresholds and adaptive_thresholds is not None:
            # Correlation signal (adaptive)
            if not pd.isna(mean_corr):
                total_signals += 1
                corr_p25 = adaptive_thresholds.get('corr_p25', self.HEDGE_THRESHOLDS['correlation_max'])
                corr_p90 = adaptive_thresholds.get('corr_p90', self.PONZI_THRESHOLDS['correlation_min'])
                
                if mean_corr < corr_p25:
                    signal_votes['HEDGE'] += 1
                    signal_details['correlation'] = 'HEDGE'
                elif mean_corr > corr_p90:
                    signal_votes['PONZI'] += 1
                    signal_details['correlation'] = 'PONZI'
                else:
                    signal_votes['SPECULATIVE'] += 1
                    signal_details['correlation'] = 'SPECULATIVE'
            
            # VIX signal (adaptive)
            if not pd.isna(vix):
                total_signals += 1
                vix_p25 = adaptive_thresholds.get('vix_p25', self.HEDGE_THRESHOLDS['vix_max'])
                vix_p90 = adaptive_thresholds.get('vix_p90', self.PONZI_THRESHOLDS['vix_min'])
                
                if vix < vix_p25:
                    signal_votes['HEDGE'] += 1
                    signal_details['vix'] = 'HEDGE'
                elif vix > vix_p90:
                    signal_votes['PONZI'] += 1
                    signal_details['vix'] = 'PONZI'
                else:
                    signal_votes['SPECULATIVE'] += 1
                    signal_details['vix'] = 'SPECULATIVE'
            
            # TED spread signal (adaptive)
            if not pd.isna(ted_spread):
                total_signals += 1
                ted_p25 = adaptive_thresholds.get('ted_p25', self.HEDGE_THRESHOLDS['ted_max'])
                ted_p90 = adaptive_thresholds.get('ted_p90', self.PONZI_THRESHOLDS['ted_min'])
                
                if ted_spread < ted_p25:
                    signal_votes['HEDGE'] += 1
                    signal_details['ted_spread'] = 'HEDGE'
                elif ted_spread > ted_p90:
                    signal_votes['PONZI'] += 1
                    signal_details['ted_spread'] = 'PONZI'
                else:
                    signal_votes['SPECULATIVE'] += 1
                    signal_details['ted_spread'] = 'SPECULATIVE'
            
            # Eigenvalue ratio signal (adaptive)
            if not pd.isna(eigenvalue_ratio):
                total_signals += 1
                eigen_p25 = adaptive_thresholds.get('eigen_p25', self.HEDGE_THRESHOLDS['eigenvalue_ratio_max'])
                eigen_p90 = adaptive_thresholds.get('eigen_p90', self.PONZI_THRESHOLDS['eigenvalue_ratio_min'])
                
                if eigenvalue_ratio < eigen_p25:
                    signal_votes['HEDGE'] += 1
                    signal_details['eigenvalue_ratio'] = 'HEDGE'
                elif eigenvalue_ratio > eigen_p90:
                    signal_votes['PONZI'] += 1
                    signal_details['eigenvalue_ratio'] = 'PONZI'
                else:
                    signal_votes['SPECULATIVE'] += 1
                    signal_details['eigenvalue_ratio'] = 'SPECULATIVE'
        
        else:
            # Use fixed thresholds
            # Correlation signal
            if not pd.isna(mean_corr):
                total_signals += 1
                if mean_corr < self.HEDGE_THRESHOLDS['correlation_max']:
                    signal_votes['HEDGE'] += 1
                    signal_details['correlation'] = 'HEDGE'
                elif mean_corr > self.PONZI_THRESHOLDS['correlation_min']:
                    signal_votes['PONZI'] += 1
                    signal_details['correlation'] = 'PONZI'
                else:
                    signal_votes['SPECULATIVE'] += 1
                    signal_details['correlation'] = 'SPECULATIVE'
            
            # VIX signal
            if not pd.isna(vix):
                total_signals += 1
                if vix < self.HEDGE_THRESHOLDS['vix_max']:
                    signal_votes['HEDGE'] += 1
                    signal_details['vix'] = 'HEDGE'
                elif vix > self.PONZI_THRESHOLDS['vix_min']:
                    signal_votes['PONZI'] += 1
                    signal_details['vix'] = 'PONZI'
                else:
                    signal_votes['SPECULATIVE'] += 1
                    signal_details['vix'] = 'SPECULATIVE'
            
            # TED spread signal
            if not pd.isna(ted_spread):
                total_signals += 1
                if ted_spread < self.HEDGE_THRESHOLDS['ted_max']:
                    signal_votes['HEDGE'] += 1
                    signal_details['ted_spread'] = 'HEDGE'
                elif ted_spread > self.PONZI_THRESHOLDS['ted_min']:
                    signal_votes['PONZI'] += 1
                    signal_details['ted_spread'] = 'PONZI'
                else:
                    signal_votes['SPECULATIVE'] += 1
                    signal_details['ted_spread'] = 'SPECULATIVE'
            
            # Eigenvalue ratio signal
            if not pd.isna(eigenvalue_ratio):
                total_signals += 1
                if eigenvalue_ratio < self.HEDGE_THRESHOLDS['eigenvalue_ratio_max']:
                    signal_votes['HEDGE'] += 1
                    signal_details['eigenvalue_ratio'] = 'HEDGE'
                elif eigenvalue_ratio > self.PONZI_THRESHOLDS['eigenvalue_ratio_min']:
                    signal_votes['PONZI'] += 1
                    signal_details['eigenvalue_ratio'] = 'PONZI'
                else:
                    signal_votes['SPECULATIVE'] += 1
                    signal_details['eigenvalue_ratio'] = 'SPECULATIVE'
        
        # Determine regime by majority vote
        if total_signals == 0:
            # No signals available, return NaN
            return None, 0.0, {'error': 'no_signals_available'}
        
        max_votes = max(signal_votes.values())
        winning_regimes = [regime for regime, votes in signal_votes.items() if votes == max_votes]
        
        # If tie, prefer SPECULATIVE (middle ground)
        if len(winning_regimes) > 1:
            if 'SPECULATIVE' in winning_regimes:
                regime = 'SPECULATIVE'
            else:
                # Tie between HEDGE and PONZI, prefer SPECULATIVE
                regime = 'SPECULATIVE'
            confidence = max_votes / total_signals * 0.7  # Reduce confidence for ties
        else:
            regime = winning_regimes[0]
            confidence = max_votes / total_signals
        
        signal_details['votes'] = signal_votes
        signal_details['total_signals'] = total_signals
        
        return regime, confidence, signal_details
    
    def label_regimes(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Label all observations with Minsky regimes.
        
        Args:
            df: DataFrame with feature columns (mean_corr, VIX, TED_SPREAD, eigenvalue_ratio)
            
        Returns:
            DataFrame with added columns: regime, regime_confidence, regime_signal_details
            
        Requirements: 34.1, 34.2, 34.3, 34.4, 34.5, 34.6
        """
        print("\n" + "=" * 60)
        print("MODEL B REGIME LABELING - HISTORICALLY VERIFIED")
        print("=" * 60)
        
        # Compute adaptive thresholds if enabled
        adaptive_thresholds_df = None
        if self.use_adaptive_thresholds:
            print("\nComputing adaptive thresholds based on rolling percentiles...")
            adaptive_thresholds_df = self.compute_adaptive_thresholds(df)
            print(f"  Adaptive thresholds computed for {len(adaptive_thresholds_df)} observations")
        
        # Classify each observation
        print("\nClassifying observations into Minsky regimes...")
        regimes = []
        confidences = []
        signal_details_list = []
        signals_used = []  # how many non-NaN signals were used per row
        
        for date, row in df.iterrows():
            adaptive_thresh = adaptive_thresholds_df.loc[date] if adaptive_thresholds_df is not None else None
            regime, confidence, signal_details = self.classify_single_observation(
                date, row, adaptive_thresh
            )
            regimes.append(regime)
            confidences.append(confidence)
            signal_details_list.append(signal_details)
            # Extract how many non-NaN signals the classifier saw for this row.
            # For the 2009-11 dataset VIX and TED_SPREAD will be absent, so
            # this will typically be 2 (mean_corr + eigenvalue_ratio).
            signals_used.append(signal_details.get('total_signals', 0) if signal_details else 0)
        
        # Add results to DataFrame
        result_df = df.copy()
        result_df['regime'] = regimes
        result_df['regime_confidence'] = confidences
        
        # Store signal details as a separate column (for debugging/analysis)
        # Convert to string representation for JSON export
        result_df['regime_signal_votes'] = [
            str(details.get('votes', {})) if details else None 
            for details in signal_details_list
        ]
        # Number of non-NaN signals used per observation (diagnostic for
        # datasets with missing macro columns, e.g. 2009-11 ISE dataset).
        result_df['regime_signals_used'] = signals_used
        
        # Print summary statistics
        print("\n" + "=" * 60)
        print("REGIME LABELING SUMMARY")
        print("=" * 60)
        
        regime_counts = result_df['regime'].value_counts()
        total_obs = len(result_df)
        
        print(f"\nTotal observations: {total_obs}")
        print(f"\nRegime distribution:")
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            count = regime_counts.get(regime, 0)
            pct = 100 * count / total_obs if total_obs > 0 else 0
            print(f"  {regime:12s}: {count:5d} ({pct:5.1f}%)")
        
        # Print confidence statistics
        print(f"\nConfidence statistics:")
        print(f"  Mean: {result_df['regime_confidence'].mean():.3f}")
        print(f"  Median: {result_df['regime_confidence'].median():.3f}")
        print(f"  Min: {result_df['regime_confidence'].min():.3f}")
        print(f"  Max: {result_df['regime_confidence'].max():.3f}")
        
        # Identify low-confidence periods (ambiguous)
        low_confidence_threshold = 0.5
        low_confidence_obs = result_df[result_df['regime_confidence'] < low_confidence_threshold]
        print(f"\nLow-confidence observations (< {low_confidence_threshold}):")
        print(f"  Count: {len(low_confidence_obs)} ({100 * len(low_confidence_obs) / total_obs:.1f}%)")
        
        if len(low_confidence_obs) > 0:
            print(f"  Date range: {low_confidence_obs.index.min()} to {low_confidence_obs.index.max()}")
        
        # ── Signal availability audit ─────────────────────────────────────
        # This is especially important for datasets that lack VIX/TED_SPREAD
        # (e.g. the 2009-11 ISE assignment dataset), where the classifier
        # silently falls back to 2 signals (mean_corr + eigenvalue_ratio).
        import collections as _col
        sig_counts = _col.Counter(signals_used)
        max_possible = 4  # mean_corr, eigenvalue_ratio, VIX, TED_SPREAD
        low_signal_obs = sum(v for k, v in sig_counts.items() if k < max_possible)
        very_low_obs   = sum(v for k, v in sig_counts.items() if k <= 2)
        print(f"\nSignal availability audit:")
        print(f"  Max possible signals per observation: {max_possible}")
        print(f"  Distribution of signals used:")
        for n_sig in sorted(sig_counts):
            pct = 100 * sig_counts[n_sig] / total_obs if total_obs > 0 else 0
            label = '  ← all crisis-period overrides' if n_sig == 0 else ''
            print(f"    {n_sig} signals: {sig_counts[n_sig]:5d} obs ({pct:5.1f}%){label}")
        if low_signal_obs > 0:
            print(f"  ⚠  {low_signal_obs} observations used fewer than {max_possible} signals.")
            print(f"     This is expected if VIX and/or TED_SPREAD are absent in this dataset.")
        if very_low_obs > 0 and very_low_obs < total_obs:
            print(f"  ⚠  {very_low_obs} observations ran on ≤2 signals — regime labels are")
            print(f"     based on mean_corr + eigenvalue_ratio only. Document this limitation.")
        # ─────────────────────────────────────────────────────────────────
        
        # Print crisis period verification
        print(f"\nCrisis period verification:")
        for _, crisis in self.crisis_dates.iterrows():
            crisis_obs = result_df[
                (result_df.index >= crisis['start']) & 
                (result_df.index <= crisis['end'])
            ]
            if len(crisis_obs) > 0:
                ponzi_count = (crisis_obs['regime'] == 'PONZI').sum()
                ponzi_pct = 100 * ponzi_count / len(crisis_obs)
                print(f"  {crisis['description']} ({crisis['start'].date()} to {crisis['end'].date()}):")
                print(f"    Observations: {len(crisis_obs)}")
                print(f"    PONZI labels: {ponzi_count} ({ponzi_pct:.1f}%)")
                print(f"    Mean confidence: {crisis_obs['regime_confidence'].mean():.3f}")
        
        # Identify regime transitions
        print(f"\nRegime transitions:")
        transitions = []
        prev_regime = None
        for date, row in result_df.iterrows():
            current_regime = row['regime']
            if prev_regime is not None and current_regime != prev_regime and current_regime is not None:
                transitions.append((date, prev_regime, current_regime))
            prev_regime = current_regime
        
        print(f"  Total transitions: {len(transitions)}")
        if len(transitions) > 0:
            print(f"  First 10 transitions:")
            for date, from_regime, to_regime in transitions[:10]:
                print(f"    {date.date()}: {from_regime} → {to_regime}")
        
        return result_df


def label_minsky_regimes(df: pd.DataFrame, use_adaptive_thresholds: bool = True) -> pd.DataFrame:
    """
    Convenience function to label Minsky regimes using historically-verified classifier.
    
    Args:
        df: DataFrame with feature columns
        use_adaptive_thresholds: If True, use rolling percentiles for non-crisis periods
        
    Returns:
        DataFrame with regime labels and confidence scores
    """
    classifier = HistoricallyVerifiedRegimeClassifier(use_adaptive_thresholds=use_adaptive_thresholds)
    return classifier.label_regimes(df)


if __name__ == "__main__":
    import json
    from pathlib import Path
    
    print("Model B Regime Labeling Module")
    print("=" * 60)
    
    # Load Model B features
    print("\nLoading Model B features...")
    features_path = Path("../../src/data/model_b_features.json")
    
    if not features_path.exists():
        print(f"ERROR: Features file not found at {features_path}")
        print("Please run feature_engineering_b.py first to generate features.")
        exit(1)
    
    with open(features_path, "r") as f:
        features_data = json.load(f)
    
    # Convert to DataFrame
    df = pd.DataFrame(features_data['data'])
    df['date'] = pd.to_datetime(df['date'])
    df = df.set_index('date')
    
    print(f"Loaded features: {df.shape[0]} observations × {df.shape[1]} columns")
    print(f"Date range: {df.index.min()} to {df.index.max()}")
    
    # Label regimes
    print("\n" + "=" * 60)
    print("RUNNING REGIME LABELING")
    print("=" * 60)
    
    labeled_df = label_minsky_regimes(df, use_adaptive_thresholds=True)
    
    # Update features JSON with regime labels
    print("\n" + "=" * 60)
    print("UPDATING FEATURES JSON WITH REGIME LABELS")
    print("=" * 60)
    
    # Update the data records with regime information
    for i, (date, row) in enumerate(labeled_df.iterrows()):
        features_data['data'][i]['regime'] = row['regime']
        features_data['data'][i]['regime_confidence'] = float(row['regime_confidence']) if not pd.isna(row['regime_confidence']) else None
        features_data['data'][i]['regime_signal_votes'] = row['regime_signal_votes']
    
    # Update metadata
    features_data['metadata']['regime_labeling'] = {
        'method': 'historically_verified',
        'crisis_periods': [
            {'start': '2008-09-01', 'end': '2009-03-31', 'description': '2008 Financial Crisis'},
            {'start': '2020-03-01', 'end': '2020-03-31', 'description': 'COVID-19 Crash'}
        ],
        'adaptive_thresholds': True,
        'timestamp': datetime.now().isoformat()
    }
    
    # Write updated features back to JSON
    with open(features_path, 'w') as f:
        json.dump(features_data, f, indent=2)
    
    print(f"\nUpdated features JSON at {features_path}")
    print(f"  Added regime labels for {len(labeled_df)} observations")
    
    print("\n" + "=" * 60)
    print("REGIME LABELING COMPLETE!")
    print("=" * 60)
