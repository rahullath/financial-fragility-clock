# Financial Fragility Clock — Knowledge Library
## Research Foundation for the Group 5 Big Data Management Project
### MSc FinTech · Module 07 36320 · University of Birmingham

---

## Part 0 — Strategic Context

### 0.1 What This Document Is

This is a personal knowledge library built to support implementation of the Financial Fragility Clock — a Minsky-regime-aware composite index applied to the Istanbul Stock Exchange dataset. It covers the theoretical foundation, the full metrics landscape, the ML model selection rationale, and the research paper grounding needed for a distinction-level submission. It is not written for the assignment submission itself — it is the thinking infrastructure behind it.

### 0.2 Dr. Mandal's Mindset — What He Actually Rewards

From lecture analysis, Dr. Mandal's actual intellectual priorities are:

- **Process over perfection**: He cares far more that you can articulate *why* each methodological decision was made than whether the model achieves perfect accuracy. He explicitly said "the flow remains the same — what changes is the argument."
- **Comparison is non-negotiable**: Every session ended with the same message: apply multiple methods, compare them, justify which wins and why. A single model submission will not reach distinction regardless of quality.
- **Interpretability over complexity**: He warned against "deep learning for the sake of it" — a model with 85 samples and an LSTM is not impressive. With 536 observations, complexity must be earned through argument, not assumed.
- **Visualisation is expected**: He told a student directly "do not use Excel for figures." Jupyter-generated plots, SHAP outputs, and correlation heatmaps are the baseline expectation.
- **Feature importance is a required output**: He referenced SHAP values, Gini importance, and variable contribution analysis in every session on supervised learning. For the ISE dataset, identifying *which global index drives ISE returns and whether that changes across time* is exactly the kind of output he signals as distinction-level.
- **Business interpretation is a separate intellectual task**: He explicitly distinguished between a data analyst describing results and a finance professional contextualising them. Section 3 of the report needs to address what an *investor* or *fund manager* would do with the output — not what a data scientist sees.
- **The churn language is a copy-paste error**: He acknowledged this kind of thing in lectures — "critical reading of the brief" is mentioned in Criteria 4. Note it, reframe it correctly, and move on.
- **Network analysis is the advanced layer**: His final lecture introduced correlation-based network analytics — Pearson/Spearman correlation matrices, adjacency matrices, betweenness centrality, contagion mapping. This is directly applicable to the rolling pairwise correlation component of the Fragility Clock. Doing this earns marks that others won't even attempt.

### 0.3 The Minimal Assignment Requirements vs. The Vision

| Dimension | Minimum for Pass | Minimum for Distinction | The Fragility Clock Vision |
|-----------|-----------------|------------------------|---------------------------|
| Models | One method | Two+ with comparison | Three (OLS baseline → RF → LSTM/VAR) |
| Data | Provided ISE dataset | Provided + justified extensions | ISE + VIX, yield curve, margin debt (pending Mandal approval) |
| Feature engineering | Raw columns | Correlation analysis, normality tests | Rolling correlation, permutation entropy, Minsky regime labels |
| Interpretation | Describe results | Business framing with implications | Fragility position mapped to portfolio decision |
| Visualisation | Plots from code | Professional multi-panel figures | Clock metaphor + regime timeline + correlation heatmap |
| Theory | Brief method background | Literature-grounded methodology | Minsky FIH as primary theoretical lens |

---

## Part 1 — Theoretical Foundation

### 1.1 Minsky's Financial Instability Hypothesis

Hyman Minsky's Financial Instability Hypothesis (FIH), first formalised in his 1986 work *Stabilizing an Unstable Economy* and synthesised in his 1992 working paper for the Levy Institute, makes a structural claim about capitalist financial systems: **stability breeds instability**. The mechanism is:

1. In stable periods, borrowers and lenders become progressively more optimistic. Credit standards loosen. Debt levels rise.
2. Market participants shift from **hedge finance** (cash flows cover principal and interest) to **speculative finance** (cash flows cover only interest — principal requires rolling over debt or asset appreciation) to **Ponzi finance** (cash flows cover neither — survival depends entirely on asset price growth).
3. When enough of the system is in the speculative/Ponzi regime, a single liquidity shock triggers a cascade. Forced selling drives down asset prices, which undermines the asset-appreciation assumptions underpinning all Ponzi positions simultaneously. Correlations spike to 1. Diversification collapses. The Minsky moment occurs.

**The analytical implication for the model**: The ISE dataset (January 2009 – August 2011) is a post-GFC record. The GFC was, by consensus, the largest Minsky moment since 1929. The dataset therefore captures a market *recovering* from Ponzi conditions — the correlation structure should evolve over the period from high (post-crisis herding) to lower (recovering diversification). This is not a static prediction problem. It is a dynamic regime problem, and the regime itself is the primary signal.

