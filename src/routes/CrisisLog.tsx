/**
 * CrisisLog — /history
 * Turkey economic crisis timeline with regime annotations
 */
import React, { useState } from 'react';

const EVENTS = [
  { year:'2009', q:'Q1', regime:'crisis',  title:'GFC Trough',                short:'ISE² −18.4% peak drawdown. Global contagion hits Istanbul.' },
  { year:'2009', q:'Q3', regime:'stable',  title:'Quantitative Recovery',      short:'Fed/ECB liquidity fuels EM rally. ISE² rebounds +42% from trough.' },
  { year:'2010', q:'Q2', regime:'stable',  title:'Turkish Growth Peak',         short:'GDP +9.2%. ISE² outperforms all major indices.' },
  { year:'2011', q:'Q1', regime:'stress',  title:'Arab Spring Spillover',       short:'Regional uncertainty. ISE² correlation with EM spikes.' },
  { year:'2011', q:'Q3', regime:'crisis',  title:'Eurozone Debt Crisis',        short:'ISE² −6.8% in Sept. Capital outflows accelerate.' },
  { year:'2018', q:'Q2', regime:'crisis',  title:'TL Currency Crisis Begins',   short:'USD/TRY crosses 5.0. Erdogan fires central bank governor.' },
  { year:'2018', q:'Q3', regime:'crisis',  title:'TL Flash Crash',              short:'USD/TRY peaks at 7.24. ISE² −14.1% in a single month. CBRT raises by 625bps in emergency.' },
  { year:'2019', q:'Q1', regime:'stress',  title:'Partial Stabilisation',       short:'Rates held high. ISE² recovers modestly. Fragility persists.' },
  { year:'2021', q:'Q4', regime:'crisis',  title:'Unorthodox Rate Cuts',        short:'Inflation at 80%+. CBRT cuts rates. Lira collapses 44% in 3 months.' },
  { year:'2022', q:'Q1', regime:'crisis',  title:'Inflation Spiral',            short:'CPI peaks 85.5%. ISE² in real terms deeply negative despite nominal gains.' },
  { year:'2023', q:'Q1', regime:'crisis',  title:'Kahramanmaraş Earthquake',    short:'M7.8 kills 50k+. $34B economic damage. Macro shock to ISE².' },
  { year:'2023', q:'Q3', regime:'stress',  title:'Simsek Orthodox Pivot',       short:'New finance minister, rate hikes to 40%. Fragility score begins declining.' },
  { year:'2024', q:'Q1', regime:'crisis',  title:'Ongoing Fragility',           short:'Structural lira weakness persists despite policy normalisation.' },
];

const REGIME_COLOR: Record<string,string> = {
  stable: 'var(--k-success)', stress: 'var(--k-warning)', crisis: 'var(--k-crisis)'
};
const REGIME_BG: Record<string,string> = {
  stable: 'var(--k-regime-stable)', stress: 'var(--k-regime-stress)', crisis: 'var(--k-regime-crisis)'
};

const CrisisLog: React.FC = () => {
  const [filter, setFilter] = useState<'all'|'crisis'|'stress'|'stable'>('all');
  const filtered = filter === 'all' ? EVENTS : EVENTS.filter(e => e.regime === filter);

  return (
    <div style={{ padding:24, maxWidth:1000, margin:'0 auto' }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:'var(--k-text-lg)', fontWeight:700, color:'var(--k-text)', marginBottom:4 }}>Crisis Log</h1>
        <p style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)' }}>Turkey economic fragility timeline · 2009–2024 · annotated regimes</p>
      </div>

      {/* Filter pills */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {(['all','crisis','stress','stable'] as const).map(r => (
          <button key={r} onClick={() => setFilter(r)}
            style={{
              padding:'5px 14px', borderRadius:'var(--k-radius-full)', border:'1px solid',
              borderColor: filter===r ? REGIME_COLOR[r==='all'?'stable':r] : 'var(--k-border)',
              background: filter===r ? (r==='all'?'var(--k-primary-dim)':REGIME_BG[r]) : 'transparent',
              color: filter===r ? (r==='all'?'var(--k-primary-hover)':REGIME_COLOR[r]) : 'var(--k-text-muted)',
              fontSize:'var(--k-text-sm)', fontWeight:600, cursor:'pointer',
              textTransform:'capitalize', transition:'all var(--k-transition)'
            }}>
            {r === 'all' ? `All (${EVENTS.length})` : `${r} (${EVENTS.filter(e=>e.regime===r).length})`}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', left:16, top:0, bottom:0, width:1, background:'var(--k-border)' }}/>
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {filtered.map((e, i) => (
            <div key={i} style={{ display:'flex', gap:0, paddingLeft:0, marginBottom:4 }}>
              {/* Timeline dot */}
              <div style={{ width:33, flexShrink:0, display:'flex', alignItems:'flex-start', paddingTop:18, justifyContent:'center' }}>
                <div style={{
                  width:11, height:11, borderRadius:'50%',
                  background: REGIME_COLOR[e.regime],
                  boxShadow: `0 0 8px ${REGIME_COLOR[e.regime]}`,
                  zIndex:1, flexShrink:0
                }}/>
              </div>
              {/* Card */}
              <div style={{
                flex:1,
                background: REGIME_BG[e.regime],
                border: `1px solid ${REGIME_COLOR[e.regime]}30`,
                borderRadius:'var(--k-radius-md)',
                padding:'12px 16px',
                marginBottom:8
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{
                    fontFamily:'var(--k-font-data)', fontSize:'var(--k-text-xs)',
                    color: REGIME_COLOR[e.regime], fontWeight:700,
                    background: `${REGIME_COLOR[e.regime]}20`,
                    padding:'2px 7px', borderRadius:'var(--k-radius-full)'
                  }}>{e.year} {e.q}</span>
                  <span style={{ fontSize:'var(--k-text-sm)', fontWeight:700, color:'var(--k-text)' }}>{e.title}</span>
                  <span className={`k-badge k-badge-${e.regime}`} style={{ marginLeft:'auto' }}>{e.regime.toUpperCase()}</span>
                </div>
                <p style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)', lineHeight:1.5, maxWidth:'none' }}>{e.short}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CrisisLog;
