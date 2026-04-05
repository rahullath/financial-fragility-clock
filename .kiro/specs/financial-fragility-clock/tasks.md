# Implementation Plan: Financial Fragility Clock

## Overview

This implementation plan converts the Financial Fragility Clock design into actionable coding tasks. The project follows a three-tier architecture: Python ML pipeline for data processing and model training, static JSON artifacts for data storage, and a React dashboard for interactive visualization. Implementation proceeds in logical phases: Python pipeline first (data → features → models), then React components, then integration and deployment.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create root directory structure: `python/`, `src/`, `public/`, `.kiro/specs/financial-fragility-clock/`
  - Create Python `requirements.txt` with pinned versions: pandas==1.5.3, numpy==1.24.0, scikit-learn==1.2.2, statsmodels==0.14.0, shap==0.42.1, scipy==1.10.0
  - Create `package.json` with React 18.2, Vite 4.0, Recharts 2.5, D3 7.8, TypeScript 5.0
  - Create `.gitignore` for Python (`__pycache__`, `*.pyc`, `.venv`) and Node (`node_modules/`, `dist/`)
  - _Requirements: 24.6_

- [x] 2. Implement Python preprocessing module
  - [x] 2.1 Create CSV parser with flexible delimiter and date format detection
    - Write `python/preprocessing.py` with `load_csv()` function
    - Implement pandas CSV parsing with error handling for malformed rows
    - Convert date column to datetime index with daily frequency
    - Validate exactly 536 rows are parsed, raise ValueError otherwise
    - _Requirements: 1.1, 25.1, 25.2, 25.3, 25.4, 25.5_

  - [x] 2.2 Implement missing value handling with forward-fill logic
    - Write `handle_missing_values()` function with max_gap parameter (default 3)
    - Apply forward-fill for gaps ≤ 3 consecutive days
    - Flag and exclude observations with gaps > 3 days
    - Log warnings with date ranges for excluded observations
    - _Requirements: 1.2, 1.3, 26.5_

  - [x] 2.3 Implement descriptive statistics computation
    - Write `compute_descriptive_stats()` function
    - Compute mean, std, min, max, q25, q50, q75 for all 8 numeric columns
    - Perform Shapiro-Wilk normality tests on all return series
    - Store results in dictionary with column names as keys
    - _Requirements: 1.7, 1.8_

  - [x] 2.4 Implement JSON export for cleaned data
    - Write `export_cleaned_data()` function
    - Create JSON structure with metadata (rows, columns, date_range, stats) and data array
    - Write to `src/data/cleaned_data.json`
    - Include generation timestamp and Python version in metadata
    - _Requirements: 1.6, 22.3, 22.4_

  - [ ]* 2.5 Write unit tests for preprocessing module
    - Test CSV parsing with known input/output pairs
    - Test missing value handling with synthetic gaps
    - Test validation error handling (wrong row count, malformed dates)
    - _Requirements: 29.3_

- [x] 3. Implement Python feature engineering module
  - [x] 3.1 Create rolling correlation computation
    - Write `python/feature_engineering.py` with `compute_rolling_correlation()` function
    - Compute 60-day rolling Pearson correlations for all 28 pairwise combinations (8 choose 2)
    - Calculate mean absolute correlation, correlation concentration (variance), and max eigenvalue at each time point
    - Return DataFrame with date index and correlation features
    - Handle NaN values when rolling window exceeds available data
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Implement permutation entropy calculation
    - Write `compute_permutation_entropy()` function with parameters m=3, delay=1, window=30
    - Apply permutation entropy on ISE_USD returns using 30-day rolling windows
    - Invert values (1 - normalized_PE) for fragility score inclusion
    - Flag observations below 25th percentile as potential crisis precursors
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.3 Implement Minsky regime labeling
    - Write `label_minsky_regime()` function
    - Compute 30-day rolling volatility (standard deviation) for ISE_USD returns
    - Calculate historical median volatility for threshold calibration
    - Apply regime classification rules: HEDGE (corr < 0.4 AND vol < 0.8×median), PONZI (corr > 0.7 AND vol > 1.5×median), SPECULATIVE (otherwise)
    - Store regime labels as categorical features and compute regime transition dates
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 30.4_

  - [x] 3.4 Implement fragility score computation
    - Write `compute_fragility_score()` function
    - Normalize all component features (rolling_correlation, permutation_entropy_inverted, rolling_volatility, RF_prediction_error) to [0,1] using min-max scaling
    - Apply weighted formula: 0.4×corr + 0.3×PE_inv + 0.2×vol + 0.1×RF_error
    - Multiply final score by 100 to produce 0-100 display value
    - Return NaN when any component is NaN due to insufficient rolling window data
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.5 Implement JSON export for features
    - Write `export_features()` function
    - Create JSON structure with metadata (features list, date_range) and data array
    - Include all feature time series: mean_corr, corr_concentration, max_eigenvalue, permutation_entropy, rolling_volatility, regime, fragility_score, pairwise_correlations
    - Write to `src/data/features.json`
    - _Requirements: 2.6, 3.5, 4.5, 5.5, 22.3_

  - [ ]* 3.6 Write unit tests for feature engineering
    - Test fragility score calculation with known input/output pairs
    - Test permutation entropy against reference implementation
    - Test regime labeling with synthetic correlation/volatility data
    - _Requirements: 29.1, 29.2_