**Key Minsky terminology for the report**:
- **Hedge finance unit**: Debt service fully covered by operating income
- **Speculative finance unit**: Income covers interest but not principal — must refinance
- **Ponzi finance unit**: Income covers neither — depends on asset price appreciation or new borrowing to survive
- **Minsky moment**: The abrupt transition from speculative/Ponzi dominance to crisis deleveraging
- **Financial fragility**: The aggregate proportion of the system in speculative/Ponzi states — Minsky's actual measure of systemic risk

**Citations for the report**:
- Minsky, H.P. (1992) *The Financial Instability Hypothesis*. Working Paper No. 74. Annandale-on-Hudson: Levy Economics Institute.
- Minsky, H.P. (1986) *Stabilizing an Unstable Economy*. New Haven: Yale University Press.
- Kindleberger, C.P. and Aliber, R.Z. (2011) *Manias, Panics and Crashes: A History of Financial Crises*. 6th ed. Basingstoke: Palgrave Macmillan. [Applies Minsky to historical crash sequences — dot-com, GFC]

### 1.2 Minsky Applied: Historical Crisis Mapping

The model can claim theoretical continuity across three major crises:

**Dot-Com Bubble (1995–2001)**:
- Displacement: Internet commercialisation
- Euphoria/Ponzi phase: Valuations detached from earnings — companies with no revenue achieved multi-billion dollar market caps
- Indicator signal: CAPE ratio for the Nasdaq reached ~200x earnings by 2000; margin debt peaked in early 2000
- Minsky moment: March 2000 — Nasdaq fell 78% peak-to-trough over 30 months
- Contagion: Correlation between US tech and global markets spiked during the collapse

**Housing Crisis / GFC (2003–2009)**:
- Displacement: Financial innovation (CDOs, MBS, CDS), Greenspan-era low rates
- Ponzi phase: Subprime lending at scale — borrowers unable to service debt from income, dependent on house price appreciation
- Indicator signals: US yield curve inversion (2006), VIX suppression followed by spike, margin debt peak (June 2007), credit spread expansion (2007–2008)
- Minsky moment: September 2008 (Lehman collapse) — the moment global correlation matrices approached 1
- The ISE dataset begins in January 2009, approximately 4 months post-Lehman

**COVID-19 Market Shock (February–March 2020)**:
- Not a Minsky cycle in the classical sense — the shock was exogenous (pandemic), not endogenous (credit cycle)
- However: pre-COVID markets exhibited Ponzi characteristics — historically low rates, extremely high CAPE, record margin debt, AI/tech concentration
- The speed of correlation increase (February to March 2020: S&P 500 fell 34% in 33 days) was faster than any previous crash
- Recovery was equally fast due to unprecedented monetary intervention — distorting the regime signal and making 2020–2021 analytically complex

**AI Bubble (2023–present)**:
- Displacement: ChatGPT release (November 2022), LLM infrastructure buildout
- Current regime indicators: Magnificent Seven accounted for ~60% of S&P 500 returns in 2023; NVIDIA market cap exceeded $3 trillion briefly in 2024, surpassing sovereign GDPs; P/E multiples on AI names structurally disconnected from earnings
- SVB collapse (March 2023): Early Minsky stress signal — duration mismatch, not unlike S&L crisis dynamics
- US yield curve: Most prolonged inversion in modern history (2022–2024), followed by partial normalisation

---

## Part 2 — The Metrics Landscape

This section covers every indicator relevant to the model, with justification for inclusion or exclusion given the available data.

### 2.1 Core Dataset Variables (Available, Certain)

The provided dataset gives 536 daily observations on:

| Variable | Description | Role in Model |
|----------|-------------|--------------|
| `ise2` | ISE USD-based returns | **Target variable** (Y) |
| `sp` | S&P 500 daily returns | Input — largest global equity market, primary contagion source |
| `dax` | DAX daily returns | Input — German market, Eurozone bellwether |
| `ftse` | FTSE 100 daily returns | Input — London market, relevant for UK data context |
| `nikkei` | Nikkei 225 daily returns | Input — Japanese market, Asia-Pacific proxy |
| `bovespa` | Bovespa daily returns | Input — Brazilian market, fellow emerging market |
| `eu` | MSCI Europe daily returns | Input — pan-European benchmark |
| `em` | MSCI Emerging Markets returns | Input — ISE's peer grouping |

**Note on `ise1` vs `ise2`**: The dataset contains both. `ise1` is TL-denominated; `ise2` is USD-denominated. The assignment brief specifies `ise2`. In a full analysis, the TL/USD differential is itself a signal — currency depreciation amplifies return volatility and changes the correlation structure with USD-denominated global indices.

### 2.2 Engineered Features (Derivable from Dataset)

These can all be computed from the raw dataset with no external data:

**Rolling Pairwise Correlation (the fragility signal)**:
- For each pair of the 8 variables, compute a rolling window correlation (30-day, 60-day)
- The resulting correlation matrix at each point in time has 28 unique pairwise correlations (C(8,2))
- Key derived statistics:
  - **Mean pairwise correlation**: Average across all pairs — rises sharply during crises
  - **Correlation concentration**: Variance in the correlation matrix — falls as correlations converge
  - **Max eigenvalue of correlation matrix**: In Random Matrix Theory (RMT), a spike in the leading eigenvalue indicates market-wide co-movement exceeding what random noise would generate. Directly interpretable as a fragility signal.

