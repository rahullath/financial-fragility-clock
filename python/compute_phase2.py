"""
Phase 2 ML additions — Financial Fragility Clock

Adds to existing JSON artefacts WITHOUT re-running the full pipeline:
  1. DTW crisis similarity score   → features per row  (crisis_similarity_*)
  2. RF crash probability          → features per row  (crash_probability)
  3. crisis_window definitions     → both outputs JSON

Run from repo root:
    ./venv/bin/python python/compute_phase2.py

Or for one model only:
    ./venv/bin/python python/compute_phase2.py --model A
    ./venv/bin/python python/compute_phase2.py --model B
"""

import json
import warnings
import argparse
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import TimeSeriesSplit

warnings.filterwarnings("ignore")

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"

PATHS = {
    "A": {
        "features":  DATA / "features.json",
        "outputs":   DATA / "model_outputs.json",
        "slim_out":  None,                               # Model A features aren't slimmed
    },
    "B": {
        "features":  DATA / "model_b_features_slim.json",
        "outputs":   DATA / "model_b_outputs.json",
        "slim_out":  None,
    },
}

# ── Crisis window definitions ─────────────────────────────────────────────────
# These match CrisisContext.tsx exactly.

CRISIS_WINDOWS = [
    {
        "id":     "gfc_2008",
        "label":  "GFC 2008",
        "start":  "2008-09-01",
        "end":    "2009-03-31",
        "models": ["B"],
    },
    {
        "id":     "dotcom_2000",
        "label":  "Dot-com Collapse",
        "start":  "2000-03-01",
        "end":    "2002-10-31",
        "models": ["B"],
    },
    {
        "id":     "covid_2020",
        "label":  "COVID 2020",
        "start":  "2020-02-01",
        "end":    "2020-04-30",
        "models": ["B"],
    },
    {
        "id":     "flash_2010",
        "label":  "Flash Crash 2010",
        "start":  "2010-04-01",
        "end":    "2010-07-31",
        "models": ["A", "B"],
    },
    {
        "id":     "eu_debt_2010",
        "label":  "EU Debt Crisis",
        "start":  "2010-04-01",
        "end":    "2011-12-31",
        "models": ["A", "B"],
    },
]

# Features used in DTW similarity (must exist in both models' feature JSON)
DTW_FEATURES = ["mean_corr", "rolling_volatility", "permutation_entropy"]

# Crash label: 1 if max negative drawdown in next HORIZON trading days > THRESHOLD
HORIZON = 30      # trading days
THRESHOLD = 0.07  # 7% drawdown (lower than 10% to get meaningful labels in the data)


# ── DTW implementation ────────────────────────────────────────────────────────

