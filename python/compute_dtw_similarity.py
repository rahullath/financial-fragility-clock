"""
DTW Similarity Analysis Script for Financial Fragility Clock.

This module computes Dynamic Time Warping (DTW) similarity between:
- Current market conditions and historical crisis periods
- Different crisis episodes
- Market patterns across time

Generates dtw_similarity.json with similarity analysis data.

Requirements: 2.6
"""

import json
import sys
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np


def dtw_distance(s1, s2):
    """
    Compute DTW distance between two time series.
    
    Args:
        s1: First time series (numpy array)
        s2: Second time series (numpy array)
    
    Returns:
        DTW distance (float)
    """
    n, m = len(s1), len(s2)
    dtw_matrix = np.zeros((n + 1, m + 1))
    
    for i in range(n + 1):
        for j in range(m + 1):
            dtw_matrix[i, j] = np.inf
    dtw_matrix[0, 0] = 0
    
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = abs(s1[i-1] - s2[j-1])
            dtw_matrix[i, j] = cost + min(
                dtw_matrix[i-1, j],    # insertion
                dtw_matrix[i, j-1],    # deletion
                dtw_matrix[i-1, j-1]   # match
            )
    
    return dtw_matrix[n, m]


def zscore_series(series: pd.Series) -> np.ndarray:
    """Normalize a series so DTW compares shape rather than raw scale."""
    values = pd.to_numeric(series, errors='coerce').astype(float)
    if values.isna().all():
        return np.array([], dtype=float)

    values = values.ffill().bfill().fillna(0.0).to_numpy()
    std = float(np.std(values))
    if std == 0:
        return np.zeros(len(values), dtype=float)
    return (values - float(np.mean(values))) / std


def compute_dtw_similarity():
    """
    Compute DTW similarity between current conditions and historical crises.
    
    Returns:
        Dictionary with DTW similarity analysis results
    """
    print("\n" + "=" * 60)
    print("COMPUTING DTW SIMILARITY")
    print("=" * 60)
    
    try:
        # Load features data
        print("\nLoading features data...")
        with open("../src/data/features.json", "r") as f:
            features_data = json.load(f)
        
        df = pd.DataFrame(features_data['data'])
        df['date'] = pd.to_datetime(df['date'])
        
        print(f"Loaded {len(df)} observations")
        
        feature_set = ['fragility_score', 'mean_corr', 'rolling_volatility', 'permutation_entropy']
        window_size = 90

        # Define crisis periods available in the Model A sample.
        crisis_periods = [
            {
                'id': 'flash_crash_2010',
                'name': 'Flash Crash 2010',
                'start': '2010-05-01',
                'end': '2010-06-30'
            },
            {
                'id': 'eu_debt_2010',
                'name': 'EU Debt Crisis',
                'start': '2010-04-01',
                'end': '2011-12-31'
            }
        ]
        
        print(f"\nAnalyzing {len(crisis_periods)} crisis periods")

        valid_df = df[['date', *feature_set]].dropna().sort_values('date').reset_index(drop=True)
        if len(valid_df) < window_size:
            raise ValueError('Insufficient valid observations for DTW analysis')

        crisis_windows = {}
        for crisis in crisis_periods:
            crisis_data = valid_df[
                (valid_df['date'] >= crisis['start']) & 
                (valid_df['date'] <= crisis['end'])
            ][['date', *feature_set]].dropna()

            if len(crisis_data) < 20:
                continue

            crisis_windows[crisis['id']] = {
                'meta': crisis,
                'data': crisis_data,
            }

        if not crisis_windows:
            raise ValueError('No crisis windows produced valid DTW scores')

        similarities = []
        latest_similarity_scores = {}

        for end_idx in range(window_size - 1, len(valid_df)):
            reference_window = valid_df.iloc[end_idx - window_size + 1:end_idx + 1]
            reference_date = reference_window['date'].iloc[-1].strftime('%Y-%m-%d')
            similar_periods = []

            for crisis_id, crisis_window in crisis_windows.items():
                distances = []
                for feature in feature_set:
                    reference_series = zscore_series(reference_window[feature])
                    crisis_series = zscore_series(crisis_window['data'][feature])
                    if len(reference_series) == 0 or len(crisis_series) == 0:
                        continue
                    distances.append(
                        dtw_distance(reference_series, crisis_series)
                        / max(len(reference_series), len(crisis_series))
                    )

                if not distances:
                    continue

                avg_distance = float(np.mean(distances))
                similarity = float(1 / (1 + avg_distance))
                similar_periods.append({
                    'date': crisis_window['meta']['start'],
                    'score': similarity,
                    'features_matched': feature_set,
                })

                if end_idx == len(valid_df) - 1:
                    latest_similarity_scores[crisis_id] = {
                        'name': crisis_window['meta']['name'],
                        'similarity': similarity,
                        'distance': avg_distance,
                        'observations': int(len(crisis_window['data'])),
                        'features_matched': feature_set,
                    }

            similarities.append({
                'reference_date': reference_date,
                'similar_periods': sorted(similar_periods, key=lambda period: period['score'], reverse=True),
            })

        ranked_scores = sorted(
            latest_similarity_scores.items(),
            key=lambda item: item[1]['similarity'],
            reverse=True,
        )
        most_similar_id, most_similar_score = ranked_scores[0]

        for crisis_id, score_data in latest_similarity_scores.items():
            print(
                f"  {score_data['name']}: similarity={score_data['similarity']:.4f}, "
                f"distance={score_data['distance']:.4f}, observations={score_data['observations']}"
            )

        # Generate output structure
        result = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'description': 'DTW similarity analysis between current and historical crises',
                'method': 'Dynamic Time Warping',
                'window_size': window_size,
                'feature_set': feature_set,
            },
            'crisis_periods': crisis_periods,
            'similarity_scores': latest_similarity_scores,
            'current_similarity': {
                'reference_date': similarities[-1]['reference_date'],
                'most_similar_crisis': most_similar_id,
                'similarity_score': most_similar_score['similarity'],
                'confidence': float(min(0.99, 1 / (1 + most_similar_score['distance'] / 2))),
            },
            'similarities': similarities,
        }

        # Preserve a simple top-level summary shape for existing tests.
        for crisis_id, score_data in latest_similarity_scores.items():
            result[crisis_id] = {
                'name': score_data['name'],
                'similarity': score_data['similarity'],
                'distance': score_data['distance'],
            }
        
        return result
        
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """
    Main function to compute DTW similarity and export results.
    """
    print("=" * 80)
    print("DTW SIMILARITY ANALYSIS")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    try:
        # Compute DTW similarity
        result = compute_dtw_similarity()
        
        if result is None:
            print("\nERROR: Failed to compute DTW similarity")
            return 1
        
        # Export to JSON
        output_path = "../src/data/dtw_similarity.json"
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        print(f"\nWriting to: {output_path}")
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        file_size = output_file.stat().st_size / 1024
        print(f"File size: {file_size:.2f} KB")
        
        print("\n" + "=" * 80)
        print("DTW SIMILARITY ANALYSIS COMPLETE!")
        print("=" * 80)
        print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"\nGenerated file: {output_path}")
        print("=" * 80)
        
        return 0
        
    except Exception as e:
        print("\n" + "=" * 80)
        print("ERROR: Analysis Failed")
        print("=" * 80)
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
