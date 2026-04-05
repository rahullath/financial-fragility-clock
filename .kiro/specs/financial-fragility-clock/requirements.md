# Requirements Document

## Introduction

The Financial Fragility Clock is a Minsky-regime-aware composite index dashboard for analyzing financial market fragility using the Istanbul Stock Exchange (ISE) dataset. The system combines Minsky's Financial Instability Hypothesis with modern machine learning techniques to visualize financial fragility across three regimes: HEDGE, SPECULATIVE, and PONZI. This project is designed for the Big Data Management assignment (MSc FinTech, University of Birmingham) and produces three linked outputs: an interactive dashboard, a presentation mode for video recording, and exportable figures for written reports.

## Glossary

- **Dashboard**: The React-based web application providing interactive exploration of model outputs
- **Presentation_Mode**: A keyboard-navigable 5-panel walkthrough route within the Dashboard
- **Clock_Visual**: A circular gauge displaying the current Fragility Score with regime zones
- **Fragility_Score**: A composite index (0-100) measuring systemic financial fragility
- **Minsky_Regime**: One of three financial stability states (HEDGE, SPECULATIVE, PONZI) based on Minsky's Financial Instability Hypothesis
- **ISE_Dataset**: Istanbul Stock Exchange daily observations from January 2009 to August 2011 (536 observations, 8 variables)
- **ML_Pipeline**: Python-based data preprocessing, feature engineering, and model training workflow
- **Rolling_Correlation**: 60-day moving window Pearson correlation between market indices
- **Permutation_Entropy**: A complexity measure for time series indicating orderliness vs randomness
- **SHAP_Values**: SHapley Additive exPlanations for model feature importance
- **MST**: Minimum Spanning Tree network visualization of market correlations
- **OLS_Model**: Ordinary Least Squares multivariate regression baseline model
- **RF_Model**: Random Forest regressor as the core predictive model
- **LSTM_Model**: Long Short-Term Memory neural network for temporal sequence modeling (optional)
- **Regime_Timeline**: Stacked area chart showing fragility score evolution over time
- **Date_Scrubber**: Interactive timeline slider for navigating historical dates

## Requirements

### Requirement 1: Data Preprocessing and Validation

**User Story:** As a data scientist, I want to preprocess the ISE dataset with proper quality controls, so that downstream models receive clean, validated input data.

#### Acceptance Criteria

1. WHEN the ISE dataset CSV file is loaded, THE Preprocessing_Module SHALL parse all 536 observations with 9 columns (date, ISE_TL, ISE_USD, SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM)
2. THE Preprocessing_Module SHALL identify and handle missing values using forward-fill imputation for gaps less than 3 consecutive days
3. WHEN missing value gaps exceed 3 consecutive days, THE Preprocessing_Module SHALL flag the observation and exclude it from model training
4. THE Preprocessing_Module SHALL convert the date column to datetime index format with daily frequency
5. THE Preprocessing_Module SHALL select ISE_USD as the target variable for all predictive models
6. THE Preprocessing_Module SHALL export cleaned data to JSON format for Dashboard consumption
7. FOR ALL numeric columns, THE Preprocessing_Module SHALL compute and store descriptive statistics (mean, std, min, max, quartiles)
8. THE Preprocessing_Module SHALL perform Shapiro-Wilk normality tests on all return series and store results in diagnostics output

### Requirement 2: Feature Engineering - Rolling Correlation

**User Story:** As a quantitative analyst, I want to compute rolling correlation matrices, so that I can detect periods of increased market co-movement indicating fragility.

#### Acceptance Criteria

1. WHEN the cleaned dataset is available, THE Feature_Engineering_Module SHALL compute 60-day rolling Pearson correlations for all pairwise combinations of the 8 market indices
2. THE Feature_Engineering_Module SHALL calculate mean absolute rolling correlation at each time point as a fragility indicator
3. THE Feature_Engineering_Module SHALL compute correlation concentration (variance of correlation matrix) at each time point
4. THE Feature_Engineering_Module SHALL calculate the maximum eigenvalue of the rolling correlation matrix at each time point
5. WHEN rolling window size exceeds available historical data, THE Feature_Engineering_Module SHALL return NaN for that observation
6. THE Feature_Engineering_Module SHALL store rolling correlation time series in features.json with date alignment
7. THE Feature_Engineering_Module SHALL generate a full-period correlation heatmap for exploratory data analysis

### Requirement 3: Feature Engineering - Permutation Entropy

**User Story:** As a complexity researcher, I want to compute permutation entropy on return series, so that I can detect regime transitions from random to ordered market behavior.

