<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# thanks, what else should I research before I start building this clock/dashboard/ml-model? and what;s the best way to ensure my teammates don't get lost because they were going to do some super basic shit , and finally source of data, is there any open source api of sorts that I can use for real-time stuff etc

Three parallel things to address — what else to research, how to manage teammates, and data sources. Here's the full picture.

***

## What Else to Research Before Building

You're actually well-equipped from the knowledge library, but there are **four specific gaps** to fill before you touch a single line of code:

### 1. Time Series Stationarity (Critical, Easy to Miss)

The ISE dataset returns are *already differenced* (daily returns), so stationarity is largely handled — but you need to formally verify this. Run an **Augmented Dickey-Fuller (ADF) test** on each column. If any series is non-stationary, your rolling correlations will be spurious. Dr. Mandal cares about this implicitly — he discussed OLS assumptions failing on financial data. Knowing the ADF result preemptively shows you anticipated the problem.

```python
from statsmodels.tsa.stattools import adfuller
for col in ['sp','dax','ftse','ise2', ...]:
    result = adfuller(df[col].dropna())
    print(f"{col}: ADF={result[^0]:.3f}, p={result[^1]:.4f}")
```


### 2. Granger Causality — Which Index *Leads* ISE

This is the single most impressive piece of analysis you can add in 2 hours. Granger causality tests whether knowing the past values of (say) SP500 helps predict ISE *beyond* ISE's own past values.  This directly answers the business question: "Do US markets lead Turkish markets, or is it simultaneous?" The answer is almost certainly yes, with a 1-day lag — meaning SP500 yesterday predicts ISE today. That becomes your strongest feature.[^1]

```python
from statsmodels.tsa.stattools import grangercausalitytests
grangercausalitytests(df[['ise2', 'sp']].dropna(), maxlag=5)
```


### 3. GARCH for Volatility Modelling

Your rolling standard deviation captures volatility, but **GARCH(1,1)** is the academically correct model for time-varying volatility in financial returns. The conditional variance from GARCH becomes a far better volatility feature than a simple rolling window — it accounts for the fact that volatility clusters (high-vol days follow high-vol days). One extra feature, one powerful citation (Bollerslev 1986).

```python
from arch import arch_model
garch = arch_model(df['ise2'].dropna() * 100, vol='Garch', p=1, q=1)
res = garch.fit(disp='off')
df['ise2_garch_vol'] = res.conditional_volatility
```


### 4. Network/Graph Analysis (Mandal's Last Lecture)

He specifically taught correlation-based network analytics in his final session. Build a **minimum spanning tree (MST)** from the pairwise correlation matrix. The MST shows which index is the "hub" of the system — the most connected node. During crises, all markets collapse towards a star topology centred on the dominant market. Over 2009–2011, watch whether SP500's centrality changes. This is a 30-line networkx script and a distinction-level output.[^2]

```python
import networkx as nx
corr = df[cols].corr()
dist = np.sqrt(2 * (1 - corr))  # Mantegna distance metric
G = nx.from_pandas_adjacency(dist)
mst = nx.minimum_spanning_tree(G)
```


***

## Managing Your Teammates

The problem is clear: they're going to write the Introduction and Background Theory, run some basic correlation plots, and declare the project done. Here's how to architect around that without conflict.

### Give Them Constrained Tasks, Not Open Ones

Don't say "write the theory section." Say **"write exactly these three things"** and hand them a template:

**What to send them (literally a message):**

> *"I've done the modelling. I need you to write up exactly three things for the report: (1) a 300-word introduction explaining what the ISE dataset is and why predicting emerging market returns matters, (2) a 200-word section describing what OLS regression is and its assumptions, and (3) a 200-word section on Random Forest — what it is, what it does. Do not write conclusions or interpret the model output — I'll handle that. Use the attached knowledge library for citations."*

This approach works because:

- They get specific deliverables with word counts — no room to pad or go off-script
- They cannot accidentally contradict your model choices because you've separated interpretation from description
- If their writing is poor, it's in a section you can minimally edit without restructuring


### Version Control = Insurance

Put the project in a **GitHub repo** right now. Private repo, add them as collaborators. Even if they've never used Git, the structure protects you:

- Your modelling code is in `src/` — they should never touch it
- Their contribution goes in `report/sections/` as `.md` files
- If they break something, you revert. If they submit early, the commit history proves authorship.


### The Anti-Chasing-Marks Framing

When you hand them the knowledge library, frame the Minsky angle as the interesting story: *"The assignment is basically asking us to detect financial crises before they happen — that's actually a cool problem."* People who are mark-chasing will still do the work if it sounds impressive to describe. You're not trying to convert them, just to make the task legible.

***

## Open-Source Data Sources

Here's the full map — ranked by what you actually need:

### Tier 1 — Use These Immediately

