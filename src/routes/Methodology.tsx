/**
 * Methodology — /methods
 */
import React, { useState } from 'react';

const SECTIONS = [
  {
    id: 'data', title: 'Dataset & Target', icon: '📊',
    content: [
      { h: 'Target Variable', p: 'ISE² (ise2) — Istanbul Stock Exchange daily returns denominated in USD. This is the assignment-specified target. ISE (TRY-denominated) is excluded as a feature to prevent data leakage.' },
      { h: 'Model A Dataset', p: 'Group_5.csv · Jan 2009 – Dec 2011 · 756 daily observations · 7 input features (SP500, DAX, FTSE, Nikkei, Bovespa, EU, EM returns).' },
      { h: 'Model B Dataset', p: 'Extended 2005–2024 · ~5,000 obs · adds USD/TRY exchange rate, CBRT policy rate, Turkey 5yr CDS spread, and derived TRY volatility. Sourced from Yahoo Finance and FRED.' },
    ]
  },
  {
    id: 'preproc', title: 'Preprocessing', icon: '⚙️',
    content: [
      { h: 'Scaling', p: 'RobustScaler (not StandardScaler). Financial returns have fat tails and outliers — RobustScaler uses IQR and is robust to extreme drawdowns like the Aug 2018 TL crash.' },
      { h: 'Missing Values', p: 'Forward-fill first (market holiday gaps are carried forward), then mean imputation for remaining NaN. No rows dropped to preserve temporal continuity.' },
      { h: 'Train/Test Split', p: 'Strictly chronological 80/20 split. No random shuffling. For Model B, 2018–2024 is held out as the crisis evaluation window. TimeSeriesSplit(n_splits=5) for CV.' },
    ]
  },
  {
    id: 'features', title: 'Feature Engineering', icon: '🔧',
    content: [
      { h: 'Lag Features', p: 'ISE² returns at t-1, t-5, t-10 added as autoregressive inputs. Strong autocorrelation in crisis periods makes these high-importance features.' },
      { h: 'Rolling Statistics', p: '5-day and 20-day rolling mean and standard deviation of ISE² returns. Captures momentum and volatility regime shifts.' },
      { h: 'Cross-Index Correlation Decay', p: 'Rolling 30-day correlation between ISE² and each global index. Correlation breakdown (especially with EM) is a leading fragility signal.' },
      { h: 'Model B Extras', p: 'USD/TRY daily return, 30-day TRY volatility, CBRT rate delta (rate change per meeting), CDS spread level. These directly encode the Turkey-specific crisis drivers.' },
    ]
  },
  {
    id: 'models', title: 'ML Models', icon: '🧠',
    content: [
      { h: 'Linear Regression', p: 'Baseline. Assumes linear relationship between global index returns and ISE². Interpretable but underfits during crisis non-linearities.' },
      { h: 'Ridge Regression', p: 'L2-regularised linear model. Handles multicollinearity between SP500/DAX/EU/FTSE (corr 0.89–0.96). Better than OLS but still linear.' },
      { h: 'Random Forest', p: '100 trees, max_depth=8. Captures non-linear regime interactions. Feature importance provides explainability. TimeSeriesSplit CV to prevent look-ahead.' },
      { h: 'XGBoost', p: 'Gradient-boosted trees. Best overall R² on both datasets. Handles heteroskedasticity and outliers well. Key hyperparams: n_estimators=200, learning_rate=0.05, subsample=0.8.' },
      { h: 'LSTM', p: '2-layer LSTM, sequence_length=20 days. Captures temporal dependencies in crisis propagation. Trained with early stopping (patience=10). Second-best on Model B.' },
    ]
  },
  {
    id: 'eval', title: 'Evaluation', icon: '📏',
    content: [
      { h: 'Metrics', p: 'R² (coefficient of determination), RMSE (root mean squared error), MAE (mean absolute error). Reported separately for Model A and Model B test sets.' },
      { h: 'Crisis Period Focus', p: 'For Model B, additional evaluation on the 2018–2024 crisis window only. A model that performs well on quiet periods but fails during crises is analytically useless for this assignment.' },
      { h: 'No Data Leakage', p: 'All feature engineering uses strictly historical data (rolling windows computed on past values only). The test split is always a future period the model never saw during training.' },
    ]
  },
];

const Methodology: React.FC = () => {
  const [open, setOpen] = useState<string>('data');
  return (
    <div style={{ padding:24, maxWidth:860, margin:'0 auto' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'var(--k-text-lg)', fontWeight:700, color:'var(--k-text)', marginBottom:4 }}>Methodology</h1>
        <p style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)' }}>Technical pipeline documentation · ISE² fragility prediction</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {SECTIONS.map(s => (
          <div key={s.id} className="k-panel" style={{ cursor:'pointer', overflow:'hidden' }}>
            <button onClick={() => setOpen(open===s.id?'':s.id)}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:12, padding:0,
                background:'none', border:'none', cursor:'pointer', textAlign:'left'
              }}>
              <span style={{ fontSize:18 }}>{s.icon}</span>
              <span style={{ flex:1, fontSize:'var(--k-text-md)', fontWeight:700, color:'var(--k-text)' }}>{s.title}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--k-text-faint)" strokeWidth="2"
                style={{ transform: open===s.id?'rotate(180deg)':'none', transition:'transform var(--k-transition)', flexShrink:0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {open === s.id && (
              <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--k-divider)', display:'flex', flexDirection:'column', gap:14 }}>
                {s.content.map(({ h, p }) => (
                  <div key={h}>
                    <div style={{ fontSize:'var(--k-text-sm)', fontWeight:700, color:'var(--k-primary-hover)', marginBottom:4 }}>{h}</div>
                    <p style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)', lineHeight:1.7, maxWidth:'none' }}>{p}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Methodology;