#### Acceptance Criteria

1. THE Feature_Engineering_Module SHALL compute permutation entropy on ISE_USD returns using embedding dimension m=3 and time delay=1
2. THE Feature_Engineering_Module SHALL apply permutation entropy calculation on 30-day rolling windows
3. WHEN permutation entropy drops below the 25th percentile of historical values, THE Feature_Engineering_Module SHALL flag this as a potential crisis precursor
4. THE Feature_Engineering_Module SHALL invert permutation entropy values (1 - normalized_PE) for inclusion in the Fragility_Score formula
5. THE Feature_Engineering_Module SHALL store permutation entropy time series in features.json with date alignment

### Requirement 4: Feature Engineering - Minsky Regime Labeling

**User Story:** As a financial economist, I want to classify each observation into Minsky regimes, so that I can analyze model performance across different market conditions.

#### Acceptance Criteria

1. WHEN mean rolling correlation is less than 0.4 AND ISE rolling volatility is below 0.8x historical median, THE Feature_Engineering_Module SHALL label the observation as HEDGE regime
2. WHEN mean rolling correlation is between 0.4 and 0.7 OR ISE rolling volatility is between 0.8x and 1.5x historical median, THE Feature_Engineering_Module SHALL label the observation as SPECULATIVE regime
3. WHEN mean rolling correlation exceeds 0.7 AND ISE rolling volatility exceeds 1.5x historical median, THE Feature_Engineering_Module SHALL label the observation as PONZI regime
4. THE Feature_Engineering_Module SHALL compute 30-day rolling volatility (standard deviation) for ISE_USD returns
5. THE Feature_Engineering_Module SHALL store Minsky regime labels as categorical features in features.json
6. THE Feature_Engineering_Module SHALL compute regime transition dates (HEDGE→SPECULATIVE, SPECULATIVE→PONZI, etc.)

### Requirement 5: Fragility Score Computation

**User Story:** As a risk manager, I want a single composite fragility score, so that I can quickly assess current systemic risk level.

#### Acceptance Criteria

1. THE Feature_Engineering_Module SHALL compute Fragility_Score using the weighted formula: 0.40 × Rolling_Correlation_60d + 0.30 × Permutation_Entropy_inverted + 0.20 × Rolling_Volatility_30d_normalized + 0.10 × RF_Prediction_Error_rolling
2. THE Feature_Engineering_Module SHALL normalize all component features to [0,1] range using min-max scaling before applying weights
3. THE Feature_Engineering_Module SHALL multiply the final composite score by 100 to produce a 0-100 display value
4. WHEN any component feature is NaN due to insufficient rolling window data, THE Feature_Engineering_Module SHALL return NaN for Fragility_Score at that observation
5. THE Feature_Engineering_Module SHALL store Fragility_Score time series in features.json with date alignment

### Requirement 6: OLS Baseline Model

**User Story:** As a model developer, I want to train an OLS regression baseline, so that I can establish a linear benchmark for comparison with non-linear models.

#### Acceptance Criteria

1. THE Models_Module SHALL train an OLS multivariate regression with ISE_USD as target and all 7 global indices (SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM) as predictors
2. THE Models_Module SHALL use an 80/20 time-based train-test split (first 428 observations for training, last 108 for testing)
3. THE Models_Module SHALL compute and store regression coefficients (beta values) for each predictor
4. THE Models_Module SHALL compute RMSE, MAE, and R² on both training and test sets
5. THE Models_Module SHALL compute regime-specific RMSE for HEDGE, SPECULATIVE, and PONZI subsets of the test set
6. THE Models_Module SHALL perform Durbin-Watson test for autocorrelation and Breusch-Pagan test for heteroskedasticity on residuals
7. THE Models_Module SHALL store OLS results in model_outputs.json including coefficients, metrics, and diagnostic test results

### Requirement 7: Random Forest Model

**User Story:** As a machine learning engineer, I want to train a Random Forest regressor with regime features, so that I can capture non-linear relationships and regime-dependent dynamics.

#### Acceptance Criteria

1. THE Models_Module SHALL train a Random Forest regressor with n_estimators=500, max_depth=10, min_samples_split=10
2. THE Models_Module SHALL include the following features: SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM, mean_rolling_correlation, permutation_entropy, and Minsky_regime_encoded
3. THE Models_Module SHALL use TimeSeriesSplit with 5 folds for cross-validation (NOT standard k-fold)
4. THE Models_Module SHALL compute RMSE, MAE, and R² for each cross-validation fold
5. THE Models_Module SHALL compute regime-specific RMSE for HEDGE, SPECULATIVE, and PONZI subsets of the test set
6. THE Models_Module SHALL compute Gini-based feature importance scores for all features
7. THE Models_Module SHALL compute permutation-based feature importance scores for all features
8. THE Models_Module SHALL store RF results in model_outputs.json including metrics, feature importance, and per-fold performance

