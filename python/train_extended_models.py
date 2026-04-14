"""
Extended ML Models Training Script for Financial Fragility Clock.

This module trains additional ML models beyond RF and OLS:
- Gradient Boosting
- LSTM (Long Short-Term Memory)
- Support Vector Regression (SVR)
- Elastic Net
- Ensemble (combining multiple models)

Generates ml_models_extended.json with predictions and performance metrics.

Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime
import sys
import warnings
warnings.filterwarnings('ignore')

# Scikit-learn models
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.svm import SVR
from sklearn.linear_model import ElasticNet
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, roc_curve

# Deep learning
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    print("WARNING: TensorFlow not available. LSTM model will be skipped.")


def replace_nan_with_none(obj):
    """
    Recursively replace NaN values with None for JSON serialization.
    
    Args:
        obj: Object to process (dict, list, or value)
    
    Returns:
        Object with NaN replaced by None
    """
    if isinstance(obj, dict):
        return {k: replace_nan_with_none(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_nan_with_none(item) for item in obj]
    elif isinstance(obj, float) and np.isnan(obj):
        return None
    else:
        return obj


def prepare_lstm_sequences(X, y, sequence_length=30):
    """
    Prepare sequences for LSTM training.
    
    Args:
        X: Feature DataFrame
        y: Target Series
        sequence_length: Number of time steps to look back
    
    Returns:
        X_seq: 3D array (samples, sequence_length, features)
        y_seq: 1D array (samples,)
    """
    X_seq = []
    y_seq = []
    
    X_values = X.values.astype(np.float32)
    y_values = y.values.astype(np.float32)
    
    for i in range(sequence_length, len(X)):
        X_seq.append(X_values[i-sequence_length:i])
        y_seq.append(y_values[i])
    
    return np.array(X_seq, dtype=np.float32), np.array(y_seq, dtype=np.float32)


def train_gradient_boosting(X_train, y_train, X_test, y_test, regimes_test=None):
    """
    Train Gradient Boosting model.
    
    Requirements: 11.1
    """
    print("\n" + "=" * 60)
    print("TRAINING GRADIENT BOOSTING MODEL")
    print("=" * 60)
    
    model = GradientBoostingRegressor(
        n_estimators=500,
        max_depth=5,
        learning_rate=0.01,
        subsample=0.8,
        random_state=42,
        verbose=0
    )
    
    print(f"\nTraining with {len(X_train)} observations...")
    model.fit(X_train, y_train)
    
    # Predictions
    y_train_pred = model.predict(X_train)
    y_test_pred = model.predict(X_test)
    
    # Metrics
    metrics = {
        'train_r2': float(r2_score(y_train, y_train_pred)),
        'train_rmse': float(np.sqrt(mean_squared_error(y_train, y_train_pred))),
        'train_mae': float(mean_absolute_error(y_train, y_train_pred)),
        'test_r2': float(r2_score(y_test, y_test_pred)),
        'test_rmse': float(np.sqrt(mean_squared_error(y_test, y_test_pred))),
        'test_mae': float(mean_absolute_error(y_test, y_test_pred))
    }
    
    print(f"\nTest Metrics:")
    print(f"  R²: {metrics['test_r2']:.4f}")
    print(f"  RMSE: {metrics['test_rmse']:.6f}")
    print(f"  MAE: {metrics['test_mae']:.6f}")
    
    # Regime-specific RMSE
    regime_rmse = {}
    if regimes_test is not None:
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            mask = regimes_test == regime
            if mask.sum() > 0:
                regime_rmse[regime] = float(np.sqrt(mean_squared_error(
                    y_test[mask], y_test_pred[mask]
                )))
    
    print("=" * 60)
    
    return {
        'model': model,
        'metrics': metrics,
        'regime_rmse': regime_rmse,
        'predictions': y_test_pred
    }



def train_lstm(X_train, y_train, X_test, y_test, regimes_test=None, sequence_length=30):
    """
    Train LSTM model for time series prediction.
    
    Requirements: 11.2
    """
    if not TENSORFLOW_AVAILABLE:
        print("\nSkipping LSTM training (TensorFlow not available)")
        return None
    
    print("\n" + "=" * 60)
    print("TRAINING LSTM MODEL")
    print("=" * 60)
    
    # Prepare sequences
    print(f"\nPreparing sequences (length={sequence_length})...")
    X_train_seq, y_train_seq = prepare_lstm_sequences(X_train, y_train, sequence_length)
    X_test_seq, y_test_seq = prepare_lstm_sequences(X_test, y_test, sequence_length)
    
    print(f"Train sequences: {X_train_seq.shape}")
    print(f"Test sequences: {X_test_seq.shape}")
    
    # Build LSTM model
    model = keras.Sequential([
        layers.LSTM(64, activation='relu', return_sequences=True, 
                   input_shape=(sequence_length, X_train.shape[1])),
        layers.Dropout(0.2),
        layers.LSTM(32, activation='relu'),
        layers.Dropout(0.2),
        layers.Dense(16, activation='relu'),
        layers.Dense(1)
    ])
    
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    
    # Train
    print("\nTraining LSTM...")
    history = model.fit(
        X_train_seq, y_train_seq,
        epochs=50,
        batch_size=32,
        validation_split=0.2,
        verbose=0
    )
    
    # Predictions
    y_train_pred = model.predict(X_train_seq, verbose=0).flatten()
    y_test_pred = model.predict(X_test_seq, verbose=0).flatten()
    
    # Metrics
    metrics = {
        'train_r2': float(r2_score(y_train_seq, y_train_pred)),
        'train_rmse': float(np.sqrt(mean_squared_error(y_train_seq, y_train_pred))),
        'train_mae': float(mean_absolute_error(y_train_seq, y_train_pred)),
        'test_r2': float(r2_score(y_test_seq, y_test_pred)),
        'test_rmse': float(np.sqrt(mean_squared_error(y_test_seq, y_test_pred))),
        'test_mae': float(mean_absolute_error(y_test_seq, y_test_pred))
    }
    
    print(f"\nTest Metrics:")
    print(f"  R²: {metrics['test_r2']:.4f}")
    print(f"  RMSE: {metrics['test_rmse']:.6f}")
    print(f"  MAE: {metrics['test_mae']:.6f}")
    
    # Regime-specific RMSE (adjust for sequence offset)
    regime_rmse = {}
    if regimes_test is not None:
        regimes_test_seq = regimes_test.iloc[sequence_length:].reset_index(drop=True)
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            mask = regimes_test_seq == regime
            if mask.sum() > 0:
                regime_rmse[regime] = float(np.sqrt(mean_squared_error(
                    y_test_seq[mask], y_test_pred[mask]
                )))
    
    print("=" * 60)
    
    return {
        'model': model,
        'metrics': metrics,
        'regime_rmse': regime_rmse,
        'predictions': y_test_pred,
        'sequence_offset': sequence_length
    }



def train_svr(X_train, y_train, X_test, y_test, regimes_test=None):
    """
    Train Support Vector Regression model.
    
    Requirements: 11.3
    """
    print("\n" + "=" * 60)
    print("TRAINING SUPPORT VECTOR REGRESSION MODEL")
    print("=" * 60)
    
    # Scale features (SVR is sensitive to feature scales)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    model = SVR(
        kernel='rbf',
        C=1.0,
        epsilon=0.1,
        gamma='scale'
    )
    
    print(f"\nTraining with {len(X_train)} observations...")
    model.fit(X_train_scaled, y_train)
    
    # Predictions
    y_train_pred = model.predict(X_train_scaled)
    y_test_pred = model.predict(X_test_scaled)
    
    # Metrics
    metrics = {
        'train_r2': float(r2_score(y_train, y_train_pred)),
        'train_rmse': float(np.sqrt(mean_squared_error(y_train, y_train_pred))),
        'train_mae': float(mean_absolute_error(y_train, y_train_pred)),
        'test_r2': float(r2_score(y_test, y_test_pred)),
        'test_rmse': float(np.sqrt(mean_squared_error(y_test, y_test_pred))),
        'test_mae': float(mean_absolute_error(y_test, y_test_pred))
    }
    
    print(f"\nTest Metrics:")
    print(f"  R²: {metrics['test_r2']:.4f}")
    print(f"  RMSE: {metrics['test_rmse']:.6f}")
    print(f"  MAE: {metrics['test_mae']:.6f}")
    
    # Regime-specific RMSE
    regime_rmse = {}
    if regimes_test is not None:
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            mask = regimes_test == regime
            if mask.sum() > 0:
                regime_rmse[regime] = float(np.sqrt(mean_squared_error(
                    y_test[mask], y_test_pred[mask]
                )))
    
    print("=" * 60)
    
    return {
        'model': model,
        'scaler': scaler,
        'metrics': metrics,
        'regime_rmse': regime_rmse,
        'predictions': y_test_pred
    }


def train_elastic_net(X_train, y_train, X_test, y_test, regimes_test=None):
    """
    Train Elastic Net model.
    
    Requirements: 11.4
    """
    print("\n" + "=" * 60)
    print("TRAINING ELASTIC NET MODEL")
    print("=" * 60)
    
    model = ElasticNet(
        alpha=0.01,
        l1_ratio=0.5,
        random_state=42,
        max_iter=10000
    )
    
    print(f"\nTraining with {len(X_train)} observations...")
    model.fit(X_train, y_train)
    
    # Predictions
    y_train_pred = model.predict(X_train)
    y_test_pred = model.predict(X_test)
    
    # Metrics
    metrics = {
        'train_r2': float(r2_score(y_train, y_train_pred)),
        'train_rmse': float(np.sqrt(mean_squared_error(y_train, y_train_pred))),
        'train_mae': float(mean_absolute_error(y_train, y_train_pred)),
        'test_r2': float(r2_score(y_test, y_test_pred)),
        'test_rmse': float(np.sqrt(mean_squared_error(y_test, y_test_pred))),
        'test_mae': float(mean_absolute_error(y_test, y_test_pred))
    }
    
    print(f"\nTest Metrics:")
    print(f"  R²: {metrics['test_r2']:.4f}")
    print(f"  RMSE: {metrics['test_rmse']:.6f}")
    print(f"  MAE: {metrics['test_mae']:.6f}")
    
    # Regime-specific RMSE
    regime_rmse = {}
    if regimes_test is not None:
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            mask = regimes_test == regime
            if mask.sum() > 0:
                regime_rmse[regime] = float(np.sqrt(mean_squared_error(
                    y_test[mask], y_test_pred[mask]
                )))
    
    print("=" * 60)
    
    return {
        'model': model,
        'metrics': metrics,
        'regime_rmse': regime_rmse,
        'predictions': y_test_pred
    }



def train_ensemble(models_dict, X_test, y_test, regimes_test=None):
    """
    Create ensemble model by averaging predictions from multiple models.
    
    Requirements: 11.5
    """
    print("\n" + "=" * 60)
    print("CREATING ENSEMBLE MODEL")
    print("=" * 60)
    
    # Collect predictions from all models (excluding LSTM due to sequence offset)
    predictions = []
    model_names = []
    
    for name, result in models_dict.items():
        if result is not None and 'predictions' in result:
            # Skip LSTM due to different prediction length
            if name == 'LSTM':
                continue
            predictions.append(result['predictions'])
            model_names.append(name)
    
    if len(predictions) == 0:
        print("ERROR: No model predictions available for ensemble")
        return None
    
    print(f"\nCombining predictions from {len(predictions)} models: {model_names}")
    
    # Convert to numpy array and average
    predictions_array = np.array(predictions)
    y_test_pred = np.mean(predictions_array, axis=0)
    
    # Metrics
    metrics = {
        'test_r2': float(r2_score(y_test, y_test_pred)),
        'test_rmse': float(np.sqrt(mean_squared_error(y_test, y_test_pred))),
        'test_mae': float(mean_absolute_error(y_test, y_test_pred))
    }
    
    print(f"\nEnsemble Test Metrics:")
    print(f"  R²: {metrics['test_r2']:.4f}")
    print(f"  RMSE: {metrics['test_rmse']:.6f}")
    print(f"  MAE: {metrics['test_mae']:.6f}")
    
    # Regime-specific RMSE
    regime_rmse = {}
    if regimes_test is not None:
        for regime in ['HEDGE', 'SPECULATIVE', 'PONZI']:
            mask = regimes_test == regime
            if mask.sum() > 0:
                regime_rmse[regime] = float(np.sqrt(mean_squared_error(
                    y_test[mask], y_test_pred[mask]
                )))
    
    print("=" * 60)
    
    return {
        'metrics': metrics,
        'regime_rmse': regime_rmse,
        'predictions': y_test_pred,
        'component_models': model_names
    }


def compute_classification_metrics(y_true, y_pred, threshold=0.5):
    """
    Compute classification metrics by converting regression to binary classification.
    
    Args:
        y_true: True target values
        y_pred: Predicted values
        threshold: Threshold for converting to binary (crisis vs non-crisis)
    
    Returns:
        Dictionary with accuracy, precision, recall, f1_score, roc_auc, roc_curve
    """
    # Convert to binary: 1 if above threshold, 0 otherwise
    y_true_binary = (y_true > threshold).astype(int)
    y_pred_binary = (y_pred > threshold).astype(int)
    
    # Compute metrics
    accuracy = accuracy_score(y_true_binary, y_pred_binary)
    precision = precision_score(y_true_binary, y_pred_binary, zero_division=0)
    recall = recall_score(y_true_binary, y_pred_binary, zero_division=0)
    f1 = f1_score(y_true_binary, y_pred_binary, zero_division=0)
    
    # ROC AUC and curve
    try:
        roc_auc = roc_auc_score(y_true_binary, y_pred)
        fpr, tpr, thresholds = roc_curve(y_true_binary, y_pred)
        roc_curve_data = [
            {'fpr': float(f), 'tpr': float(t)} 
            for f, t in zip(fpr, tpr)
        ]
    except:
        roc_auc = None
        roc_curve_data = []
    
    return {
        'accuracy': float(accuracy),
        'precision': float(precision),
        'recall': float(recall),
        'f1_score': float(f1),
        'roc_auc': float(roc_auc) if roc_auc is not None else None,
        'roc_curve': roc_curve_data
    }



def generate_predictions_timeseries(model_result, X_test, dates_test, model_id):
    """
    Generate time series predictions with regime classification.
    
    Args:
        model_result: Dictionary with model predictions
        X_test: Test features
        dates_test: Test dates
        model_id: Model identifier
    
    Returns:
        List of prediction dictionaries
    """
    predictions = model_result['predictions']
    
    # Classify regime based on fragility score thresholds
    def classify_regime(score):
        if score < 0.33:
            return 'normal'
        elif score < 0.67:
            return 'stressed'
        else:
            return 'crisis'
    
    # Generate confidence scores (simplified - based on prediction variance)
    confidence = np.ones(len(predictions)) * 0.8  # Default confidence
    
    result = []
    for i, (date, pred) in enumerate(zip(dates_test, predictions)):
        result.append({
            'date': date.strftime('%Y-%m-%d') if hasattr(date, 'strftime') else str(date),
            'fragility_score': float(pred),
            'regime': classify_regime(pred),
            'confidence': float(confidence[i])
        })
    
    return result


def export_ml_models_extended(models_results, X_test, y_test, dates_test, filepath):
    """
    Export all extended ML model results to JSON.
    
    Args:
        models_results: Dictionary of model results
        X_test: Test features
        y_test: Test target
        dates_test: Test dates
        filepath: Output JSON file path
    """
    print("\n" + "=" * 60)
    print("EXPORTING EXTENDED ML MODELS TO JSON")
    print("=" * 60)
    
    # Metadata
    metadata = {
        'generated_at': datetime.now().isoformat(),
        'models': list(models_results.keys())
    }
    
    # Predictions for each model
    predictions = {}
    for model_id, result in models_results.items():
        if result is not None:
            # Handle LSTM separately due to sequence offset
            if model_id == 'LSTM' and 'sequence_offset' in result:
                offset = result['sequence_offset']
                lstm_dates = dates_test[offset:]
                predictions[model_id] = generate_predictions_timeseries(
                    result, X_test.iloc[offset:], lstm_dates, model_id
                )
            else:
                predictions[model_id] = generate_predictions_timeseries(
                    result, X_test, dates_test, model_id
                )
    
    # Performance metrics for each model
    performance = {}
    for model_id, result in models_results.items():
        if result is not None:
            # Handle LSTM separately due to sequence offset
            if model_id == 'LSTM' and 'sequence_offset' in result:
                offset = result['sequence_offset']
                y_test_lstm = y_test.iloc[offset:]
                class_metrics = compute_classification_metrics(
                    y_test_lstm.values if hasattr(y_test_lstm, 'values') else y_test_lstm,
                    result['predictions']
                )
            else:
                # Get classification metrics
                class_metrics = compute_classification_metrics(
                    y_test.values if hasattr(y_test, 'values') else y_test,
                    result['predictions']
                )
            
            # Combine with regression metrics
            performance[model_id] = {
                **result['metrics'],
                **class_metrics
            }
    
    # Compile output
    output = {
        'metadata': metadata,
        'predictions': predictions,
        'performance': performance
    }
    
    # Ensure output directory exists
    output_path = Path(filepath)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Replace NaN values with None for valid JSON
    output_clean = replace_nan_with_none(output)
    
    # Write to JSON
    print(f"\nWriting to: {filepath}")
    with open(filepath, 'w') as f:
        json.dump(output_clean, f, indent=2)
    
    file_size = output_path.stat().st_size / 1024
    print(f"File size: {file_size:.2f} KB")
    
    print("\n" + "=" * 60)
    print("EXPORT COMPLETE")
    print("=" * 60)



def main():
    """
    Main function to train all extended ML models and export results.
    """
    print("=" * 80)
    print("EXTENDED ML MODELS TRAINING PIPELINE")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    try:
        # Load cleaned data and features
        print("\nLoading data...")
        with open("../src/data/cleaned_data.json", "r") as f:
            cleaned_data = json.load(f)
        
        with open("../src/data/features.json", "r") as f:
            features_data = json.load(f)
        
        # Convert to DataFrames
        df_clean = pd.DataFrame(cleaned_data['data'])
        df_clean['date'] = pd.to_datetime(df_clean['date'])
        df_clean = df_clean.set_index('date')
        
        df_features = pd.DataFrame(features_data['data'])
        df_features['date'] = pd.to_datetime(df_features['date'])
        df_features = df_features.set_index('date')
        
        # Prepare features
        feature_cols = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM']
        engineered_cols = ['mean_corr', 'permutation_entropy']
        target_col = 'ISE_USD'
        
        # Create combined dataset
        df_model = df_clean[[target_col] + feature_cols].copy()
        for col in engineered_cols:
            if col in df_features.columns:
                df_model[col] = df_features[col]
        
        # Remove NaN values
        df_model = df_model.dropna()
        
        # Ensure all columns are numeric
        for col in df_model.columns:
            df_model[col] = pd.to_numeric(df_model[col], errors='coerce')
        
        # Drop any rows that became NaN after conversion
        df_model = df_model.dropna()
        
        print(f"Valid observations: {len(df_model)}")
        
        # Train/test split (80/20)
        train_size = int(len(df_model) * 0.8)
        
        X = df_model[feature_cols + engineered_cols]
        y = df_model[target_col]
        
        X_train = X.iloc[:train_size]
        y_train = y.iloc[:train_size]
        X_test = X.iloc[train_size:]
        y_test = y.iloc[train_size:]
        dates_test = X_test.index
        
        # Get regime labels
        regimes_test = df_features.loc[X_test.index, 'regime'] if 'regime' in df_features.columns else None
        
        print(f"\nTrain: {len(X_train)} obs, Test: {len(X_test)} obs")
        
        # Train all models
        models_results = {}
        
        # Gradient Boosting
        models_results['GradientBoosting'] = train_gradient_boosting(
            X_train, y_train, X_test, y_test, regimes_test
        )
        
        # LSTM
        models_results['LSTM'] = train_lstm(
            X_train, y_train, X_test, y_test, regimes_test
        )
        
        # SVR
        models_results['SVR'] = train_svr(
            X_train, y_train, X_test, y_test, regimes_test
        )
        
        # Elastic Net
        models_results['ElasticNet'] = train_elastic_net(
            X_train, y_train, X_test, y_test, regimes_test
        )
        
        # Ensemble
        models_results['Ensemble'] = train_ensemble(
            models_results, X_test, y_test, regimes_test
        )
        
        # Export results
        output_path = "../src/data/ml_models_extended.json"
        export_ml_models_extended(
            models_results, X_test, y_test, dates_test, output_path
        )
        
        print("\n" + "=" * 80)
        print("EXTENDED ML MODELS TRAINING COMPLETE!")
        print("=" * 80)
        print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"\nGenerated file: {output_path}")
        print("=" * 80)
        
        return 0
        
    except Exception as e:
        print("\n" + "=" * 80)
        print("ERROR: Training Failed")
        print("=" * 80)
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