- [x] 4. Checkpoint - Verify data pipeline outputs
  - Run preprocessing and feature engineering modules end-to-end
  - Verify `cleaned_data.json` and `features.json` are created with correct structure
  - Check that fragility scores are in [0,100] range and regimes are properly labeled
  - Ensure all tests pass, ask the user if questions arise

- [x] 5. Implement Python models module - OLS baseline
  - [x] 5.1 Create OLS regression training function
    - Write `python/models.py` with `train_ols()` function
    - Implement 80/20 time-based train-test split (first 428 obs for training, last 108 for testing)
    - Train OLS multivariate regression with ISE_USD as target and 7 global indices as predictors
    - Compute and store regression coefficients (beta values) for each predictor
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.2 Implement OLS metrics and diagnostics
    - Compute RMSE, MAE, and R² on both training and test sets
    - Compute regime-specific RMSE for HEDGE, SPECULATIVE, and PONZI subsets of test set
    - Perform Durbin-Watson test for autocorrelation and Breusch-Pagan test for heteroskedasticity on residuals
    - Store all results in dictionary with coefficients, metrics, regime_rmse, and diagnostics
    - _Requirements: 6.4, 6.5, 6.6, 6.7_

- [x] 6. Implement Python models module - Random Forest
  - [x] 6.1 Create Random Forest training function
    - Write `train_random_forest()` function with hyperparameters: n_estimators=500, max_depth=10, min_samples_split=10
    - Include features: SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM, mean_rolling_correlation, permutation_entropy, Minsky_regime_encoded
    - Use TimeSeriesSplit with 5 folds for cross-validation (not standard k-fold)
    - Train Random Forest regressor and compute predictions on test set
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.2 Implement Random Forest metrics and feature importance
    - Compute RMSE, MAE, and R² for each cross-validation fold and test set
    - Compute regime-specific RMSE for HEDGE, SPECULATIVE, and PONZI subsets of test set
    - Compute Gini-based feature importance scores for all features
    - Compute permutation-based feature importance scores for all features
    - Store all results in dictionary with metrics, regime_rmse, and feature_importance
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 7. Implement SHAP explainability
  - [x] 7.1 Create SHAP computation function
    - Write `compute_shap_values()` function using TreeExplainer for Random Forest
    - Compute SHAP values for all test set observations
    - Compute mean absolute SHAP values per feature as global importance measure
    - _Requirements: 8.1, 8.2_

  - [x] 7.2 Implement regime-specific SHAP analysis
    - Compute separate SHAP values for HEDGE, SPECULATIVE, and PONZI observations
    - Identify dominant feature (highest mean absolute SHAP) for each regime
    - Store SHAP values as matrix (observations × features) with feature names
    - _Requirements: 8.3, 8.4, 8.5_

  - [ ]* 7.3 Generate SHAP summary plot
    - Create SHAP summary plot using shap.summary_plot()
    - Save as PNG to `python/outputs/shap_summary.png` for report inclusion
    - _Requirements: 8.6_