**Permutation Entropy (PE)**:
- PE measures the "orderliness" of a time series. A low-entropy signal is predictable/ordered; high entropy is random
- For financial returns, **a sudden drop in permutation entropy** is a documented precursor to volatility spikes and crashes — the market becomes more "ordered" (herding behaviour) just before a regime break
- Formula: For a time series of length n with embedding dimension m, PE counts the frequency of each of the m! possible ordinal patterns and computes Shannon entropy over the distribution
- Key papers: Bandt & Pompe (2002) introduced PE; Zanin et al. (2012) applied it to stock market crash detection
- Implementation: `EntroPy` library in Python (or implement manually — 10 lines of code)

**Rolling Volatility (GARCH-compatible)**:
- 20-day rolling standard deviation of each return series
- ISE rolling volatility vs. S&P rolling volatility ratio: captures periods when ISE is disproportionately volatile relative to its primary contagion source

**Return Momentum**:
- 5-day and 20-day lagged returns for each variable
- Tests whether past returns predict future ISE returns (basis for trading signal discussion in Section 3)

**Minsky Regime Labels (the advanced feature)**:
- A categorical feature derived from the rolling correlation and volatility signals
- Three states: `HEDGE` (low correlation, normal volatility), `SPECULATIVE` (rising correlation, elevated volatility), `PONZI` (high correlation, extreme volatility)
- Operationalisation: 
  - HEDGE: mean pairwise correlation < 0.4 AND ISE rolling vol < 0.8x historical median
  - SPECULATIVE: mean pairwise correlation 0.4–0.7 OR ISE rolling vol 0.8x–1.5x historical median
  - PONZI: mean pairwise correlation > 0.7 AND ISE rolling vol > 1.5x historical median
- Thresholds should be calibrated from the data itself, not pre-specified
- This label then becomes a **categorical feature in the Random Forest** — allowing the model to predict ISE returns differently depending on the current regime

### 2.3 Supplementary External Indicators (Pending Dr. Mandal Confirmation)

If external data is permitted, the following should be incorporated with explicit justification:

**CBOE VIX (Fear Index)**:
- Measures implied 30-day volatility of S&P 500 options
- The VIX-yield curve cycle is documented as one of the strongest recession predictors: low VIX + flat curve = building risk; spike in VIX + inverted/dis-inverting curve = crisis onset
- Source: FRED (Federal Reserve Bank of St. Louis) — free, daily data from 1990
- For the 2009–2011 window: VIX peaked at 89.53 on 24 October 2008 (Lehman aftermath) and was falling through the dataset period — tracking the post-crisis recovery
- Research support: Afonso et al. (2023, *Central European Journal of Economic Modelling and Econometrics*) show VIX has strong early-warning signalling properties across 47 countries, 1970–2014

**US 10Y–2Y Yield Spread**:
- The most widely cited recession indicator — curve inversion predicts recession with an average 12–18 month lead time
- The yield curve had been recovering through 2009–2011 (un-inverting from the 2006–2007 inversion)
- Source: FRED — THREEFRY10Y and DGS2 series
- In the model: used as a macro regime feature, not as a predictive variable per se

**FINRA Margin Debt / Market Cap ratio**:
- Monthly data; proxy for aggregate leverage in the system
- High margin debt relative to market cap = aggregate Ponzi finance conditions
- Source: FINRA aggregate margin debt statistics
- For 2009–2011 window: Margin debt had collapsed post-Lehman (Oct 2008 peak: $381bn → Mar 2009 trough: $173bn) and was rebuilding through the dataset period

**Credit Default Swap Spreads (iTraxx/CDX)**:
- Investment-grade and high-yield CDS indices
- Spread expansion signals rising default expectations and deteriorating credit conditions
- More granular than yield spreads for detecting non-sovereign stress
- Source: Markit/IHS (historical data available; may require institutional access)

**FinBERT Sentiment Score (Optional)**:
- NLP-based sentiment analysis applied to financial news headlines
- FinBERT (Yang et al., 2020) is a fine-tuned BERT model on financial text
- Application: Build a daily sentiment time series for 2009–2011 using archived Reuters/Bloomberg headlines
- Captures the "narrative exhaustion" signal — when expert consensus begins dismissing risks as outdated, historically a crash precursor
- Technically intensive; mark as optional enhancement

### 2.4 The Composite Fragility Score

The Fragility Clock output is a single normalised score. The construction approach:

1. Compute each sub-indicator (rolling correlation mean, PE, rolling volatility ratio, and any supplementary indicators) at each time point
2. Normalise each to [0,1] using min-max scaling over the full sample
3. Assign weights based on literature support and factor significance:
   - Mean pairwise rolling correlation: 35%
   - Permutation entropy (inverted — low entropy = high fragility): 25%
   - ISE volatility ratio: 20%
   - VIX (if available): 10%
   - Yield spread (if available): 10%