def dtw_distance(s1: np.ndarray, s2: np.ndarray) -> float:
    """
    Compute DTW distance between two 1-D sequences.
    Uses dynamic programming; O(n*m) time and space.
    Normalized by the length of the warping path.
    """
    n, m = len(s1), len(s2)
    dtw = np.full((n + 1, m + 1), np.inf)
    dtw[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = abs(s1[i - 1] - s2[j - 1])
            dtw[i, j] = cost + min(dtw[i - 1, j],
                                   dtw[i, j - 1],
                                   dtw[i - 1, j - 1])
    return float(dtw[n, m]) / (n + m)


def multivariate_dtw_distance(df1: pd.DataFrame, df2: pd.DataFrame,
                               features: list[str]) -> float:
    """
    Mean DTW distance across multiple features.
    Each feature is z-score normalised before comparison.
    Returns np.nan if fewer than 2 valid rows or features.
    """
    cols = [c for c in features if c in df1.columns and c in df2.columns]
    if len(cols) == 0 or len(df1) < 2 or len(df2) < 2:
        return np.nan

    distances = []
    for col in cols:
        s1 = df1[col].dropna().values.astype(float)
        s2 = df2[col].dropna().values.astype(float)
        if len(s1) < 2 or len(s2) < 2:
            continue
        # z-score normalise to make features comparable
        std1 = s1.std()
        std2 = s2.std()
        s1 = (s1 - s1.mean()) / (std1 if std1 > 0 else 1)
        s2 = (s2 - s2.mean()) / (std2 if std2 > 0 else 1)
        distances.append(dtw_distance(s1, s2))

    return float(np.mean(distances)) if distances else np.nan


def distance_to_similarity(distance: float, scale: float = 1.0) -> float:
    """
    Map DTW distance → similarity in [0, 100].
    similarity = 100 * exp(-distance / scale)
    When distance=0 → 100; when distance=scale → 37; when distance>>scale → 0.
    """
    if np.isnan(distance):
        return np.nan
    return float(100.0 * np.exp(-distance / scale))


def _coerce_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Force all columns to float where possible (JSON may store numbers as strings)."""
    for col in df.columns:
        try:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        except (TypeError, ValueError):
            pass
    return df


# ── Load features ─────────────────────────────────────────────────────────────

def load_features(model: str) -> tuple[pd.DataFrame, dict]:
    path = PATHS[model]["features"]
    print(f"  Loading {path.name} …", end=" ", flush=True)
    with open(path) as f:
        raw = json.load(f)
    df = pd.DataFrame(raw["data"])
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    # JSON may store numbers as strings — coerce everything to float
    df = _coerce_numeric(df)
    print(f"{len(df)} rows")
    return df, raw


# ── DTW Similarity ───────────────────────────────────────────────────────────

def compute_crisis_similarity(df: pd.DataFrame, model: str,
                               window: int = 60) -> pd.DataFrame:
    """
    For every date t, compute DTW similarity between the 60-day window
    ending at t and each crisis window, for applicable model.

    Returns DataFrame with columns:
      crisis_similarity_{id}   — per-crisis score [0, 100]
      crisis_similarity_composite — max across all active crises [0, 100]
    """
    model_crises = [c for c in CRISIS_WINDOWS if model in c["models"]]
    if not model_crises:
        print(f"  No applicable crisis windows for Model {model}.")
        return pd.DataFrame(index=df.index)

    print(f"  Computing DTW similarity for {len(model_crises)} crisis windows …")

    # Pre-extract crisis reference DataFrames
    crisis_refs: dict[str, pd.DataFrame | None] = {}
    for cw in model_crises:
        cid = cw["id"]
        ref = df.loc[cw["start"]:cw["end"], DTW_FEATURES].dropna()
        if len(ref) < 5:
            print(f"    WARN: {cid} has only {len(ref)} valid rows in this model — skipping")
            crisis_refs[cid] = None
        else:
            crisis_refs[cid] = ref
            print(f"    {cid}: {len(ref)} reference rows ({cw['start']} → {cw['end']})")

    results: dict[str, list] = {f"crisis_similarity_{cw['id']}": [] for cw in model_crises}
    composite_list: list = []

    dates = df.index
    total = len(dates)
    report_every = max(1, total // 20)

    for i, t in enumerate(dates):
        if i % report_every == 0:
            print(f"    Progress: {i}/{total} ({100*i//total}%)", flush=True)

        # Rolling window ending at t
        win_start = max(0, i - window + 1)
        window_df = df.iloc[win_start:i + 1][DTW_FEATURES].dropna()

        per_crisis_scores: list[float] = []

        for cw in model_crises:
            cid = cw["id"]
            ref = crisis_refs[cid]

            if ref is None or len(window_df) < 5:
                results[f"crisis_similarity_{cid}"].append(None)
                continue

            # Exclude the current window if it overlaps with the crisis period
            # (we don't want to inflate similarity by comparing a crisis to itself)
            window_in_crisis = (t >= pd.Timestamp(cw["start"])) and (
                t <= pd.Timestamp(cw["end"])
            )
            if window_in_crisis:
                results[f"crisis_similarity_{cid}"].append(None)
                continue

            dist = multivariate_dtw_distance(window_df, ref, DTW_FEATURES)
            sim = distance_to_similarity(dist)
            results[f"crisis_similarity_{cid}"].append(
                round(sim, 2) if not np.isnan(sim) else None
            )
            if not np.isnan(sim):
                per_crisis_scores.append(sim)

        # Composite = max similarity across all active crises for this date
        composite = round(max(per_crisis_scores), 2) if per_crisis_scores else None
        composite_list.append(composite)

    out = pd.DataFrame(results, index=df.index)
    out["crisis_similarity_composite"] = composite_list
    return out


# ── Crash Probability Classifier ─────────────────────────────────────────────

def compute_crash_probability(df: pd.DataFrame, model: str) -> pd.Series:
    """
    Walk-forward RF classifier: P(crash in next HORIZON trading days).

    Label:  1 if max forward drawdown in HORIZON days > THRESHOLD, else 0.
    Features: mean_corr, rolling_volatility, permutation_entropy, fragility_score.

    Walk-forward: train on first 70%, then slide 3-month windows, producing
    calibrated probability estimates for all dates after the warm-up.
    """
    feat_cols = ["mean_corr", "rolling_volatility", "permutation_entropy", "fragility_score"]
    available = [c for c in feat_cols if c in df.columns]
    if len(available) < 2:
        print(f"  Not enough feature columns for crash classifier (have: {available})")
        return pd.Series(np.nan, index=df.index)

    # ── Build reference return series ──────────────────────────────────────
    # Use fragility_score as a proxy for index level (for drawdown calculation)
    # If raw price series existed we'd prefer it, but fragility is available.
    # We actually need returns to compute drawdowns. Use fragility_score pct change.
    ref_series = df["fragility_score"].ffill()

    # ── Label construction ────────────────────────────────────────────────
    print(f"  Building crash labels (HORIZON={HORIZON}d, THRESHOLD={THRESHOLD:.0%}) …")
    # Label t=1 when fragility score SURGES more than THRESHOLD above current
    # within the next HORIZON trading days — a pre-crash risk signal.
    labels = np.full(len(df), np.nan)
    frag = ref_series.values.astype(float)
    for i in range(len(df) - HORIZON):
        cur = frag[i]
        if np.isnan(cur) or cur <= 0:
            continue
        future = frag[i + 1: i + 1 + HORIZON]
        valid_future = future[~np.isnan(future)]
        if len(valid_future) < HORIZON // 2:
            continue
        max_future = float(np.max(valid_future))
        labels[i] = 1 if (max_future - cur) / max(cur, 1e-6) > THRESHOLD else 0

    label_series = pd.Series(labels, index=df.index)
    n_crash = int((label_series == 1).sum())
    n_safe  = int((label_series == 0).sum())
    print(f"  Labels: {n_crash} crash ({100*n_crash/max(n_crash+n_safe,1):.1f}%), "
          f"{n_safe} safe")

    if n_crash < 10:
        print(f"  WARN: Very few crash labels ({n_crash}). "
              f"Classifier won't be reliable. Writing null.")
        return pd.Series(None, index=df.index)

    # ── Walk-forward calibrated classifier ───────────────────────────────
    valid_mask = label_series.notna() & df[available].notna().all(axis=1)
    X_all = df.loc[valid_mask, available]
    y_all = label_series[valid_mask]

    # Minimum training size before we start predicting
    min_train = int(len(X_all) * 0.4)
    if min_train < 50:
        print("  Not enough data for walk-forward. Falling back to full-train.")
        min_train = min(50, len(X_all) - 1)

    prob_out = pd.Series(np.nan, index=df.index)
    tscv = TimeSeriesSplit(n_splits=5, test_size=max(20, len(X_all) // 10))

    print(f"  Walk-forward calibrated RF (5 folds) …")
    all_preds: list[tuple[pd.Index, np.ndarray]] = []

    for fold_i, (train_idx, test_idx) in enumerate(tscv.split(X_all)):
        X_tr = X_all.iloc[train_idx]
        y_tr = y_all.iloc[train_idx]
        X_te = X_all.iloc[test_idx]

        if len(y_tr.unique()) < 2:
            print(f"    Fold {fold_i}: skipped (only one class in training set)")
            continue

        base_clf = RandomForestClassifier(
            n_estimators=300,
            max_depth=6,
            min_samples_split=15,
            random_state=42,
            n_jobs=-1,
            class_weight="balanced",
        )
        calibrated = CalibratedClassifierCV(base_clf, cv=3, method="isotonic")
        try:
            calibrated.fit(X_tr, y_tr)
            probs = calibrated.predict_proba(X_te)[:, 1]
            all_preds.append((X_all.index[test_idx], probs))
            print(f"    Fold {fold_i}: train={len(X_tr)}, test={len(X_te)}, "
                  f"prob range [{probs.min():.2f}, {probs.max():.2f}]")
        except Exception as e:
            print(f"    Fold {fold_i}: FAILED {e}")
            continue

    # ── Aggregate predictions ───────────────────────────────────────────
    # Where multiple folds predict a date, take the mean.
    accum: dict[pd.Timestamp, list[float]] = {}
    for idx_arr, probs_arr in all_preds:
        for date, prob in zip(idx_arr, probs_arr):
            accum.setdefault(date, []).append(float(prob))

    for date, prob_list in accum.items():
        prob_out[date] = round(float(np.mean(prob_list)), 4)

    n_filled = prob_out.notna().sum()
    print(f"  Crash probability filled for {n_filled}/{len(df)} dates")
    mean_prob = prob_out.dropna().mean()
    print(f"  Mean crash probability: {mean_prob:.3f}")

    return prob_out


# ── Patch JSON ────────────────────────────────────────────────────────────────

def patch_features_json(path: Path, sim_df: pd.DataFrame,
                         crash_prob: pd.Series) -> None:
    """Add similarity and crash_probability columns to features JSON in-place."""
    print(f"  Patching {path.name} …")
    with open(path) as f:
        raw = json.load(f)

    sim_cols = [c for c in sim_df.columns]

    updated = 0
    for row in raw["data"]:
        date = pd.Timestamp(row["date"])

        # Crash probability
        if date in crash_prob.index:
            v = crash_prob[date]
            row["crash_probability"] = None if pd.isna(v) else float(v)

        # DTW similarity columns
        for col in sim_cols:
            if date in sim_df.index:
                v = sim_df.loc[date, col]
                row[col] = None if (v is None or (isinstance(v, float) and np.isnan(v))) else v
        updated += 1

    raw["metadata"]["phase2"] = {
        "computed_at": datetime.now().isoformat(),
        "dtw_features": DTW_FEATURES,
        "crash_horizon_days": HORIZON,
        "crash_threshold": THRESHOLD,
        "crisis_windows": CRISIS_WINDOWS,
    }

    # Write compact (no indent) to keep size down
    with open(path, "w") as f:
        json.dump(raw, f, separators=(",", ":"))

    print(f"  ✓ Patched {updated} rows, wrote {path.stat().st_size/1e6:.1f} MB")


def patch_outputs_json(path: Path, model: str) -> None:
    """Add crisis_window definitions to outputs JSON."""
    if not path.exists():
        print(f"  WARN: {path.name} not found — skipping outputs patch")
        return
    with open(path) as f:
        raw = json.load(f)
    raw.setdefault("metadata", {})["crisis_windows"] = CRISIS_WINDOWS
    raw.setdefault("metadata", {})["phase2_at"] = datetime.now().isoformat()
    with open(path, "w") as f:
        json.dump(raw, f, indent=2)
    print(f"  ✓ Patched {path.name} with crisis_window definitions")


# ── Per-model runner ──────────────────────────────────────────────────────────

def run_model(model: str) -> None:
    sep = "=" * 60
    print(f"\n{sep}")
    print(f"  MODEL {model} — Phase 2 computation")
    print(sep)

    df, raw = load_features(model)

    # ── DTW similarity ────────────────────────────────────────────────────
    print("\n[1/2] DTW crisis similarity …")
    sim_df = compute_crisis_similarity(df, model, window=60)

    if not sim_df.empty:
        valid_rows = sim_df["crisis_similarity_composite"].notna().sum()
        print(f"  Composite similarity: {valid_rows} non-null dates")
        # Brief stats
        comp = sim_df["crisis_similarity_composite"].dropna()
        if len(comp) > 0:
            print(f"  Composite range: [{comp.min():.1f}, {comp.max():.1f}], "
                  f"mean={comp.mean():.1f}")

    # ── Crash probability ─────────────────────────────────────────────────
    print("\n[2/2] RF crash probability classifier …")
    crash_prob = compute_crash_probability(df, model)

    # ── Write back ────────────────────────────────────────────────────────
    print(f"\nWriting results …")
    patch_features_json(PATHS[model]["features"], sim_df, crash_prob)
    patch_outputs_json(PATHS[model]["outputs"], model)

    print(f"\n✓ Model {model} complete.\n")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Phase 2: DTW similarity + crash classifier")
    parser.add_argument("--model", choices=["A", "B", "both"], default="both",
                        help="Which model to process (default: both)")
    args = parser.parse_args()

    models = (["A", "B"] if args.model == "both"
              else [args.model])

    total_start = datetime.now()
    print("=" * 60)
    print("FINANCIAL FRAGILITY CLOCK — Phase 2 ML Additions")
    print(f"Models: {models}")
    print(f"DTW features: {DTW_FEATURES}")
    print(f"Crash horizon: {HORIZON}d, threshold: {THRESHOLD:.0%}")
    print("=" * 60)

    for m in models:
        run_model(m)

    elapsed = (datetime.now() - total_start).total_seconds()
    print(f"\n{'='*60}")
    print(f"All done in {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print("Re-run 'npm run dev' — the dashboard now has live data.")
    print("=" * 60)


if __name__ == "__main__":
    main()
