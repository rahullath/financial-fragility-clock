# Financial Fragility Clock — Design & Build Spec
### Group 5 · Big Data Management · MSc FinTech · Birmingham

---

## 1. What We're Actually Building

Three linked outputs sharing a single codebase:

| Output | Format | Audience | Purpose |
|--------|--------|----------|---------|
| **The Dashboard** | React app (Vite) | Group + Dr. Mandal | Interactive exploration of the full model output |
| **Presentation Mode** | Same app, `/present` route | Live presentation / video recording | Curated 5-panel walkthrough, no clutter |
| **Report Figures** | PNG exports from the same charts | Written report submission | Reproducible, consistent visualisations |

One repo. One dataset. No duplicated effort.

---

## 2. Data Flow

```
Group_5.csv
    ↓
preprocessing.py        → cleaned_data.json
    ↓
feature_engineering.py  → features.json  (rolling corr, PE, regime labels)
    ↓
models.py               → model_outputs.json  (OLS, RF, SHAP values)
    ↓
React Dashboard         ← reads all JSON files as static imports
```

All Python output is serialised to JSON at build time. The dashboard is fully static — no backend, no runtime Python. Deployable to Vercel/Netlify in one command.

---

## 3. The Clock — Core Visual

The centrepiece. A circular gauge that reads the current Fragility Score (0–100).

### Anatomy

```
         HEDGE
          ↑
  ←  [  CLOCK  ]  →
          ↓
         PONZI
```

- **Outer ring**: Segmented arc — three zones
  - `0–33`: HEDGE (calm green)
  - `34–66`: SPECULATIVE (amber)
  - `67–100`: PONZI (deep red)
- **Needle**: Animated SVG pointer. Moves smoothly on date change.
- **Centre**: Current date + raw fragility score (e.g. `47.3`)
- **Inner ring**: 7-day trailing volatility bar (thin, secondary)
- **Beneath clock**: Three pill badges — current regime label, 30-day trend arrow (↑↓→), and the dominant global contagion source (e.g. `SP500 driving`)

### Fragility Score Formula

```
FragilityScore = 0.40 × RollingCorrelation_60d
               + 0.30 × PermutationEntropy_inverted
               + 0.20 × RollingVolatility_30d_normalised
               + 0.10 × RF_PredictionError_rolling
```

All components normalised 0–1 before weighting. Score × 100 = display value.

### Clock Behaviour

- **Scrubbing**: User drags a timeline slider beneath the clock → needle animates to that date's score in real time
- **Regime transition flash**: When score crosses a threshold (33 or 67), the outer ring pulses once
- **Key event pins**: May 6 2010 (Flash Crash), Apr 2010 (Greece) show as small markers on the outer ring — hover reveals annotation

---

## 4. Dashboard Layout

### Route Structure

```
/          → Dashboard (full exploration mode)
/present   → Presentation mode (5 panels, keyboard nav)
/methods   → Methodology explainer (for report context)
```

### Dashboard — Desktop Layout

```
┌─────────────────────────────────────────────────────┐
│  HEADER: "Financial Fragility Clock"   [Mode toggle] │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│   THE CLOCK  │   REGIME TIMELINE                    │
│   (centre)   │   Stacked area chart, full period    │
│              │   Colour-coded by regime              │
│              │                                      │
├──────────────┴──────────────────────────────────────┤
│  DATE SCRUBBER ←————————————————————————————→       │
├─────────────────────────────────────────────────────┤
│  PANEL ROW (3 cards, equal width):                  │
│  [Correlation Heatmap] [SHAP Chart] [Network MST]   │
├─────────────────────────────────────────────────────┤
│  PANEL ROW (2 cards):                               │
│  [OLS vs RF Performance Table] [Regime Stats Table] │
└─────────────────────────────────────────────────────┘
```

### Dashboard — Mobile Layout

Single column stack, same components in this order:
1. Header + mode toggle
2. The Clock (full width, compact)
3. Date scrubber
4. Regime Timeline (scrollable)
5. Tabs: `Correlation | SHAP | Network | Models`
   - Each tab = one panel card

Mobile breakpoint: `< 768px`. Use CSS Grid with named areas — desktop and mobile share the same component tree, layout shifts via media query only.

---

## 5. Panel Components