4. Map composite score to the clock:
   - 0.0–0.33 → HEDGE (6 o'clock to 9 o'clock)
   - 0.33–0.67 → SPECULATIVE (9 to 11)
   - 0.67–1.0 → PONZI/CRISIS (11 to 12)

---

## Part 3 — Machine Learning Model Selection

### 3.1 The Three-Model Strategy

The assignment requires model comparison. The correct framing is not "which model is best at predicting ISE returns" but "how does predictive performance vary across the fragility regime, and do more structurally-aware models outperform in crisis periods?"

**Model 1: OLS Multivariate Regression (Baseline)**
- Y = β₀ + β₁·sp + β₂·dax + β₃·ftse + β₄·nikkei + β₅·bovespa + β₆·eu + β₇·em + ε
- Theoretical grounding: International Capital Asset Pricing Model (ICAPM), factor models
- Why it belongs: Establishes the static correlation assumption that the Fragility Clock challenges. If the OLS model underperforms in high-fragility periods, that is direct evidence for the regime-switching approach
- Key output: Regression coefficients (interpretable as factor loadings), R², RMSE, residual structure
- Limitation to argue: Assumes linearity, stationarity, and homoskedasticity — all violated by financial return data. The Durbin-Watson test will confirm autocorrelation; Breusch-Pagan will confirm heteroskedasticity. These failures are not bugs — they are the analytical argument for the next model.

**Model 2: Random Forest Regressor (Core Model)**
- Non-parametric, handles non-linearity and interactions, produces feature importance natively
- With regime labels as features: the Random Forest can learn that the relationship between SP500 and ISE returns differs when the system is in PONZI vs. HEDGE regime
- Hyperparameter tuning: `n_estimators` (200–1000), `max_depth` (None vs. 5–15), `min_samples_split`, `max_features` — use cross-validation (TimeSeriesSplit for temporal data, NOT standard k-fold)
- Key outputs: 
  - RMSE, MAE, R² on test set
  - Feature importance (Gini impurity-based and permutation-based — use both)
  - Partial dependence plots: how ISE predicted return changes as SP500 varies, holding others constant
  - SHAP values (SHapley Additive exPlanations): theoretically grounded (cooperative game theory) individual prediction explanation
- Why Random Forest over XGBoost here: Mandal specifically taught RF; RF is more robust to overfitting on small-ish datasets (536 obs); RF's feature importance is more stable than gradient boosting's on correlated inputs
- Limitation to argue: No temporal ordering awareness — treats each observation as i.i.d. This is violated by financial time series (autocorrelation, volatility clustering). This motivates Model 3.

**Model 3: LSTM (Advanced Enhancement)**
- Long Short-Term Memory: a recurrent neural network architecture designed for sequential data
- Cell state and gating mechanism allow the network to learn long-range dependencies — precisely what matters for Minsky regime detection (the regime builds slowly over months, not days)
- Architecture: Input sequence length 30 days (rolling window), 1-2 LSTM layers (64–128 units), dropout (0.2–0.3 for regularisation), Dense output layer (1 unit for regression)
- Key advantage over RF: Explicitly models the temporal feedback — yesterday's regime affects today's prediction
- Key limitation: With 536 observations, LSTM is data-hungry. Use walk-forward validation (train on first 300 obs, test on next 30, slide window). Results may not outperform RF — and that is a valid finding if argued correctly.
- Alternative to LSTM if performance is poor: Rolling-Window VAR (Vector Autoregression) — a classical time series approach that models the joint dynamics of all 8 variables simultaneously. More interpretable than LSTM, directly produces impulse response functions (what happens to ISE when SP500 shocks by 1σ).

**Model 4 (Optional, Very High Reward): Regime-Switching Model**
- A Hidden Markov Model (HMM) or threshold VAR that explicitly estimates the probability of being in each Minsky regime at each point in time
- The HMM learns 2–3 latent states from the data (without supervising the labels), and the learned states can be compared to the hand-engineered Minsky labels from Part 2
- If the unsupervised HMM states align with the labelled Minsky regimes, this is powerful validation of the theoretical framework
- Library: `hmmlearn` in Python

### 3.2 Model Comparison Framework

| Criterion | OLS | Random Forest | LSTM | Why It Matters |
|-----------|-----|---------------|------|----------------|
| RMSE (full period) | Baseline | Expected lower | May be lower | Overall predictive accuracy |
| RMSE (PONZI regime) | Highest | Moderate | Lowest (if sufficient data) | Regime-specific performance |
| Feature importance | Coefficients | Gini + SHAP | Attention weights | Who drives ISE |
| Temporal awareness | None | None (naive) | Explicit | Dynamic regime capture |
| Interpretability | Full | Partial (SHAP) | Low (black box) | Business communication |
| Computation time | Seconds | Minutes | Hours (GPU) | Practical constraint |
| Overfitting risk (n=536) | Low | Moderate | High | Data limitation |

