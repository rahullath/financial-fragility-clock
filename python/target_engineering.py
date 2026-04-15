"""
Target Engineering module for Financial Fragility Clock.

Creates a forward-looking binary crash target for the classification pipeline.

A "crash" is defined as the ISE_USD return series falling more than `threshold`
cumulatively over the next `horizon` trading days from each observation.

Academic justification
----------------------
By shifting the target forward, today's features (rolling correlation, permutation
entropy, VIX, etc.) are used to predict a FUTURE event.  This eliminates the
simultaneity bias present in same-period regression ("nowcasting"), produces a
genuine lead-time estimate, and directly tests Minsky's hypothesis that rising
systemic fragility *precedes* market crises.

When your professor asks how the fragility score is calculated, the answer is:
"It is the direct probability output of a Random Forest Classifier trained to
predict severe ISE drawdowns 30 trading days in advance."
"""

import pandas as pd
import numpy as np
import warnings


def create_crash_target(
    df: pd.DataFrame,
    col: str = 'ISE_USD',
    horizon: int = 30,
    threshold: float = -0.05,
) -> pd.Series:
    """
    Create a binary forward-looking crash target variable.

    For each observation at time t the target is 1 if the cumulative return
    over the next `horizon` trading days falls below `threshold`.

    Args:
        df:        DataFrame containing the `col` return series.
        col:       Column to use as the market proxy (default 'ISE_USD').
                   Expected to be daily *returns*, not price levels.
        horizon:   Number of trading days to look forward (default 30).
        threshold: Crash threshold as a decimal (default -0.05 = -5%).

    Returns:
        pd.Series of {0.0, 1.0, NaN}:
            1.0  →  crash incoming within the next `horizon` days
            0.0  →  no crash
            NaN  →  final `horizon` rows (future unknown; must be dropped
                     from X, y before model training)

    Example:
        >>> crash_target = create_crash_target(df, col='ISE_USD', horizon=30)
        >>> df['crash_target'] = crash_target
        >>> df = df.dropna(subset=['crash_target'])
    """
    if col not in df.columns:
        raise ValueError(
            f"Column '{col}' not found in DataFrame. "
            f"Available: {list(df.columns)}"
        )

    series = df[col].copy().astype(float)

    # Cumulative return from t → t+horizon
    # shift(-horizon) aligns the future value with the current row.
    future_value = series.shift(-horizon)
    denom = series.abs().replace(0.0, np.nan)
    future_return = (future_value - series) / denom

    # Binary crash label (float dtype allows NaN assignment)
    crash_target = (future_return < threshold).astype(float)

    # Last `horizon` rows: we cannot know the future → NaN
    crash_target.iloc[-horizon:] = np.nan

    # ── Diagnostic summary ────────────────────────────────────────────────────
    valid = crash_target.dropna()
    n_crash  = int(valid.sum())
    n_normal = int((valid == 0).sum())
    total    = len(valid)
    crash_pct = 100.0 * n_crash / total if total > 0 else 0.0

    print("\n" + "=" * 60)
    print("CRASH TARGET ENGINEERING")
    print("=" * 60)
    print(f"  Column    : {col}")
    print(f"  Horizon   : {horizon} trading days forward")
    print(f"  Threshold : {threshold:.1%} cumulative return")
    print(f"  Total obs : {total}  (last {horizon} rows set to NaN)")
    print(f"  Crash = 1 : {n_crash:4d}  ({crash_pct:.1f}%)")
    print(f"  Normal= 0 : {n_normal:4d}  ({100.0 - crash_pct:.1f}%)")

    if n_crash < 10:
        warnings.warn(
            f"\n⚠  Only {n_crash} crash events in {total} observations. "
            f"Consider loosening threshold (e.g. -0.03) or shortening horizon "
            f"(e.g. 20 days).  class_weight='balanced' is applied on all "
            f"classifiers as a safeguard.",
            stacklevel=2,
        )
    elif crash_pct > 40.0:
        warnings.warn(
            f"\n⚠  {crash_pct:.1f}% crash rate is unusually high — verify "
            f"that '{col}' contains returns (not price levels) and that the "
            f"threshold is appropriate for the dataset.",
            stacklevel=2,
        )

    print("=" * 60)
    return crash_target


if __name__ == "__main__":
    import json
    from pathlib import Path

    print("Target Engineering Module – standalone test")
    print("=" * 60)

    data_path = Path("../src/data/cleaned_data.json")
    if not data_path.exists():
        print(f"ERROR: {data_path} not found. Run export_json.py first.")
        raise SystemExit(1)

    with open(data_path) as f:
        cleaned = json.load(f)

    df = pd.DataFrame(cleaned["data"])
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date")
    df = df.apply(pd.to_numeric, errors="coerce")

    crash_target = create_crash_target(df, col="ISE_USD", horizon=30, threshold=-0.05)
    print(f"\nSample (first 5 non-NaN):")
    print(crash_target.dropna().head())