### 5.1 Regime Timeline
- **Type**: Recharts `AreaChart` with custom fills per regime
- **X-axis**: Date (Jan 2009 – Feb 2011)
- **Y-axis**: Fragility Score (0–100)
- **Fills**: HEDGE=`#2d6a4f`, SPECULATIVE=`#e9c46a`, PONZI=`#e63946`
- **Overlay**: Event annotations as vertical dashed lines with labels
- **Interaction**: Click on chart → scrubber jumps to that date, clock needle updates

### 5.2 Rolling Correlation Heatmap
- **Type**: Custom SVG grid (not a chart library — full control)
- **Rows/Cols**: SP, DAX, FTSE, NIKKEI, BOVESPA, EU, EM vs ISE_USD
- **Values**: 60-day rolling Pearson correlation at selected date
- **Colour scale**: Diverging — `#2166ac` (−1) → white (0) → `#d6604d` (+1)
- **Interaction**: Hover cell → shows exact correlation value + 30-day delta

### 5.3 SHAP Feature Importance
- **Type**: Horizontal bar chart (Recharts `BarChart`)
- **Data**: Mean absolute SHAP values per feature, computed on test set
- **Bars**: Colour-coded by positive/negative mean SHAP direction
- **Caption**: Auto-generated from data — e.g. "SP500 contributes 34% of model's predictive weight"
- **Regime toggle**: Switch between SHAP values for HEDGE / SPECULATIVE / PONZI regimes separately — this is the distinction-level output

### 5.4 Network MST (Minimum Spanning Tree)
- **Type**: D3 force-directed graph
- **Nodes**: Each market index
- **Edges**: Mantegna distance from correlation matrix at selected date
- **Node size**: Proportional to betweenness centrality
- **Node colour**: Regime-aware (which markets are "hot" at that date)
- **Animation**: On date scrub, edge weights update with transition

### 5.5 Model Performance Table
- **Type**: Static table (styled)
- **Rows**: OLS, Random Forest, (VAR if included)
- **Columns**: R², RMSE, MAE, RMSE by regime (HEDGE/SPEC/PONZI)
- **Highlight**: Best value per column in teal
- **Key callout**: RF outperforms OLS in PONZI regime → validates Minsky framing

### 5.6 Regime Stats Card
- **Type**: 3-column stat grid
- **Per regime**: Count of days, mean ISE return, volatility, mean fragility score
- **Visual**: Small sparklines per regime showing distribution shape

---

## 6. Presentation Mode (`/present`)

Keyboard-navigable. 5 panels. No sidebar, no scrubber, no clutter.

```
Panel 1: "The Problem"
  → Full-screen Clock at a PONZI date (May 2010)
  → Single caption: "This is what a Minsky moment looks like in data"

Panel 2: "The Data"
  → Regime Timeline, annotated
  → Brief methodology caption

Panel 3: "What Drives ISE?"
  → SHAP chart, PONZI regime selected
  → Caption: key finding from feature importance

Panel 4: "The Network Effect"
  → MST at Jan 2009 vs May 2010 side by side
  → Caption: contagion topology change

Panel 5: "What It Means"
  → Model performance table
  → Business interpretation paragraph
  → Fragility Score today (if live data enabled)
```

Navigation: `←` `→` arrow keys or on-screen buttons. Press `F` for fullscreen. Each panel has a slide number indicator bottom-right.

---

## 7. Visual Design

### Aesthetic Direction
**Editorial financial instrument** — the feeling of a Bloomberg terminal rebuilt with restraint and intent. Not a startup dashboard. Not academic software. Somewhere between a serious broadsheet data graphic and a precision scientific instrument.

### Colour Palette
```css
--bg:           #faf8f4;   /* warm off-white */
--bg-card:      #ffffff;
--bg-dark:      #1a1a2e;   /* presentation mode background */
--accent:       #1b4f72;   /* deep teal */
--accent-light: #2e86ab;
--hedge:        #2d6a4f;   /* regime green */
--speculative:  #e9a800;   /* regime amber */
--ponzi:        #c1121f;   /* regime red */
--text-primary: #1a1a1a;
--text-muted:   #6b7280;
--border:       #e5e0d8;
```

### Typography
```css
--font-display: 'Playfair Display', Georgia, serif;   /* headings, clock label */
--font-body:    'Source Serif 4', Georgia, serif;     /* body text, captions */
--font-mono:    'JetBrains Mono', monospace;          /* data values, scores */
```