| Source | What You Get | Python Library | Free Limit |
| :-- | :-- | :-- | :-- |
| **Yahoo Finance** | All 8 ISE dataset indices + VIX + BIST100 (XU100.IS), daily, back to 1985 | `yfinance` | Unlimited (unofficial) [^3] |
| **FRED** (Federal Reserve) | US yield curve (T10Y2Y), VIX, CPI, unemployment, Fed Funds rate | `fredapi` (free key from fred.stlouisfed.org) | 120 req/min [^3] |
| **Alpha Vantage** | 500 calls/day free — real-time + historical, 50+ technical indicators, fundamental data | `alpha_vantage` pip package | 500/day free [^4] |
| **Finnhub** | Real-time quotes, sentiment scores, insider transactions, earnings | `finnhub-python` | 60 req/min free [^5] |

```python
# Everything you need in 10 lines
import yfinance as yf
import fredapi

# ISE equivalents + all global indices + VIX, 2009–2011
tickers = ['^GSPC','^GDAXI','^FTSE','^N225','XU100.IS','^VIX','EEM','EWZ']
data = yf.download(tickers, start='2009-01-01', end='2011-08-31')['Close']

# FRED macro data (free key at fred.stlouisfed.org)
fred = fredapi.Fred(api_key='YOUR_KEY')
yield_spread = fred.get_series('T10Y2Y', observation_start='2009-01-01')
vix = fred.get_series('VIXCLS', observation_start='2009-01-01')
```


### Tier 2 — For the Live Dashboard Component

If you want the clock to run on *today's* data (which would make the dashboard genuinely impressive in the video presentation), the stack is:

- **yfinance** for live global index prices — free, no key needed, 15-min delay[^3]
- **Alpha Vantage** for clean real-time intraday data with a free key[^4]
- **FRED API** for macro context (yield curve, VIX) — updated daily[^3]

The limitation to be aware of: Yahoo Finance's unofficial API occasionally breaks when Yahoo changes its endpoint structure — `yfinance` updates to fix it, but for a live dashboard in a presentation, test the day before.

### Tier 3 — For Serious Extension

| Source | Use Case | Notes |
| :-- | :-- | :-- |
| **Quandl/Nasdaq Data Link** | Long historical macro series, futures data | Free tier limited; most useful stuff now paywalled [^3] |
| **Financial Modeling Prep (FMP)** | Fundamentals, P/E ratios, balance sheets | 250 req/day free — useful if you want macro-financial ratios [^6] |
| **ECB Statistical Data Warehouse** | European sovereign bond spreads, 2010 crisis data | Free, REST API, no key needed — directly relevant for annotating the May 2010 correlation spike |
| **BIST (Borsa İstanbul)** | Official ISE/BIST100 data | Free download, but manual — `yfinance` with `XU100.IS` is easier |
| **OpenBB** | Open-source Bloomberg terminal in Python — aggregates all the above | `pip install openbb` — a genuine Bloomberg replacement for research [^1] |

### The Recommended Setup

```python
# requirements.txt — everything you need
yfinance==0.2.51
fredapi==0.5.2
alpha_vantage==3.0.0
finnhub-python==2.4.20
openbb==4.3.0      # optional but powerful
arch==7.0.0        # for GARCH
networkx==3.3       # for MST network analysis
shap==0.46.0
statsmodels==0.14.2
```

The honest truth on "real-time": for the assignment, you don't need true real-time (sub-second). Daily-updated data from `yfinance` + FRED is entirely sufficient to show the clock running on current market conditions — and that's far more impressive in a 15-minute video than raw tick data would be.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://blog.quantinsti.com/financial-market-data-providers/

[^2]: https://arxiv.org/html/2601.06090v1

[^3]: https://blog.itick.io/en/market-data/free-stock-price-api-comparison

[^4]: https://www.alphavantage.co

[^5]: https://finnhub.io

[^6]: https://dev.to/williamsmithh/top-5-free-financial-data-apis-for-building-a-powerful-stock-portfolio-tracker-4dhj

[^7]: https://www.reddit.com/r/algotrading/comments/1nzqrl8/what_preferably_free_apis_are_preferred_for/

[^8]: https://www.youtube.com/watch?v=8EIhKMl3S8k

[^9]: https://wire.insiderfinance.io/how-to-get-stock-market-api-in-2025-best-free-paid-options-917950e8ca8f

[^10]: https://marketstack.com

[^11]: https://noteapiconnector.com/best-free-finance-apis

[^12]: https://eodhd.com/financial-academy/fundamental-analysis-examples/beyond-yahoo-finance-api-alternatives-for-financial-data

[^13]: https://blog.apilayer.com/12-best-financial-market-apis-for-real-time-data-in-2026/

[^14]: https://blog.itick.org/en/market-data/free-stock-price-api-comparison

[^15]: https://pythoninvest.com/long-read/exploring-finance-apis

[^16]: https://digitalcurrencytraders.com/top-5-stock-market-apis-2025-edition-5c87da7befd7