- [x] 8. Implement model performance comparison
  - [x] 8.1 Create model comparison function
    - Write `compare_models()` function accepting OLS and RF results dictionaries
    - Generate comparison table with rows for each model and columns for R², RMSE, MAE, regime-specific RMSE
    - Identify and flag best-performing model for each metric
    - _Requirements: 10.1, 10.2_

  - [x] 8.2 Implement Minsky framework validation
    - Compute percentage improvement of RF over OLS for each metric
    - Test whether RF outperforms OLS specifically in PONZI regime (validates Minsky framework)
    - Store validation results in comparison dictionary with rf_improvement_pct and ponzi_validation
    - _Requirements: 10.3, 10.4, 30.3_

  - [x] 8.3 Implement JSON export for model outputs
    - Write `export_model_outputs()` function
    - Create JSON structure with metadata (timestamp, python_version, libraries), ols, random_forest, shap, and comparison sections
    - Write to `src/data/model_outputs.json`
    - _Requirements: 6.7, 7.8, 10.5, 22.3, 22.4_

  - [ ]* 8.4 Generate performance comparison visualization
    - Create bar chart comparing models across metrics
    - Save as PNG to `python/outputs/model_comparison.png`
    - _Requirements: 10.6_

- [x] 9. Create Python pipeline orchestration script
  - Write `python/export_json.py` that runs preprocessing, feature engineering, and models in sequence
  - Import and call functions from each module in correct order
  - Add console logging with timestamps for each processing step
  - Ensure script completes in under 5 minutes on standard hardware
  - Add error handling with descriptive messages for missing files or processing failures
  - _Requirements: 22.1, 22.2, 22.5, 26.1, 26.3_

- [ ] 10. Checkpoint - Verify ML pipeline outputs
  - Run `python/export_json.py` end-to-end
  - Verify all three JSON files are created in `src/data/` with correct structure
  - Check that RF outperforms OLS in PONZI regime (validates Minsky framework)
  - Ensure all tests pass, ask the user if questions arise

