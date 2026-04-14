"""
Lead Time Statistics Computation Script for Financial Fragility Clock.

This module computes crisis prediction lead time statistics:
- How far in advance the model predicts regime transitions
- Average lead time for different crisis types
- Lead time distribution analysis

Generates lead_time_stats.json with lead time analysis data.

Requirements: 2.5
"""

import json
import sys
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np


def compute_lead_time_stats():
    """
    Compute lead time statistics for crisis prediction.
    
    Returns:
        Dictionary with lead time analysis results
    """
    print("\n" + "=" * 60)
    print("COMPUTING LEAD TIME STATISTICS")
    print("=" * 60)
    
    try:
        # Load features data
        print("\nLoading features data...")
        with open("../src/data/features.json", "r") as f:
            features_data = json.load(f)
        
        df = pd.DataFrame(features_data['data'])
        df['date'] = pd.to_datetime(df['date'])
        
        print(f"Loaded {len(df)} observations")
        
        # Placeholder implementation - compute basic statistics
        # TODO: Implement actual lead time analysis based on regime transitions
        
        # Find regime transitions
        if 'regime' in df.columns:
            df['regime_shift'] = df['regime'].ne(df['regime'].shift())
            transitions = df[df['regime_shift']].copy()
            
            print(f"\nFound {len(transitions)} regime transitions")
            
            # Compute average lead time (placeholder)
            lead_times = []
            for idx in range(1, len(transitions)):
                prev_date = transitions.iloc[idx-1]['date']
                curr_date = transitions.iloc[idx]['date']
                lead_time_days = (pd.to_datetime(curr_date) - pd.to_datetime(prev_date)).days
                lead_times.append(lead_time_days)
            
            avg_lead_time = np.mean(lead_times) if lead_times else 0
            
            print(f"Average lead time: {avg_lead_time:.1f} days")
        else:
            avg_lead_time = 0
            print("No regime column found")
        
        # Generate output structure
        result = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'description': 'Crisis prediction lead time statistics',
                'note': 'Placeholder implementation - requires full analysis'
            },
            'summary': {
                'average_lead_time_days': float(avg_lead_time),
                'total_transitions': len(transitions) if 'regime' in df.columns else 0
            },
            'by_regime': {
                'HEDGE_to_SPECULATIVE': {
                    'count': 0,
                    'avg_lead_time_days': 0
                },
                'SPECULATIVE_to_PONZI': {
                    'count': 0,
                    'avg_lead_time_days': 0
                },
                'PONZI_to_HEDGE': {
                    'count': 0,
                    'avg_lead_time_days': 0
                }
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
    Main function to compute lead time statistics and export results.
    """
    print("=" * 80)
    print("LEAD TIME STATISTICS COMPUTATION")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    try:
        # Compute lead time statistics
        result = compute_lead_time_stats()
        
        if result is None:
            print("\nERROR: Failed to compute lead time statistics")
            return 1
        
        # Export to JSON
        output_path = "../src/data/lead_time_stats.json"
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        print(f"\nWriting to: {output_path}")
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        file_size = output_file.stat().st_size / 1024
        print(f"File size: {file_size:.2f} KB")
        
        print("\n" + "=" * 80)
        print("LEAD TIME STATISTICS COMPUTATION COMPLETE!")
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
