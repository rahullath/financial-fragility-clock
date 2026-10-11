# Financial Fragility Clock

Measures how fragile a stock market is, from 0 to 100, on Hyman Minsky's Financial Instability Hypothesis scale: **Hedge** (0–33), **Speculative** (34–66) and **Ponzi** (67–100).

Group project for Big Data Management in Finance, MSc Financial Technology, University of Birmingham (2026). I led the project.

## How the score works

```
FragilityScore = 0.40 × 60-day rolling cross-market correlation
               + 0.30 × inverted permutation entropy
               + 0.20 × normalised 30-day volatility
               + 0.10 × rolling Random Forest prediction error
```

The idea: when markets lose their independence and returns become more predictable and volatile, the system is closer to the edge.

## Models

- **Model A:** Istanbul Stock Exchange and global indices, 2009–2011.
- **Model B:** extended 2003–2026 data with macro signals (yfinance, FRED). Tested on whether fragility rose before 2008 and 2020.
- OLS baseline (with Breusch–Pagan and Durbin–Watson diagnostics), Random Forest and LSTM.
- **Walk-forward validation only** (expanding time-series windows), so no model ever trains on the future.
- SHAP and permutation feature importance, tracked over time.
- Dynamic time warping compares current conditions with past crisis windows.

## Dashboard

React + TypeScript (Vite) with D3 and Recharts:

- the clock;
- a regime timeline;
- a rolling correlation heatmap;
- the correlation network (minimum spanning tree);
- SHAP importance over time;
- DTW crisis similarity;
- model performance tables.

A `/present` route gives a curated walkthrough. All Python output is exported to JSON at build time, so the site is fully static. Tested with Vitest and fast-check.

## Run it

```bash
# pipeline
pip install -r python/requirements.txt
python python/preprocessing.py && python python/feature_engineering.py && python python/models.py && python python/export_json.py

# dashboard
npm install && npm run dev
```