- [ ] 11. Set up React project structure
  - Initialize Vite project with React and TypeScript templates
  - Create directory structure: `src/components/`, `src/contexts/`, `src/data/`, `src/styles/`, `src/routes/`
  - Configure Vite for static JSON imports and CSS Modules
  - Create `src/styles/variables.css` with color palette (HEDGE: #2d6a4f, SPECULATIVE: #e9a800, PONZI: #c1121f) and typography
  - _Requirements: 12.6, 24.5_

- [ ] 12. Implement DateContext provider
  - [ ] 12.1 Create DateContext with global state
    - Write `src/contexts/DateContext.tsx` with React context
    - Define DateContextValue interface with selectedDate, setSelectedDate, dateRange, keyEvents
    - Load cleaned_data.json and features.json to determine date range
    - Define key events array with dates and labels (Flash Crash May 6 2010, Greece crisis April 2010)
    - _Requirements: 12.5_

  - [ ] 12.2 Implement date update logic with validation
    - Create setSelectedDate function that clamps to valid date range
    - Log warning when invalid date is provided
    - Provide DateContext.Provider wrapping entire app
    - _Requirements: 26.4_

- [ ] 13. Implement Clock Visual component
  - [ ] 13.1 Create SVG circular gauge structure
    - Write `src/components/ClockVisual.tsx` with TypeScript interfaces for props
    - Render SVG with three colored arc segments: HEDGE (0-33°, green), SPECULATIVE (34-66°, amber), PONZI (67-100°, red)
    - Calculate arc paths using D3 arc generator
    - _Requirements: 11.1_

  - [ ] 13.2 Implement animated needle and center display
    - Create animated needle pointing to current fragility score using CSS transitions (600ms cubic-bezier)
    - Display current date and raw fragility score value in center of clock
    - Implement pulse animation for outer ring when fragility score crosses regime threshold (33 or 67)
    - _Requirements: 11.2, 11.3, 11.4, 11.6_

  - [ ] 13.3 Add regime badges and event markers
    - Display three pill badges beneath clock: current regime label, 30-day trend arrow (↑↓→), dominant contagion source
    - Render event markers on outer ring for key dates with hover annotations
    - Calculate 30-day trend by comparing current score to score 30 days prior
    - _Requirements: 11.5, 11.7_

  - [ ]* 13.4 Write component tests for Clock Visual
    - Test needle position matches input fragility score
    - Test regime color changes at thresholds
    - Test animation triggers on score updates
    - _Requirements: 29.4_

- [ ] 14. Implement Regime Timeline component
  - [ ] 14.1 Create Recharts AreaChart with regime coloring
    - Write `src/components/RegimeTimeline.tsx`
    - Render Recharts AreaChart with date on X-axis and fragility score (0-100) on Y-axis
    - Use regime-specific fill colors from variables.css
    - Display full 536-observation time series without downsampling
    - _Requirements: 14.1, 14.2, 14.6_

  - [ ] 14.2 Add event markers and interactivity
    - Overlay vertical dashed lines with labels for key events
    - Implement onClick handler that updates DateContext when user clicks on timeline
    - Display tooltip on hover showing date, fragility score, and regime label
    - _Requirements: 14.3, 14.4, 14.5_

- [ ] 15. Implement Date Scrubber component
  - [ ] 15.1 Create horizontal slider with date range
    - Write `src/components/DateScrubber.tsx`
    - Render HTML range input spanning full date range (Jan 2009 - Aug 2011)
    - Display currently selected date as formatted text (e.g., "May 6, 2010")
    - Mark key event dates with vertical tick marks
    - _Requirements: 13.1, 13.3, 13.4_

  - [ ] 15.2 Implement debounced date updates
    - Add onChange handler that updates DateContext.selectedDate
    - Debounce updates by 100ms to prevent excessive re-rendering during drag
    - Sync with RegimeTimeline clicks (listen to DateContext changes)
    - _Requirements: 13.2, 13.5, 13.6_

- [ ] 16. Implement Correlation Heatmap component
  - [ ] 16.1 Create custom SVG grid with D3 color scale
    - Write `src/components/CorrelationHeatmap.tsx`
    - Render SVG grid with rows and columns for all 8 indices
    - Use D3 diverging color scale: blue (#2166ac) for -1, white for 0, red (#d6604d) for +1
    - Display 60-day rolling correlation values at currently selected date
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ] 16.2 Add hover interactions and transitions
    - Display exact correlation value and 30-day delta on hover
    - Update cell colors with 300ms transition when DateContext.selectedDate changes
    - Display correlation values as text overlays when cell size exceeds 40px
    - _Requirements: 15.4, 15.5, 15.6_

- [ ] 17. Implement SHAP Feature Importance Chart component
  - [ ] 17.1 Create horizontal bar chart with regime toggle
    - Write `src/components/SHAPChart.tsx`
    - Render Recharts BarChart with features on Y-axis and mean absolute SHAP values on X-axis
    - Color bars by positive/negative mean SHAP direction (positive = teal, negative = red)
    - Sort features by mean absolute SHAP value in descending order
    - _Requirements: 16.1, 16.2, 16.6_

  - [ ] 17.2 Implement regime toggle and auto-generated caption
    - Add regime toggle buttons (HEDGE, SPECULATIVE, PONZI) with local state
    - Update bars with 300ms transition when regime changes
    - Display auto-generated caption stating dominant feature and contribution percentage
    - _Requirements: 16.3, 16.4, 16.5_

- [ ] 18. Implement Network MST Visualization component
  - [ ] 18.1 Create D3 force-directed graph structure
    - Write `src/components/NetworkMST.tsx`
    - Compute Minimum Spanning Tree using Mantegna distance (sqrt(2(1-correlation))) from correlation matrix
    - Render D3 force-directed graph with nodes representing market indices
    - Size nodes proportionally to betweenness centrality
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ] 18.2 Add node coloring and interactivity
    - Color nodes by regime-specific activity (volatility at selected date)
    - Display node labels and show exact centrality values on hover
    - Update edge weights with animated transitions when DateContext.selectedDate changes
    - _Requirements: 17.4, 17.5, 17.6_