Load via Google Fonts. No system font fallbacks as primary choice.

### Component Style Rules
- Cards: `border: 1px solid var(--border)`, `border-radius: 4px`, subtle `box-shadow`
- No rounded pill buttons — square with 2px radius max
- Data values always in `--font-mono`
- Regime colours used **only** for data — never for UI chrome
- Dark mode = presentation mode only (`/present` route forces dark)

### Motion
- Clock needle: `transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)` (slight overshoot)
- Regime transition pulse: keyframe animation, 1 cycle only, never loops
- Chart updates on date scrub: 300ms ease
- Panel transitions in presentation mode: horizontal slide, 400ms

---

## 8. Tech Stack

```
Frontend:   React 18 + Vite
Charts:     Recharts (timeline, SHAP, performance)
Network:    D3 v7 (MST only — don't use D3 for anything Recharts can do)
Styling:    CSS Modules (no Tailwind — too constrained for this aesthetic)
Routing:    React Router v6
Data:       Static JSON imports (no runtime fetch)
Deploy:     Vercel
```

### Why not Tailwind
The clock and MST require custom SVG and D3 — Tailwind's utility classes don't help there. CSS Modules give full control over the editorial typography and spacing without fighting a framework.

### File Structure
```
src/
  components/
    Clock/
      Clock.jsx
      Clock.module.css
      Needle.jsx
    Timeline/
    Heatmap/
    SHAP/
    NetworkMST/
    ModelTable/
    RegimeStats/
  pages/
    Dashboard.jsx
    Present.jsx
    Methods.jsx
  data/
    cleaned_data.json
    features.json
    model_outputs.json
  utils/
    fragility.js      ← fragility score formula
    regimes.js        ← regime labelling logic
    dates.js
  App.jsx
  main.jsx

python/
  preprocessing.py
  feature_engineering.py
  models.py
  export_json.py      ← single script to regenerate all JSON
```

---

## 9. Python Pipeline — Scope

What each script produces (not how — that's for implementation):

| Script | Key Outputs |
|--------|-------------|
| `preprocessing.py` | Cleaned df: zeros → NaN → forward-fill, date index, ise_usd as target |
| `feature_engineering.py` | 60d rolling correlation matrix per date, 30d rolling vol, permutation entropy, Minsky regime labels |
| `models.py` | OLS coefficients + residuals, RF trained on 80/20 time split, SHAP values per test observation, regime-stratified performance metrics |
| `export_json.py` | All of the above → `src/data/*.json` |

ADF stationarity test and Granger causality results go into `model_outputs.json` as a `diagnostics` key — they appear in the Methods page and as footnotes in the report, not as primary visualisations.

---

## 10. Assignment Deliverable Mapping

| Assignment Criterion | Dashboard Component | Report Section |
|---------------------|--------------------|--------------------|
| Data quality check | EDA stats in Methods page | Section 1 |
| Model development | Model Table + SHAP | Section 2 |
| Data interpretation | Clock + Timeline + business captions | Section 3 |
| Presentation (Assignment 2) | `/present` route recorded as video | — |

---

## 11. Phased Build Order

**Phase 1 — Data (Python)**
Run preprocessing → feature engineering → models → export JSON. Verify outputs look right in raw JSON before touching React.

**Phase 2 — Shell**
Vite scaffold, routing, CSS variables, font imports, card layout. No real data yet — mock with hardcoded values.

**Phase 3 — Clock**
Build the SVG clock as a standalone component. Get the needle animation right. Test with mock fragility scores 0–100.

**Phase 4 — Timeline + Scrubber**
Wire the date scrubber to the clock. This is the core interaction — everything else is decorative until this works.

**Phase 5 — Panels**
Add Heatmap, SHAP, MST, Model Table, Regime Stats in order of complexity (table first, MST last).

**Phase 6 — Presentation Mode**
`/present` route, keyboard nav, dark theme.

**Phase 7 — Polish + Export**
Report-quality PNG export from charts, mobile layout fixes, Vercel deploy.

---

## 12. Out of Scope

- User authentication
- Real-time data fetching (live mode is a stretch goal only — keep behind a feature flag)
- LSTM model (not enough observations to justify; GARCH similarly deprioritised — can be added in Phase 7 if time allows)
- Multi-dataset support
- Any backend / API server
