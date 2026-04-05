"""
Model B Data Fetching Infrastructure.

This package provides data fetching and preprocessing for Model B
(extended 2003-2025 global data with macro signals).
"""

from .fetch_market_data import fetch_market_data, handle_missing_data as handle_market_missing, validate_data as validate_market
from .fetch_macro_data import fetch_macro_data, resample_to_daily, handle_missing_data as handle_macro_missing, validate_data as validate_macro
from .preprocessing_b import merge_market_and_macro, handle_missing_values, validate_data_completeness, export_to_json, run_preprocessing_pipeline

__all__ = [
    'fetch_market_data',
    'handle_market_missing',
    'validate_market',
    'fetch_macro_data',
    'resample_to_daily',
    'handle_macro_missing',
    'validate_macro',
    'merge_market_and_macro',
    'handle_missing_values',
    'validate_data_completeness',
    'export_to_json',
    'run_preprocessing_pipeline'
]