- [ ] 19. Implement Model Performance Table component
  - Write `src/components/ModelPerformanceTable.tsx`
  - Display rows for OLS and Random Forest with columns for R², RMSE, MAE, regime-specific RMSE
  - Highlight best value in each column with teal background color
  - Display callout if RF outperforms OLS in PONZI regime
  - Format numeric values to 4 decimal places
  - Style as clean table with alternating row colors and border styling
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [ ] 20. Implement Regime Statistics Card component
  - Write `src/components/RegimeStatsCard.tsx`
  - Display 3-column grid with one column per regime (HEDGE, SPECULATIVE, PONZI)
  - Show statistics per regime: count of days, mean ISE return, volatility (std dev), mean fragility score
  - Display small sparklines showing distribution shape for each regime
  - Use regime-specific colors for visual consistency
  - Format percentages to 2 decimal places and counts as integers
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ] 21. Checkpoint - Verify all components render correctly
  - Test each component in isolation with sample data
  - Verify DateContext updates propagate to all components
  - Check that all visualizations match design specifications
  - Ensure all tests pass, ask the user if questions arise

- [ ] 22. Implement dashboard layout and routing
  - [ ] 22.1 Create main dashboard route
    - Write `src/routes/Dashboard.tsx` with component layout
    - Arrange components in desktop layout: Clock Visual (left), Regime Timeline (right top), Date Scrubber (full width), three-panel row (Heatmap, SHAP, MST), two-panel row (Performance Table, Regime Stats)
    - Implement responsive layout with CSS Grid and media queries
    - Switch to mobile layout (single-column stack, tabbed panels) when viewport width < 768px
    - _Requirements: 12.3, 12.4, 23.4_

  - [ ] 22.2 Create header with title and mode toggle
    - Add header component with title "Financial Fragility Clock"
    - Add mode toggle button for switching to presentation mode
    - Style header with consistent typography and colors
    - _Requirements: 12.2_

  - [ ] 22.3 Set up React Router with three routes
    - Configure React Router with routes: "/" (main dashboard), "/present" (presentation mode), "/methods" (methodology explainer)
    - Lazy-load presentation mode route to reduce initial bundle size
    - Add navigation links in header
    - _Requirements: 12.1, 27.5_

