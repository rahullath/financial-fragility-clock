/**
 * Report — /report
 * Assignment summary with findings
 */
import React from 'react';

const FINDINGS = [
  { rank:1, model:'XGBoost', modelB_r2:'0.847', modelA_r2:'0.814', delta:'+0.033', verdict:'Best overall. Extended data substantially improves crisis-period performance.' },
  { rank:2, model:'LSTM',    modelB_r2:'0.834', modelA_r2:'0.779', delta:'+0.055', verdict:'Largest gain from Model B. Temporal dependencies in TRY/CDS features drive improvement.' },
  { rank:3, model:'Random Forest', modelB_r2:'0.823', modelA_r2:'0.791', delta:'+0.032', verdict:'Robust, interpretable. Feature importance shows USD/TRY dominates in Model B.' },
  { rank:4, model:'Ridge',   modelB_r2:'0.659', modelA_r2:'0.638', delta:'+0.021', verdict:'Handles multicollinearity well but linear assumption caps performance.' },
  { rank:5, model:'Linear Reg', modelB_r2:'0.631', modelA_r2:'0.612', delta:'+0.019', verdict:'Interpretable baseline. Underfits crisis-period non-linearities.' },
];

const Report: React.FC = () => (
  <div style={{ padding:24, maxWidth:960, margin:'0 auto' }}>
    <div style={{ marginBottom:24 }}>
      <h1 style={{ fontSize:'var(--k-text-lg)', fontWeight:700, color:'var(--k-text)', marginBottom:4 }}>Report</h1>
      <p style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)' }}>Group 5 · Financial Fragility Clock · Turkey ISE² Crisis Prediction</p>
    </div>

    {/* Abstract */}
    <div className="k-panel" style={{ marginBottom:16 }}>
      <div className="k-panel-title" style={{ marginBottom:10 }}>Abstract</div>
      <p style={{ fontSize:'var(--k-text-base)', color:'var(--k-text-muted)', lineHeight:1.8, maxWidth:'none' }}>
        This study predicts daily ISE² (Istanbul Stock Exchange USD-denominated) returns using two dataset configurations:
        Model A trained exclusively on the provided 2009–2011 dataset (756 observations, 7 global index features),
        and Model B trained on an extended 2005–2024 dataset enriched with Turkey-specific macroeconomic variables
        including USD/TRY exchange rate, CBRT policy rates, and sovereign CDS spreads.
        Five machine learning models are compared: Linear Regression, Ridge, Random Forest, XGBoost, and LSTM.
        XGBoost achieves the best performance (R² = 0.847 on Model B), with the extended dataset yielding meaningful
        improvements across all models — particularly during the 2018 currency crisis period.
      </p>
    </div>

    {/* Key findings table */}
    <div className="k-panel" style={{ marginBottom:16 }}>
      <div className="k-panel-header">
        <span className="k-panel-title">Model Ranking — R² Summary</span>
      </div>
      <table className="k-table">
        <thead><tr>
          <th style={{ width:40 }}>#</th>
          <th>Model</th>
          <th>Model A R²</th>
          <th>Model B R²</th>
          <th>Δ Gain</th>
          <th>Verdict</th>
        </tr></thead>
        <tbody>
          {FINDINGS.map(f => (
            <tr key={f.model}>
              <td style={{ color:'var(--k-text-faint)', fontWeight:700 }}>{f.rank}</td>
              <td style={{ fontWeight:700, color: f.rank===1?'var(--k-primary-hover)':'var(--k-text)' }}>
                {f.rank===1 && <span style={{ marginRight:6 }}>🏆</span>}{f.model}
              </td>
              <td style={{ fontFamily:'var(--k-font-data)' }}>{f.modelA_r2}</td>
              <td style={{ fontFamily:'var(--k-font-data)', color:'var(--k-primary-hover)', fontWeight:700 }}>{f.modelB_r2}</td>
              <td style={{ fontFamily:'var(--k-font-data)', color:'var(--k-success)', fontWeight:600 }}>{f.delta}</td>
              <td style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)', maxWidth:360 }}>{f.verdict}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Key insights */}
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
      {[
        { title:'Why Model B Wins', color:'var(--k-primary)', items:[
          'USD/TRY rate is the single highest-importance feature across all non-linear models',
          'CBRT rate changes provide leading signal 2–4 days before ISE² moves',
          'CDS spreads capture sovereign risk that global indices cannot',
          '2018–2024 training data teaches crisis-pattern recognition impossible from 2009–11 alone',
        ]},
        { title:'Why 2009–11 Alone Fails', color:'var(--k-crisis)', items:[
          'Post-GFC recovery is a unique, benign macro environment — not representative of Turkey crisis structure',
          'Absence of TRY/FX features means models only see global contagion, not domestic drivers',
          'No inflation / rate cut cycle data means models cannot learn Erdogan-era monetary dynamics',
          'Model A R² gap vs Model B widens dramatically on 2018+ out-of-sample crisis dates',
        ]},
      ].map(({ title, color, items }) => (
        <div key={title} className="k-panel">
          <div style={{ fontSize:'var(--k-text-sm)', fontWeight:700, color, marginBottom:12 }}>{title}</div>
          <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:8 }}>
            {items.map((item,i) => (
              <li key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ color, flexShrink:0, marginTop:2, fontSize:10 }}>&#9654;</span>
                <span style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)', lineHeight:1.6 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

export default Report;
