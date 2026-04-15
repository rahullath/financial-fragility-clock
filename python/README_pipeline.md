# Turkey ISE2 — ML Pipeline (`turkey` branch)

## Overview

This pipeline predicts **Turkey BIST100 market crises** (ISE2 = USD-denominated returns) using two training setups:

| | Model A | Model B |
|---|---|---|  
| **Training data** | Group_5.csv (2009–2011) | Extended dataset (2005–2024) |
| **Test window** | Last 20% chronologically | 2018–present (Turkey Crisis era) |
| **Models** | OLS, Ridge, RF, XGBoost, LSTM | Same 5 models |
| **Targets** | Regression (ISE2 return) + Classification (crisis label) | Same |

---

## Setup

```bash
cd python
pip install -r requirements.txt
```

Create a `.env` file in the project root:
```
FRED_API_KEY=your_fred_api_key_here
```

Get a free FRED API key at https://fred.stlouisfed.org/docs/api/api_key.html

---

## Running the pipeline

```bash
# Step 1 (Model B only): fetch extended data
python fetch_extended.py

# Step 2: run full training pipeline
python train_pipeline.py          # both models
python train_pipeline.py --model a  # baseline only
python train_pipeline.py --model b  # extended only
```

Outputs written to `src/data/`:
- `results_model_a.json`
- `results_model_b.json`
- `dashboard_data.json` ← read by React frontend

---

## File structure (turkey branch)

```
python/
  preprocessing.py       ← load CSV, RobustScaler, time-split
  feature_engineering.py ← lag/rolling/corr features
  target_engineering.py  ← regression + binary crisis label
  fetch_extended.py      ← yfinance + FRED (2005-2024)
  models.py              ← OLS, Ridge, RF, XGBoost, LSTM
  train_pipeline.py      ← orchestrator → writes JSON
  requirements.txt
  README_pipeline.md
```

---

## Target variable

**`ise2`** = BIST100 daily return denominated in USD.  
Formula: `ise2 ≈ bist100_tl_ret + try_usd_ret`

This is the assignment's target and the only prediction target in this pipeline.  
SP500/DAX/FTSE/Nikkei/Bovespa/EU/EM are **input features**, never targets.

---

## Crisis label definition

A day is labelled `crisis=1` if the **forward 20-day cumulative ISE2 return** falls more than **2 standard deviations below** the 60-day rolling mean of that distribution.

This is adaptive: it accounts for Turkey's high-volatility regimes (2018–2022) without using a fixed return threshold.

---

## Dashboard chart data

`dashboard_data.json` contains:

1. **ISE2 full timeseries** — annotated with Turkey crisis windows
2. **Actual vs Predicted** — per model, per dataset (regression)
3. **Model comparison table** — R², RMSE, MAE (regression) + AUC, F1 (classification)
4. **Feature importance** — RF + XGBoost Gini importance, Model A vs B
5. **ROC curves** — RF + XGBoost on both datasets
6. **Fragility score timeline** — classifier probability × 100 over test window
7. **Crisis window annotations** — used as shaded bands in frontend charts