### Requirement 8: SHAP Explainability

**User Story:** As a model interpreter, I want SHAP values for Random Forest predictions, so that I can explain individual predictions and identify key drivers of ISE returns.

#### Acceptance Criteria

1. THE Models_Module SHALL compute SHAP values using TreeExplainer for all test set observations
2. THE Models_Module SHALL compute mean absolute SHAP values per feature as a global importance measure
3. THE Models_Module SHALL compute regime-specific SHAP values (separate analysis for HEDGE, SPECULATIVE, and PONZI observations)
4. THE Models_Module SHALL identify the dominant feature (highest mean absolute SHAP) for each regime
5. THE Models_Module SHALL store SHAP values in model_outputs.json as a matrix (observations × features)
6. THE Models_Module SHALL generate a SHAP summary plot and save as PNG for report inclusion

### Requirement 9: LSTM Model (Optional)

**User Story:** As a deep learning researcher, I want to train an LSTM model, so that I can explicitly model temporal dependencies in the return series.

#### Acceptance Criteria

1. WHERE LSTM implementation is included, THE Models_Module SHALL use a sequence length of 30 days as input window
2. WHERE LSTM implementation is included, THE Models_Module SHALL use 1-2 LSTM layers with 64-128 units per layer
3. WHERE LSTM implementation is included, THE Models_Module SHALL apply dropout regularization (0.2-0.3) to prevent overfitting
4. WHERE LSTM implementation is included, THE Models_Module SHALL use walk-forward validation (train on first 300 obs, test on next 30, slide window)
5. WHERE LSTM implementation is included, THE Models_Module SHALL compute RMSE, MAE, and R² on test set
6. WHERE LSTM implementation is included, THE Models_Module SHALL compute regime-specific RMSE for comparison with OLS and RF
7. WHERE LSTM implementation is included, THE Models_Module SHALL store LSTM results in model_outputs.json

### Requirement 10: Model Performance Comparison

**User Story:** As a project evaluator, I want a structured comparison of all models, so that I can identify which approach performs best under different market conditions.

#### Acceptance Criteria

1. THE Models_Module SHALL generate a comparison table with rows for each model (OLS, RF, LSTM if included) and columns for R², RMSE, MAE, and regime-specific RMSE
2. THE Models_Module SHALL identify and flag the best-performing model for each metric
3. THE Models_Module SHALL compute the percentage improvement of RF over OLS for each metric
4. THE Models_Module SHALL test whether RF outperforms OLS specifically in PONZI regime (this validates the Minsky framework)
5. THE Models_Module SHALL store the comparison table in model_outputs.json
6. THE Models_Module SHALL generate a performance comparison visualization and save as PNG

### Requirement 11: Clock Visual Component

**User Story:** As a dashboard user, I want to see a circular clock gauge showing current fragility, so that I can quickly assess the regime state at any point in time.

#### Acceptance Criteria