### 3.3 Evaluation Metrics

For regression (predicting ISE return value):
- **RMSE** (Root Mean Squared Error): Primary metric — penalises large errors heavily. Important because large prediction errors in financial returns have outsized consequences.
- **MAE** (Mean Absolute Error): Secondary metric — more robust to outliers. Compare to RMSE to understand error distribution.
- **R²** (Coefficient of Determination): Proportion of variance explained. Note: R² can be negative on test sets (model worse than a naive mean prediction) — this is a valid finding.
- **MAPE** (Mean Absolute Percentage Error): Useful for communicating error magnitude to non-technical audience. Avoid when returns near zero (division instability).

For classification (predicting direction: ISE up/down):
- **F1 Score**: Harmonic mean of precision and recall. Preferred over accuracy for potentially imbalanced classes.
- **AUC-ROC**: Area under the receiver operating characteristic curve. Model-agnostic comparison of classification models.
- **Confusion matrix**: True positives (correctly predicted up), false positives (predicted up, went down), etc.

### 3.4 Critical Cross-Validation Note

**Do not use standard k-fold cross-validation on time series data.** This is a common and serious error. Standard k-fold randomly samples observations, which allows future data to leak into the training set. For financial time series:

- Use **TimeSeriesSplit** (sklearn's implementation): Training set always precedes test set chronologically
- Or use **walk-forward validation**: Fix training window (e.g. 300 obs), test on next 30, slide forward. This is the industry-standard approach and directly mimics how the model would be used in production.
- Dr. Mandal raised the issue of distribution shift between training and test sets — walk-forward validation directly addresses this.

---

## Part 4 — Research Paper Grounding

This section provides the academic literature citations needed for Criteria 3 (depth of reading). Minimum 10 sources for distinction.

### 4.1 Core Theoretical Papers

**[1] Minsky, H.P. (1992) — The Financial Instability Hypothesis**
- Levy Economics Institute Working Paper No. 74
- The primary theoretical anchor for the entire project
- Use for: defining hedge/speculative/Ponzi finance; framing the regime-switching approach; arguing that the ISE dataset period is analytically significant

**[2] Kindleberger, C.P. & Aliber, R.Z. (2011) — Manias, Panics and Crashes**
- 6th edition, Palgrave Macmillan
- Applies Minsky's framework to historical crisis sequences: dot-com, GFC, and earlier episodes
- Use for: historical validation that the Minsky framework is predictive across multiple crash cycles

**[3] Reinhart, C.M. & Rogoff, K.S. (2009) — This Time Is Different: Eight Centuries of Financial Folly**
- Princeton University Press
- Documents the common patterns preceding financial crises across 800 years: credit expansion, asset price inflation, current account deterioration
- Use for: establishing that quantitative precursors to crises are historically consistent — supporting the idea that a trained model can detect the pattern

### 4.2 Systemic Risk and Early Warning Indicators

**[4] Afonso, A., Gomes, P. & Taamouti, A. (2023) — Early Warning Models of Banking Crises: VIX and High Profits**
- *Central European Journal of Economic Modelling and Econometrics*
- Analysed 47 countries, 1970–2014; found VIX has strong early-warning signalling properties; models with multiple variables outperform single-variable models
- Use for: justifying VIX inclusion; arguing multivariate approach over univariate

**[5] ECB Working Paper No. 1426 — CISS: A Composite Indicator of Systemic Stress**
- European Central Bank
- Constructs a composite systemic stress index for the financial system using correlation-weighted sub-indicators
- Use for: methodological precedent for composite fragility scoring; direct inspiration for the Fragility Clock construction

**[6] Greenwood, R., Hanson, S.G., Shleifer, A. & Sørensen, J.A.G. (2022) — Predictable Financial Crises**
- *Journal of Finance*, 77(2), pp.863-921
- Documents that credit boom + asset price boom combination predicts financial crises with significant power
- Use for: supporting the idea that structural imbalance signals (not just price data) predict crises

**[7] Lopez de Prado, M. (2018) — Advances in Financial Machine Learning**
- John Wiley & Sons
- Industry-standard text on applying ML to financial data; covers triple-barrier labelling, fractionally differentiated features, walk-forward validation
- Use for: methodological rigour; cross-validation strategy; feature construction in financial time series contexts

### 4.3 ML for Financial Crisis Prediction

**[8] Fosten, J. & Gutknecht, D. (2023) — Forecasting Stock Market Crashes via Machine Learning**
- *International Journal of Forecasting*, 39(2)
- Uses SVM and other ML models on Eurozone data; SVM significantly outperforms logistic regression and univariate benchmarks; exchange rate trends and current stock market risk are top predictors; no single variable consistently predicts crashes — multivariate advantage is confirmed
- Use for: justifying the multivariate approach over univariate; citing SVM as a competitor model to RF

**[9] Atsiwo, A. (2025) — A Three-Step Machine Learning Approach to Predict Market Bubbles**
- arXiv:2510.16636
- Three-step framework: bubble identification via right-tailed unit root test → feature engineering (sentiment + macro) → ML classification
- Use for: methodological inspiration for the phased approach; bubble detection methodology

**[10] Comparative Study of LSTM and Random Forest for Stock Market Prediction**
- *IRJMETS* (2024)
- Direct performance comparison: LSTM captures temporal dependencies better; RF offers interpretability and efficiency; hybrid RF-LSTM provides balanced solution
- Use for: justifying the multi-model comparison strategy; arguing the tradeoff between interpretability and temporal accuracy

### 4.4 Correlation, Networks, and Entropy in Finance

**[11] Mantegna, R.N. (1999) — Hierarchical Structure in Financial Markets**
- *European Physical Journal B*, 11, pp.193-197
- Seminal paper on using correlations to build minimum spanning trees of stock markets — direct predecessor to the rolling correlation fragility signal
- Use for: academic foundation for correlation-based fragility detection

**[12] Bandt, C. & Pompe, B. (2002) — Permutation Entropy: A Natural Complexity Measure for Time Series**
- *Physical Review Letters*, 88(17), 174102
- Original paper introducing permutation entropy
- Use for: justifying PE as a feature; citing original derivation

**[13] Battiston, S. et al. (2020) — A Perspective on Correlation-Based Financial Networks and Entropy Measures**
- *Frontiers in Physics*
- Reviews how entropy measures and correlation networks jointly detect systemic risk; structural entropy and eigen-entropy as early warning indicators
- Use for: connecting the PE feature to the systemic risk literature; citing entropy in a financial context

**[14] Ang, A. & Bekaert, G. (2002) — International Asset Allocation with Regime Shifts**
- *Review of Financial Studies*, 15(4), pp.1137-1187
- Demonstrates that cross-market correlations increase during bear market regimes — the statistical basis for the Minsky regime-switching approach
- Use for: justifying the regime-conditional correlation analysis; arguing that static correlations are insufficient

### 4.5 Istanbul Stock Exchange Specific Literature

**[15] The ISE Dataset Papers (UCI ML Repository — Akbilgic et al.)**
- The original dataset was published by Akbilgic, O., Bozdogan, H. & Balaban, M.E.
- Key finding: global index returns have moderate predictive power for ISE returns; non-linear models outperform linear models; MSCI EM and Bovespa (fellow emerging markets) show strongest correlation with ISE
- Use for: grounding baseline expectations for model performance; citing data provenance

**[16] Clustering Approaches for Financial Data Analysis: A Survey**
- (Already in your uploaded files — file:15)
- Reviews K-means, DBSCAN, hierarchical clustering on financial data
- Use for: justifying unsupervised component if HMM/regime detection is included; citing centroid-based methods as suitable for financial data

**[17] Business Analytics Using Random Forest Trees for Credit Risk**
- (Already in your uploaded files — file:16)
- Structured comparison of ML approaches; Table 1 provides directly usable framework for model comparison table in the report
- Use for: structural template for Section 2 write-up; citing RF as superior to SVM on similar financial datasets

---

## Part 5 — Implementation Roadmap

### 5.1 Section 1: Data Quality Control (Your Code — S1)

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# Load data
df = pd.read_excel('Group_5.xlsx')
df.columns = df.columns.str.lower().str.replace('.', '_', regex=False)

# 1. Basic audit
print(df.shape)         # 536 rows x 9 cols (date + 7 indices + ise2)
print(df.dtypes)
print(df.describe())

# 2. Missing values
missing = df.isnull().sum()
missing_pct = (df.isnull().sum() / len(df)) * 100

# 3. Normality test (Shapiro-Wilk — best for n<2000)
for col in df.select_dtypes(include=np.number).columns:
    stat, p = stats.shapiro(df[col].dropna())
    print(f'{col}: W={stat:.4f}, p={p:.4f}')
# Expected result: All will fail normality (fat tails in financial returns)
# This is not a problem — it is the analytical argument for non-parametric models

# 4. Distribution analysis — key visualisation
fig, axes = plt.subplots(2, 4, figsize=(16, 8))
cols = ['sp', 'dax', 'ftse', 'nikkei', 'bovespa', 'eu', 'em', 'ise2']
for i, col in enumerate(cols):
    ax = axes[i//4][i%4]
    df[col].hist(bins=50, ax=ax, edgecolor='white', color='#1a5c6e')
    ax.axvline(df[col].mean(), color='red', lw=1, ls='--', label='Mean')
    ax.set_title(col.upper(), fontsize=10)
    ax.set_xlabel('Daily Return')
plt.suptitle('Distribution of Daily Returns — ISE Dataset (Jan 2009 – Aug 2011)', 
             fontsize=13, fontweight='bold')
plt.tight_layout()
plt.savefig('distributions.png', dpi=150, bbox_inches='tight')

# 5. Outlier detection — IQR method
def iqr_outliers(series, factor=1.5):
    Q1, Q3 = series.quantile(0.25), series.quantile(0.75)
    IQR = Q3 - Q1
    return series[(series < Q1 - factor*IQR) | (series > Q3 + factor*IQR)]

# Also check Z-score method (|Z| > 3)
def zscore_outliers(series, threshold=3):
    z = np.abs(stats.zscore(series.dropna()))
    return series[z > threshold]
# 
# IMPORTANT: Do NOT remove financial outlier days — they are almost certainly 
# crisis contagion events (e.g. Flash Crash May 6 2010, European sovereign debt 
# crisis May 2010). Flag them, annotate them on the plot, and argue they are 
# analytically significant.

# 6. Correlation matrix — full period
corr_matrix = df[cols].corr()
mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
fig, ax = plt.subplots(figsize=(10, 8))
sns.heatmap(corr_matrix, mask=mask, annot=True, fmt='.2f', 
            cmap='RdYlGn', vmin=-1, vmax=1, ax=ax,
            cbar_kws={'label': 'Pearson Correlation'})
ax.set_title('Pairwise Correlation Matrix — All Global Indices vs ISE', 
             fontsize=12, fontweight='bold')
plt.tight_layout()
plt.savefig('correlation_matrix.png', dpi=150, bbox_inches='tight')
```

### 5.2 Section 2: Feature Engineering (Rolling Correlation + PE)

```python
# Rolling correlation (fragility signal)
def rolling_mean_correlation(df, window=30):
    cols = ['sp', 'dax', 'ftse', 'nikkei', 'bovespa', 'eu', 'em', 'ise2']
    roll_corrs = []
    for i in range(window, len(df)):
        window_data = df[cols].iloc[i-window:i]
        corr = window_data.corr().values
        upper = corr[np.triu_indices_from(corr, k=1)]
        roll_corrs.append(np.mean(np.abs(upper)))
    return pd.Series(roll_corrs, index=df.index[window:])

df['mean_rolling_corr'] = rolling_mean_correlation(df, window=30)

# Permutation entropy
def permutation_entropy(time_series, m=3, delay=1):
    """m = embedding dimension, delay = time delay"""
    n = len(time_series)
    permutations = {}
    for i in range(n - (m-1)*delay):
        pattern = tuple(np.argsort(time_series[i:i + m*delay:delay]))
        permutations[pattern] = permutations.get(pattern, 0) + 1
    total = sum(permutations.values())
    probs = [count/total for count in permutations.values()]
    return -sum(p * np.log2(p) for p in probs if p > 0)

# Compute PE on rolling windows
window = 30
pe_series = []
for i in range(window, len(df)):
    pe = permutation_entropy(df['ise2'].values[i-window:i], m=3)
    pe_series.append(pe)
df.loc[df.index[window:], 'pe_ise2'] = pe_series

# Minsky regime labels
def label_regime(row):
    if row['mean_rolling_corr'] > 0.7:
        return 'PONZI'
    elif row['mean_rolling_corr'] > 0.4:
        return 'SPECULATIVE'
    else:
        return 'HEDGE'

df['minsky_regime'] = df['mean_rolling_corr'].apply(
    lambda x: 'PONZI' if x > 0.7 else ('SPECULATIVE' if x > 0.4 else 'HEDGE')
)
```

### 5.3 Section 2: Model Training (Random Forest with Regime Features)

```python
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import shap

# Feature matrix
feature_cols = ['sp', 'dax', 'ftse', 'nikkei', 'bovespa', 'eu', 'em',
                'mean_rolling_corr', 'pe_ise2', 'minsky_regime_encoded']

df['minsky_regime_encoded'] = LabelEncoder().fit_transform(df['minsky_regime'])
df_model = df[feature_cols + ['ise2']].dropna()

X = df_model[feature_cols]
y = df_model['ise2']

# TimeSeriesSplit — NOT standard k-fold
tscv = TimeSeriesSplit(n_splits=5)

rf_results = []
for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    
    rf = RandomForestRegressor(
        n_estimators=500,
        max_depth=10,
        min_samples_split=10,
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    y_pred = rf.predict(X_test)
    
    rf_results.append({
        'fold': fold+1,
        'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
        'mae': mean_absolute_error(y_test, y_pred),
        'r2': r2_score(y_test, y_pred)
    })

# Final model on full training set for SHAP
rf_final = RandomForestRegressor(n_estimators=500, max_depth=10, random_state=42)
train_size = int(0.8 * len(X))
rf_final.fit(X.iloc[:train_size], y.iloc[:train_size])

# SHAP explanation
explainer = shap.TreeExplainer(rf_final)
shap_values = explainer.shap_values(X.iloc[train_size:])
shap.summary_plot(shap_values, X.iloc[train_size:], feature_names=feature_cols,
                  show=False)
plt.savefig('shap_summary.png', dpi=150, bbox_inches='tight')
```

### 5.4 The Regime-Specific Analysis (The Distinction-Level Output)

```python
# Split test set by Minsky regime
df_test = df_model.iloc[train_size:].copy()
df_test['y_pred_rf'] = rf_final.predict(X.iloc[train_size:])
df_test['error'] = np.abs(df_test['ise2'] - df_test['y_pred_rf'])

# Performance by regime
regime_performance = df_test.groupby('minsky_regime').agg({
    'error': ['mean', 'std'],
    'ise2': 'count'
}).round(4)
print(regime_performance)

# Expected finding: Model performs worse in PONZI regime (more volatile, less predictable)
# If RF + regime features outperforms OLS in PONZI regime: this validates the 
# Minsky framework quantitatively
```

---

## Part 6 — The Anti-Capitalist Argument Within Academic Constraints

This section addresses the underlying vision in `thoughts.txt` — making the critique legible within the assignment's academic framing.

### 6.1 What the Data Shows Without Saying It

The Fragility Clock is not politically neutral. Its architecture makes an implicit argument:

1. **The correlation spike is the crisis signal**: When markets become maximally correlated, diversification — the core promise of the financial industry to retail investors — collapses entirely. An investor holding a "diversified" global portfolio loses everything simultaneously. The model makes this visible.

2. **The recovery is not recovery**: The 2009–2011 dataset shows markets recovering. But recovery of asset prices ≠ recovery of the underlying conditions. The post-GFC period was characterised by unprecedented monetary expansion (QE1, QE2), near-zero interest rates, and coordinated central bank intervention. The fragility clock can show that the system re-entered the speculative regime — not because the structural causes of the GFC were addressed, but because asset prices were inflated again.

3. **The 2023–2025 extension makes the argument**: If the model trained on 2009–2011 Ponzi dynamics correctly identifies the AI bubble concentration of 2023–2025 as a SPECULATIVE-to-PONZI transition, that is evidence that the system structurally reproduces these conditions — not randomly, but as an endogenous feature of how credit-based capitalism works.

### 6.2 Academically Defensible Framing

The Section 3 business interpretation can carry this argument without abandoning academic register:

> "The model identifies a structural pattern: periods of high cross-market correlation are systematically associated with subsequent ISE return volatility and downside risk. This has direct implications for emerging market portfolio management. When the Fragility Clock indicates a SPECULATIVE-to-PONZI transition, the appropriate institutional response is to reduce ISE exposure and increase allocations to uncorrelated assets or hedging instruments. The 2009–2011 dataset captures a recovery from the largest such correlated collapse since 1929 — a period during which the conditions generating that collapse were never structurally resolved. The model's extension to 2023–2025 data — characterised by historically concentrated equity market gains, record leverage, and renewed regional banking stress — suggests the regime-switching framework retains predictive relevance beyond its training window."

This is factually accurate, academically rigorous, and makes the point without editorialising. Let the model's output do the work.

---

## Part 7 — Quick Reference: API Sources for Live Data

If Dr. Mandal approves external data integration:

| Dataset | API/Source | Python Library | Update Frequency |
|---------|-----------|----------------|-----------------|
| VIX | Yahoo Finance (`^VIX`) | `yfinance` | Daily |
| US 10Y–2Y Yield Spread | FRED (`T10Y2Y`) | `fredapi` | Daily |
| S&P 500 | Yahoo Finance (`^GSPC`) | `yfinance` | Daily |
| ISE (BIST 100) | Yahoo Finance (`XU100.IS`) | `yfinance` | Daily |
| Margin debt | FINRA | Manual download (monthly) | Monthly |
| Emerging Markets ETF | Yahoo Finance (`EEM`) | `yfinance` | Daily |

```python
import yfinance as yf
import fredapi

# Example: VIX historical
vix = yf.download('^VIX', start='2009-01-01', end='2011-08-31')

# FRED API (requires free API key from fred.stlouisfed.org)
fred = fredapi.Fred(api_key='YOUR_KEY')
yield_spread = fred.get_series('T10Y2Y', 
                                observation_start='2009-01-01',
                                observation_end='2011-08-31')
```

---

## Part 8 — Key Dates in the Dataset Period

Cross-reference model output against known events:

| Date | Event | Expected Fragility Signal |
|------|-------|--------------------------|
| Jan 2009 | Dataset begins — 4 months post-Lehman | Rolling correlation still elevated; PE low (herding continues) |
| Mar 2009 | S&P 500 trough (666 points) | Transition point — correlation should start declining |
| Apr 2009 | G20 $1.1tn stimulus package | Beginning of post-crisis recovery regime |
| Apr–May 2010 | European sovereign debt crisis erupts (Greece) | Rolling correlation spike — SPECULATIVE-to-PONZI signal |
| May 6 2010 | Flash Crash — Dow drops 1000 points in minutes | Extreme outlier day — flag in EDA, do not remove |
| Aug 2011 | Dataset ends — US credit rating downgrade (S&P) | Correlation rising again — approaching next SPECULATIVE period |

These dates provide the narrative structure for Section 3. Identify them in the data, annotate the fragility score timeline, and interpret each transition in business terms.

---

*Knowledge Library v1.0 — Compiled April 2026. For personal use in Group 5 Big Data Management project, MSc FinTech, University of Birmingham. Not for direct submission.*