- [ ] 23. Implement Presentation Mode
  - [ ] 23.1 Create presentation route with 5 panels
    - Write `src/routes/PresentationMode.tsx`
    - Render 5 full-screen panels with dark theme (background #1a1a2e)
    - Panel 1: Clock Visual at PONZI date (May 2010) with caption "This is what a Minsky moment looks like in data"
    - Panel 2: Regime Timeline with methodology caption
    - Panel 3: SHAP Chart (PONZI regime selected) with key finding caption
    - Panel 4: Side-by-side Network MST (Jan 2009 vs May 2010) with contagion topology caption
    - Panel 5: Model Performance Table with business interpretation paragraph
    - _Requirements: 20.1, 20.3, 20.4, 20.5, 20.6, 20.7, 20.9_

  - [ ] 23.2 Implement keyboard navigation
    - Add keyboard event listeners for left/right arrow keys to navigate between panels
    - Add F key handler for fullscreen toggle
    - Display slide number indicator in bottom-right corner
    - Implement horizontal slide animation (400ms) between panels
    - _Requirements: 20.2, 20.8, 20.10_

- [ ] 24. Implement methodology explainer route
  - Write `src/routes/Methods.tsx` with theoretical foundation and methodology explanation
  - Include sections: Minsky's Financial Instability Hypothesis, fragility score formula, regime classification, model comparison
  - Cite Minsky (1992) and peer-reviewed sources
  - Document all assumptions and limitations
  - Style as readable article with proper typography
  - _Requirements: 30.1, 30.2, 30.6_

- [ ] 25. Implement PNG export functionality
  - [ ] 25.1 Create export utility function
    - Write `src/utils/exportChart.ts` with function to render chart to canvas at 150 DPI
    - Use html2canvas or similar library to capture chart DOM elements
    - Trigger browser download with descriptive filename
    - _Requirements: 21.2, 21.3_

  - [ ] 25.2 Add export buttons to chart components
    - Add export button to each chart component (Timeline, Heatmap, SHAP, MST, Performance Table)
    - Ensure exported PNGs have white background and all labels/legends visible
    - Maintain aspect ratio and ensure text remains readable at report print size
    - _Requirements: 21.1, 21.4, 21.5_

- [ ] 26. Implement error handling and validation
  - Add error boundaries to catch React component errors and display fallback UI
  - Add error handling for failed JSON data loads with troubleshooting steps
  - Add FileNotFoundError handling in Python pipeline with expected file paths
  - Add validation for date inputs in DateContext with clamping to valid range
  - Add logging for NaN values in feature engineering beyond expected rolling window gaps
  - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6_

- [ ] 27. Implement performance optimizations
  - [ ] 27.1 Optimize React rendering
    - Wrap expensive components (NetworkMST, CorrelationHeatmap) with React.memo
    - Use useMemo for expensive calculations (correlation matrix lookups, SHAP data filtering)
    - Use useCallback for event handlers passed to child components
    - _Requirements: 27.2_

  - [ ] 27.2 Optimize D3 transitions
    - Cancel in-progress D3 transitions when new data arrives
    - Use D3 transition.interrupt() to prevent animation queue buildup
    - Ensure all visualizations update within 200ms of DateContext change
    - _Requirements: 27.1, 27.4_

  - [ ] 27.3 Optimize build output
    - Configure Vite for code splitting and tree shaking
    - Precompute all rolling correlation matrices at build time (already done in Python pipeline)
    - Run Lighthouse performance audit and achieve 90+ score on desktop
    - _Requirements: 27.3, 27.6_

- [ ] 28. Implement accessibility features
  - Add ARIA labels to all charts and interactive components
  - Ensure full keyboard navigation support (Tab, Enter, Arrow keys) for all interactive elements
  - Verify color contrast ratios of at least 4.5:1 for all text
  - Add skip-to-content link for keyboard users
  - Provide text alternatives for visual information (chart data available on request)
  - Use patterns/labels in addition to color to convey information
  - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6_

- [ ] 29. Create comprehensive documentation
  - [ ] 29.1 Write README.md with setup instructions
    - Document Python setup: create virtual environment, install requirements.txt, run export_json.py
    - Document React setup: npm install, npm run dev, npm run build
    - Include architecture overview with system diagram
    - Document deployment instructions for Vercel
    - _Requirements: 23.5, 24.3_

  - [ ] 29.2 Add code documentation
    - Add Python docstrings for all functions describing parameters, return values, and purpose
    - Add JSDoc comments for all React components describing props and behavior
    - Add inline comments explaining complex calculations (fragility score formula, permutation entropy, Mantegna distance)
    - _Requirements: 24.1, 24.2, 24.4_

  - [ ] 29.3 Document dependencies and versions
    - Ensure requirements.txt has all Python dependencies pinned to specific versions
    - Ensure package.json has all Node dependencies pinned to specific versions
    - Document Python version requirement (3.9+) and Node version requirement (18+)
    - _Requirements: 24.6_

- [ ] 30. Prepare for Vercel deployment
  - [ ] 30.1 Configure Vercel deployment
    - Create `vercel.json` with build configuration
    - Ensure static JSON files are included in build output
    - Configure routing for SPA (redirect all routes to index.html)
    - _Requirements: 23.1, 23.2_

  - [ ] 30.2 Test deployment locally
    - Run `npm run build` and verify dist/ output
    - Test production build locally with `npm run preview`
    - Verify initial page load completes within 3 seconds
    - Test on multiple browsers (Chrome, Firefox, Safari, Edge)
    - _Requirements: 23.3, 23.6_

  - [ ] 30.3 Deploy to Vercel and verify
    - Run `vercel deploy` and deploy to production
    - Test deployed site on desktop (1920×1080), tablet (768×1024), and mobile (375×667) viewports
    - Verify all functionality works correctly on live site
    - Update README.md with live URL
    - _Requirements: 23.1, 23.4, 23.5_

- [ ] 31. Final checkpoint - End-to-end validation
  - Run full Python pipeline from raw CSV to JSON outputs
  - Build and deploy React dashboard to Vercel
  - Test all interactive features: date scrubber, regime timeline clicks, chart exports, presentation mode navigation
  - Verify all requirements are met and all acceptance criteria pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical break points
- Python pipeline must complete before React implementation begins (JSON files are dependencies)
- All visualizations must update within 200ms of date changes for responsive UX
- The project follows a static architecture with no backend API - all computation happens at build time