1. THE Clock_Visual SHALL render as an SVG circular gauge with three colored arc segments: HEDGE (0-33, green #2d6a4f), SPECULATIVE (34-66, amber #e9a800), PONZI (67-100, red #c1121f)
2. THE Clock_Visual SHALL display an animated needle pointing to the current Fragility_Score
3. WHEN the Date_Scrubber changes, THE Clock_Visual SHALL animate the needle to the new score using a 600ms cubic-bezier easing function
4. THE Clock_Visual SHALL display the current date and raw fragility score value in the center of the clock
5. THE Clock_Visual SHALL display three pill badges beneath the clock showing: current regime label, 30-day trend arrow (↑↓→), and dominant contagion source
6. WHEN Fragility_Score crosses a regime threshold (33 or 67), THE Clock_Visual SHALL pulse the outer ring once
7. THE Clock_Visual SHALL display event markers on the outer ring for key dates (May 6 2010 Flash Crash, April 2010 Greece crisis) with hover annotations

### Requirement 12: Dashboard Layout and Routing

**User Story:** As a dashboard user, I want a well-organized layout with multiple views, so that I can explore data interactively or present findings in a structured way.

#### Acceptance Criteria

1. THE Dashboard SHALL implement three routes: "/" (main dashboard), "/present" (presentation mode), "/methods" (methodology explainer)
2. THE Dashboard SHALL display a header with title "Financial Fragility Clock" and mode toggle button
3. THE Dashboard SHALL arrange components in desktop layout: Clock_Visual (left), Regime_Timeline (right top), Date_Scrubber (full width), three-panel row (Correlation Heatmap, SHAP Chart, Network MST), two-panel row (Model Performance Table, Regime Stats)
4. WHEN viewport width is less than 768px, THE Dashboard SHALL switch to mobile layout with single-column stack and tabbed panels
5. THE Dashboard SHALL load all data from static JSON imports (cleaned_data.json, features.json, model_outputs.json) with no runtime API calls
6. THE Dashboard SHALL use CSS Modules for styling with the defined color palette and typography

### Requirement 13: Date Scrubber Interaction

**User Story:** As a dashboard user, I want to scrub through historical dates, so that I can see how fragility evolved over time.

#### Acceptance Criteria

1. THE Date_Scrubber SHALL render as a horizontal slider spanning the full date range (Jan 2009 - Aug 2011)
2. WHEN the user drags the Date_Scrubber, THE Dashboard SHALL update all components (Clock_Visual, Correlation Heatmap, Network MST) to reflect the selected date
3. THE Date_Scrubber SHALL display the currently selected date as formatted text (e.g., "May 6, 2010")
4. THE Date_Scrubber SHALL mark key event dates with vertical tick marks
5. WHEN the user clicks on the Regime_Timeline chart, THE Date_Scrubber SHALL jump to that date
6. THE Date_Scrubber SHALL debounce updates by 100ms to prevent excessive re-rendering during drag

### Requirement 14: Regime Timeline Chart

**User Story:** As an analyst, I want to see fragility evolution over the full period, so that I can identify regime transitions and crisis periods.

#### Acceptance Criteria

1. THE Regime_Timeline SHALL render as a Recharts AreaChart with date on X-axis and Fragility_Score (0-100) on Y-axis
2. THE Regime_Timeline SHALL use regime-specific fill colors: HEDGE (#2d6a4f), SPECULATIVE (#e9a800), PONZI (#c1121f)
3. THE Regime_Timeline SHALL overlay vertical dashed lines with labels for key events (Flash Crash, Greece crisis, etc.)
4. WHEN the user clicks on the Regime_Timeline, THE Dashboard SHALL update the Date_Scrubber to that date
5. THE Regime_Timeline SHALL display a tooltip on hover showing date, fragility score, and regime label
6. THE Regime_Timeline SHALL render the full 536-observation time series without downsampling

### Requirement 15: Rolling Correlation Heatmap

**User Story:** As a correlation analyst, I want to see pairwise correlations at any date, so that I can identify which markets are moving together.

#### Acceptance Criteria

1. THE Correlation_Heatmap SHALL render as a custom SVG grid with rows and columns for all 8 indices (SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM, ISE_USD)
2. THE Correlation_Heatmap SHALL display 60-day rolling Pearson correlation values at the currently selected date
3. THE Correlation_Heatmap SHALL use a diverging color scale: blue (#2166ac) for -1, white for 0, red (#d6604d) for +1
4. WHEN the user hovers over a cell, THE Correlation_Heatmap SHALL display exact correlation value and 30-day delta
5. WHEN the Date_Scrubber changes, THE Correlation_Heatmap SHALL update cell colors with 300ms transition
6. THE Correlation_Heatmap SHALL display correlation values as text overlays when cell size exceeds 40px

### Requirement 16: SHAP Feature Importance Chart

**User Story:** As a model interpreter, I want to see which features drive predictions, so that I can understand what influences ISE returns.

#### Acceptance Criteria

1. THE SHAP_Chart SHALL render as a horizontal Recharts BarChart with features on Y-axis and mean absolute SHAP values on X-axis
2. THE SHAP_Chart SHALL color bars by positive/negative mean SHAP direction (positive = teal, negative = red)
3. THE SHAP_Chart SHALL include a regime toggle allowing users to switch between SHAP values for HEDGE, SPECULATIVE, and PONZI regimes
4. WHEN the regime toggle changes, THE SHAP_Chart SHALL update bars with 300ms transition
5. THE SHAP_Chart SHALL display an auto-generated caption stating the dominant feature and its contribution percentage
6. THE SHAP_Chart SHALL sort features by mean absolute SHAP value in descending order

### Requirement 17: Network MST Visualization

**User Story:** As a network analyst, I want to see market interconnections as a graph, so that I can identify contagion pathways and central nodes.

#### Acceptance Criteria

1. THE Network_MST SHALL render as a D3 force-directed graph with nodes representing market indices
2. THE Network_MST SHALL compute edges using Mantegna distance (sqrt(2(1-correlation))) from the correlation matrix at the selected date
3. THE Network_MST SHALL size nodes proportionally to betweenness centrality
4. THE Network_MST SHALL color nodes by regime-specific activity (which markets are "hot" at that date based on volatility)
5. WHEN the Date_Scrubber changes, THE Network_MST SHALL update edge weights with animated transitions
6. THE Network_MST SHALL display node labels and allow hover to show exact centrality values

### Requirement 18: Model Performance Table

**User Story:** As a model evaluator, I want to see performance metrics side-by-side, so that I can compare models objectively.

#### Acceptance Criteria

1. THE Model_Performance_Table SHALL display rows for OLS, Random Forest, and LSTM (if included)
2. THE Model_Performance_Table SHALL display columns for R², RMSE, MAE, and regime-specific RMSE (HEDGE, SPECULATIVE, PONZI)
3. THE Model_Performance_Table SHALL highlight the best value in each column with teal background color
4. THE Model_Performance_Table SHALL display a callout if RF outperforms OLS in PONZI regime
5. THE Model_Performance_Table SHALL format numeric values to 4 decimal places
6. THE Model_Performance_Table SHALL be styled as a clean table with alternating row colors and border styling

### Requirement 19: Regime Statistics Card

**User Story:** As a statistician, I want summary statistics per regime, so that I can characterize each regime quantitatively.

#### Acceptance Criteria

1. THE Regime_Stats_Card SHALL display a 3-column grid with one column per regime (HEDGE, SPECULATIVE, PONZI)
2. THE Regime_Stats_Card SHALL display the following statistics per regime: count of days, mean ISE return, volatility (std dev), mean fragility score
3. THE Regime_Stats_Card SHALL display small sparklines showing the distribution shape for each regime
4. THE Regime_Stats_Card SHALL use regime-specific colors for visual consistency
5. THE Regime_Stats_Card SHALL format percentages to 2 decimal places and counts as integers

### Requirement 20: Presentation Mode

**User Story:** As a presenter, I want a keyboard-navigable slide mode, so that I can record a professional video walkthrough.

#### Acceptance Criteria

1. THE Presentation_Mode SHALL render 5 full-screen panels with no sidebar or clutter
2. THE Presentation_Mode SHALL implement keyboard navigation: left/right arrow keys to navigate, F key for fullscreen
3. THE Presentation_Mode SHALL display Panel 1 with Clock_Visual at a PONZI date (May 2010) and caption "This is what a Minsky moment looks like in data"
4. THE Presentation_Mode SHALL display Panel 2 with Regime_Timeline and methodology caption
5. THE Presentation_Mode SHALL display Panel 3 with SHAP_Chart (PONZI regime selected) and key finding caption
6. THE Presentation_Mode SHALL display Panel 4 with side-by-side Network_MST (Jan 2009 vs May 2010) and contagion topology caption
7. THE Presentation_Mode SHALL display Panel 5 with Model_Performance_Table and business interpretation paragraph
8. THE Presentation_Mode SHALL display slide number indicator in bottom-right corner
9. THE Presentation_Mode SHALL use dark theme (background #1a1a2e) for all panels
10. THE Presentation_Mode SHALL transition between panels with horizontal slide animation (400ms)

### Requirement 21: PNG Export for Report

**User Story:** As a report author, I want to export charts as high-quality PNGs, so that I can include them in the written submission.

#### Acceptance Criteria

1. THE Dashboard SHALL provide an export button for each chart component
2. WHEN the export button is clicked, THE Dashboard SHALL render the chart to a canvas element at 150 DPI resolution
3. THE Dashboard SHALL trigger a browser download of the PNG file with descriptive filename (e.g., "regime_timeline_2009_2011.png")
4. THE Dashboard SHALL export charts with white background and all labels/legends visible
5. THE Dashboard SHALL maintain aspect ratio and ensure text remains readable at report print size

### Requirement 22: Data Export and Reproducibility

**User Story:** As a researcher, I want to export all processed data and model outputs, so that results are reproducible and auditable.

#### Acceptance Criteria

1. THE ML_Pipeline SHALL provide a single export_json.py script that regenerates all JSON files from raw data
2. WHEN export_json.py is executed, THE ML_Pipeline SHALL run preprocessing, feature engineering, and model training in sequence
3. THE ML_Pipeline SHALL write cleaned_data.json, features.json, and model_outputs.json to src/data/ directory
4. THE ML_Pipeline SHALL include metadata in each JSON file: generation timestamp, Python version, library versions
5. THE ML_Pipeline SHALL log all processing steps to console with timestamps
6. THE ML_Pipeline SHALL complete full pipeline execution in under 5 minutes on standard hardware

### Requirement 23: Deployment to Vercel

**User Story:** As a project submitter, I want to deploy the dashboard to Vercel, so that Dr. Mandal can access it via URL without local setup.

#### Acceptance Criteria

1. THE Dashboard SHALL be deployable to Vercel with a single command (vercel deploy)
2. THE Dashboard SHALL serve all static JSON files from the build output
3. THE Dashboard SHALL load within 3 seconds on initial page load
4. THE Dashboard SHALL be responsive and functional on desktop (1920×1080), tablet (768×1024), and mobile (375×667) viewports
5. THE Dashboard SHALL include a README.md with deployment instructions and live URL
6. THE Dashboard SHALL display correctly in Chrome, Firefox, Safari, and Edge browsers

### Requirement 24: Code Quality and Documentation

**User Story:** As a code reviewer, I want well-documented and maintainable code, so that the project can be understood and extended.

#### Acceptance Criteria

1. THE ML_Pipeline SHALL include docstrings for all functions describing parameters, return values, and purpose
2. THE Dashboard SHALL include JSDoc comments for all React components describing props and behavior
3. THE Project SHALL include a comprehensive README.md with setup instructions, architecture overview, and usage guide
4. THE Project SHALL include inline comments explaining complex calculations (fragility score formula, permutation entropy, etc.)
5. THE Project SHALL follow consistent code style: Python (PEP 8), JavaScript (ESLint with Airbnb config)
6. THE Project SHALL include a requirements.txt (Python) and package.json (Node) with all dependencies pinned to specific versions

### Requirement 25: Parser for CSV Dataset

**User Story:** As a data engineer, I want a robust CSV parser, so that the ISE dataset is correctly loaded regardless of formatting variations.

#### Acceptance Criteria

1. THE CSV_Parser SHALL parse the Group_5.csv file with correct column detection (date, TL BASED ISE, USD BASED ISE, SP, DAX, FTSE, NIKKEI, BOVESPA, EU, EM)
2. THE CSV_Parser SHALL handle both comma and semicolon delimiters
3. THE CSV_Parser SHALL convert date strings to datetime objects using flexible date parsing (handles DD-MMM-YY, YYYY-MM-DD, etc.)
4. WHEN the CSV_Parser encounters malformed rows, THE CSV_Parser SHALL log a warning with row number and skip the row
5. THE CSV_Parser SHALL validate that exactly 536 rows are successfully parsed
6. THE Pretty_Printer SHALL format the parsed data back to CSV with consistent formatting (YYYY-MM-DD dates, 6 decimal places for returns)
7. FOR ALL valid CSV files, parsing then printing then parsing SHALL produce an equivalent DataFrame (round-trip property)

### Requirement 26: Error Handling and Validation

**User Story:** As a system user, I want clear error messages when something goes wrong, so that I can diagnose and fix issues quickly.

#### Acceptance Criteria

1. WHEN the ML_Pipeline encounters missing input files, THE ML_Pipeline SHALL raise a FileNotFoundError with the expected file path
2. WHEN the Dashboard fails to load JSON data, THE Dashboard SHALL display an error message with troubleshooting steps
3. WHEN model training fails due to insufficient data, THE Models_Module SHALL log a descriptive error and exit gracefully
4. WHEN the Date_Scrubber receives an invalid date, THE Dashboard SHALL clamp to the nearest valid date and log a warning
5. WHEN feature engineering produces NaN values beyond expected rolling window gaps, THE Feature_Engineering_Module SHALL log affected date ranges
6. THE Dashboard SHALL implement error boundaries to catch React component errors and display fallback UI

### Requirement 27: Performance Optimization

**User Story:** As a dashboard user, I want fast interactions, so that scrubbing through dates feels responsive.

#### Acceptance Criteria

1. WHEN the Date_Scrubber changes, THE Dashboard SHALL update all visualizations within 200ms
2. THE Dashboard SHALL use React.memo for expensive components (Network_MST, Correlation_Heatmap) to prevent unnecessary re-renders
3. THE Dashboard SHALL precompute all rolling correlation matrices at build time (not runtime)
4. THE Dashboard SHALL use D3 transitions efficiently (cancel in-progress transitions when new data arrives)
5. THE Dashboard SHALL lazy-load the Presentation_Mode route to reduce initial bundle size
6. THE Dashboard SHALL achieve a Lighthouse performance score of 90+ on desktop

### Requirement 28: Accessibility Compliance

**User Story:** As an accessibility-conscious developer, I want the dashboard to be usable with keyboard and screen readers, so that it meets basic accessibility standards.

#### Acceptance Criteria

1. THE Dashboard SHALL support full keyboard navigation (Tab, Enter, Arrow keys) for all interactive elements
2. THE Dashboard SHALL include ARIA labels for all charts and interactive components
3. THE Dashboard SHALL maintain color contrast ratios of at least 4.5:1 for all text
4. THE Dashboard SHALL provide text alternatives for all visual information (chart data tables available on request)
5. THE Dashboard SHALL not rely solely on color to convey information (use patterns/labels in addition to color)
6. THE Dashboard SHALL include a skip-to-content link for keyboard users

### Requirement 29: Testing and Validation

**User Story:** As a quality assurance engineer, I want automated tests, so that I can verify correctness and catch regressions.

#### Acceptance Criteria

1. THE ML_Pipeline SHALL include unit tests for fragility score calculation with known input/output pairs
2. THE ML_Pipeline SHALL include unit tests for permutation entropy calculation validated against reference implementation
3. THE ML_Pipeline SHALL include integration tests verifying the full pipeline produces expected JSON structure
4. THE Dashboard SHALL include component tests for Clock_Visual verifying needle position matches input score
5. THE Dashboard SHALL include snapshot tests for all chart components
6. THE Project SHALL achieve 80%+ code coverage for critical path functions (fragility score, regime labeling, model training)

### Requirement 30: Theoretical Validation

**User Story:** As an academic reviewer, I want the model to be grounded in established theory, so that findings are credible and defensible.

#### Acceptance Criteria

1. THE Requirements_Document SHALL cite Minsky (1992) as the primary theoretical foundation
2. THE Requirements_Document SHALL cite at least 10 peer-reviewed sources supporting methodology choices
3. THE Model_Performance_Comparison SHALL test the hypothesis that RF outperforms OLS in PONZI regime (validates Minsky framework)
4. THE Regime_Labeling SHALL use thresholds calibrated from the data itself (not arbitrary pre-specified values)
5. THE Dashboard SHALL include a /methods route explaining the theoretical foundation and methodology
6. THE Project SHALL document all assumptions and limitations in the README.md

### Requirement 31: Dual-Model Architecture (Model A + Model B)

**User Story:** As a researcher, I want two versions of the fragility clock with different data scopes, so that I can demonstrate both assignment compliance (Model A) and real-world applicability (Model B).

#### Acceptance Criteria

1. THE System SHALL implement Model A using the ISE dataset (536 obs, 2009-2011) with quantile-based regime labeling
2. THE System SHALL implement Model B using extended data (2003-2025) from yfinance and FRED with macro-signal-enhanced regime labeling
3. THE Dashboard SHALL provide a model toggle allowing users to switch between Model A and Model B visualizations
4. WHEN Model A is selected, THE Dashboard SHALL display ISE-only data with quantile-based regimes
5. WHEN Model B is selected, THE Dashboard SHALL display extended data with historically-verified Minsky regimes (2008 crisis, 2020 COVID, 2025 current)
6. THE System SHALL maintain separate JSON outputs: model_a_features.json, model_a_outputs.json, model_b_features.json, model_b_outputs.json
7. THE Report SHALL present Model A in Section 2 (Model Development) and Model B in Section 3 (Out-of-Sample Extension)

### Requirement 32: Model B Data Pipeline - Extended Market Data

**User Story:** As a data engineer, I want to fetch 20+ years of global market data, so that Model B can capture full Minsky cycles including pre-crisis build-up.

#### Acceptance Criteria

1. THE Model_B_Pipeline SHALL fetch daily data from yfinance for: SP500, DAX, FTSE, NIKKEI, BOVESPA, MSCI_EU, MSCI_EM, BIST100, SHANGHAI, HANG_SENG, KOSPI, ASX200, VIX
2. THE Model_B_Pipeline SHALL fetch daily data from FRED API for: VIX (VIXCLS), 10Y-2Y yield spread (T10Y2Y), TED spread (TEDRATE), Fed Funds rate (FEDFUNDS), BAA-10Y credit spread (BAA10Y)
3. THE Model_B_Pipeline SHALL align all data to daily frequency with forward-fill for macro indicators
4. THE Model_B_Pipeline SHALL cover the period 2003-01-01 to 2025-12-31 (or latest available)
5. THE Model_B_Pipeline SHALL handle missing data using forward-fill for gaps ≤ 5 days, flag longer gaps
6. THE Model_B_Pipeline SHALL export cleaned data to model_b_cleaned_data.json

### Requirement 33: Model B Feature Engineering - Macro-Enhanced Fragility

**User Story:** As a quantitative analyst, I want macro signals integrated into fragility scoring, so that Model B can detect systemic risk patterns that pure correlation misses.

#### Acceptance Criteria

1. THE Model_B_Feature_Engineering SHALL compute all Model A features (rolling correlation, permutation entropy, rolling volatility)
2. THE Model_B_Feature_Engineering SHALL compute eigenvalue ratio (dominant eigenvalue / sum of eigenvalues) as a concentration measure
3. THE Model_B_Feature_Engineering SHALL compute volatility synchrony (mean of rolling volatilities across all indices)
4. THE Model_B_Feature_Engineering SHALL include normalized macro signals: VIX, TED spread, yield spread, credit spread
5. THE Model_B_Feature_Engineering SHALL compute fragility score using weighted formula: 0.25×corr + 0.20×PE_inv + 0.15×vol + 0.15×eigenvalue_ratio + 0.10×TED + 0.10×VIX + 0.05×yield_spread
6. THE Model_B_Feature_Engineering SHALL export features to model_b_features.json

### Requirement 34: Model B Regime Labeling - Historically-Verified Minsky Cycles

**User Story:** As a financial historian, I want regime labels that align with known crisis periods, so that Model B demonstrates predictive validity.

#### Acceptance Criteria

1. THE Model_B_Regime_Labeling SHALL classify 2003-2006 as HEDGE (low correlation < 0.35, TED < 0.5%, VIX < 15)
2. THE Model_B_Regime_Labeling SHALL classify 2007-early 2008 as SPECULATIVE (rising correlation 0.35-0.70, TED 1-2%, VIX 15-30)
3. THE Model_B_Regime_Labeling SHALL classify Sep 2008-Mar 2009 as PONZI (correlation > 0.80, TED > 3%, VIX > 40)
4. THE Model_B_Regime_Labeling SHALL classify Mar 2020 as PONZI (COVID crash with correlation > 0.85, VIX > 60)
5. THE Model_B_Regime_Labeling SHALL use adaptive thresholds based on rolling historical percentiles for non-crisis periods
6. THE Model_B_Regime_Labeling SHALL store regime labels with confidence scores in model_b_features.json

### Requirement 35: Model B Model Training - Crisis Prediction Validation

**User Story:** As a risk manager, I want Model B to demonstrate pre-crisis pattern detection, so that the fragility clock has forward-looking value.

#### Acceptance Criteria

1. THE Model_B_Training SHALL use walk-forward validation with expanding window (train on 2003-2007, test on 2008; train on 2003-2019, test on 2020)
2. THE Model_B_Training SHALL train Random Forest with macro features included
3. THE Model_B_Training SHALL compute regime-specific RMSE for HEDGE, SPECULATIVE, and PONZI periods
4. THE Model_B_Training SHALL test whether fragility score peaks 3-6 months before Sep 2008 and Mar 2020 crashes
5. THE Model_B_Training SHALL compute SHAP values showing macro signal importance during crisis periods
6. THE Model_B_Training SHALL export results to model_b_outputs.json

### Requirement 36: Dashboard Model Toggle and Comparison View

**User Story:** As a dashboard user, I want to switch between Model A and Model B, so that I can compare assignment-compliant results with full-scale analysis.

#### Acceptance Criteria

1. THE Dashboard SHALL display a model toggle in the header: "Model A (ISE 2009-2011)" and "Model B (Global 2003-2025)"
2. WHEN the toggle switches, THE Dashboard SHALL reload all components with the selected model's JSON data
3. THE Dashboard SHALL display a comparison panel showing both models' fragility scores for the overlapping period (2009-2011)
4. THE Dashboard SHALL annotate Model B timeline with historical events: Sep 2008 Lehman, May 2010 Flash Crash, Mar 2020 COVID, Apr 2025 Tariff Shock
5. THE Dashboard SHALL display Model B's current fragility reading (as of latest data) with regime label
6. THE Dashboard SHALL maintain separate date scrubbers for each model (Model A: 2009-2011, Model B: 2003-2025)
