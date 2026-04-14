"""
Regime Transition Probabilities Script for Financial Fragility Clock.

This module computes regime transition probabilities:
- Probability of transitioning from HEDGE to SPECULATIVE
- Probability of transitioning from SPECULATIVE to PONZI
- Probability of transitioning from PONZI back to HEDGE
- Average duration in each regime

Generates regime_transitions.json with transition probability data.

Requirements: 2.7
"""

import json
import sys
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np


def compute_regime_transitions():
    """
    Compute regime transition probabilities and statistics.
    
    Returns:
        Dictionary with regime transition analysis results
    """
    print("\n" + "=" * 60)
    print("COMPUTING REGIME TRANSITIONS")
    print("=" * 60)
    
    try:
        # Load features data
        print("\nLoading features data...")
        with open("../src/data/features.json", "r") as f:
            features_data = json.load(f)
        
        df = pd.DataFrame(features_data['data'])
        df['date'] = pd.to_datetime(df['date'])
        
        print(f"Loaded {len(df)} observations")
        
        # Check if regime column exists
        if 'regime' not in df.columns:
            print("\nWARNING: No regime column found in features data")
            return {
                'metadata': {
                    'generated_at': datetime.now().isoformat(),
                    'description': 'Regime transition probabilities',
                    'note': 'No regime data available'
                },
                'transition_matrix': {},
                'average_duration': {}
            }
        
        # Compute transition matrix
        print("\nComputing transition matrix...")
        
        # Get regime transitions
        df['prev_regime'] = df['regime'].shift(1)
        transitions = df[df['regime'] != df['prev_regime']].copy()
        
        print(f"Found {len(transitions)} regime transitions")
        
        # Count transitions
        transition_counts = {}
        regimes = ['HEDGE', 'SPECULATIVE', 'PONZI']
        
        for from_regime in regimes:
            transition_counts[from_regime] = {}
            for to_regime in regimes:
                count = len(transitions[
                    (transitions['prev_regime'] == from_regime) & 
                    (transitions['regime'] == to_regime)
                ])
                transition_counts[from_regime][to_regime] = count
        
        # Compute transition probabilities
        transition_probs = {}
        for from_regime in regimes:
            total = sum(transition_counts[from_regime].values())
            transition_probs[from_regime] = {}
            for to_regime in regimes:
                if total > 0:
                    prob = transition_counts[from_regime][to_regime] / total
                else:
                    prob = 0.0
                transition_probs[from_regime][to_regime] = round(prob, 4)
        
        print("\nTransition probabilities:")
        for from_regime in regimes:
            print(f"  {from_regime}:")
            for to_regime in regimes:
                prob = transition_probs[from_regime][to_regime]
                print(f"    → {to_regime}: {prob:.2%}")
        
        # Compute average duration in each regime
        print("\nComputing average regime duration...")
        
        regime_durations = {regime: [] for regime in regimes}
        current_regime = None
        regime_start = None
        
        for idx, row in df.iterrows():
            regime = row['regime']
            # Skip NaN regimes
            if pd.isna(regime) or regime not in regimes:
                continue
            if regime != current_regime:
                if current_regime is not None and regime_start is not None:
                    duration = (row['date'] - regime_start).days
                    regime_durations[current_regime].append(duration)
                current_regime = regime
                regime_start = row['date']
        
        avg_durations = {}
        for regime in regimes:
            if regime_durations[regime]:
                avg_durations[regime] = round(np.mean(regime_durations[regime]), 1)
            else:
                avg_durations[regime] = 0.0
        
        print("\nAverage regime duration (days):")
        for regime in regimes:
            print(f"  {regime}: {avg_durations[regime]:.1f} days")
        
        # Generate output structure
        result = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'description': 'Regime transition probabilities and statistics',
                'total_observations': len(df),
                'total_transitions': len(transitions)
            },
            'transition_matrix': transition_probs,
            'transition_counts': transition_counts,
            'average_duration_days': avg_durations,
            'regime_distribution': {
                regime: int((df['regime'] == regime).sum())
                for regime in regimes
            }
        }
        
        return result
        
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """
    Main function to compute regime transitions and export results.
    """
    print("=" * 80)
    print("REGIME TRANSITION PROBABILITIES COMPUTATION")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    try:
        # Compute regime transitions
        result = compute_regime_transitions()
        
        if result is None:
            print("\nERROR: Failed to compute regime transitions")
            return 1
        
        # Export to JSON
        output_path = "../src/data/regime_transitions.json"
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        print(f"\nWriting to: {output_path}")
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        file_size = output_file.stat().st_size / 1024
        print(f"File size: {file_size:.2f} KB")
        
        print("\n" + "=" * 80)
        print("REGIME TRANSITION COMPUTATION COMPLETE!")
        print("=" * 80)
        print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"\nGenerated file: {output_path}")
        print("=" * 80)
        
        return 0
        
    except Exception as e:
        print("\n" + "=" * 80)
        print("ERROR: Computation Failed")
        print("=" * 80)
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
