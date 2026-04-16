/**
 * Dashboard (Data Room) — /dashboard
 * ISE² vs global indices · correlation heatmap · feature table
 */
import React, { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend
} from 'recharts';

const INDICES = ['ISE²', 'SP500', 'DAX', 'FTSE', 'Nikkei', 'Bovespa', 'EU', 'EM'];
const COLORS  = ['#7986CB','#4FC3F7','#FFD54F','#81C784','#FF8A65','#CE93D8','#4DD0E1','#A5D6A7'];

const SERIES_DATA = [
  { d:'Jan 09', ise:-8.2, sp:-6.1, dax:-5.8, ftse:-5.2, nikkei:-7.1, bovespa:-5.9, eu:-6.0, em:-5.4 },
  { d:'Apr 09', ise:-3.1, sp:-1.2, dax:-2.1, ftse:-1.9, nikkei:-2.8, bovespa:-1.5, eu:-1.8, em:-1.2 },
  { d:'Jul 09', ise: 4.5, sp: 3.9, dax: 4.1, ftse: 3.7, nikkei: 2.9, bovespa: 5.1, eu: 3.5, em: 4.2 },
  { d:'Oct 09', ise: 6.1, sp: 4.2, dax: 5.0, ftse: 4.5, nikkei: 3.8, bovespa: 6.3, eu: 4.8, em: 5.5 },
  { d:'Jan 10', ise: 2.8, sp: 2.1, dax: 2.5, ftse: 2.3, nikkei: 1.9, bovespa: 3.2, eu: 2.2, em: 2.9 },
  { d:'Oct 10', ise: 5.4, sp: 3.8, dax: 4.2, ftse: 3.9, nikkei: 2.7, bovespa: 5.8, eu: 4.0, em: 5.1 },
  { d:'Jan 11', ise:-1.4, sp:-0.8, dax:-0.9, ftse:-1.1, nikkei:-1.5, bovespa:-0.6, eu:-1.0, em:-0.7 },
  { d:'Oct 11', ise:-5.8, sp:-4.1, dax:-4.8, ftse:-4.5, nikkei:-5.2, bovespa:-3.9, eu:-4.6, em:-4.0 },
];

const CORR_MATRIX = [
  [1.00, 0.74, 0.68, 0.71, 0.58, 0.62, 0.70, 0.65],
  [0.74, 1.00, 0.89, 0.91, 0.77, 0.72, 0.93, 0.85],
  [0.68, 0.89, 1.00, 0.94, 0.75, 0.70, 0.96, 0.82],
  [0.71, 0.91, 0.94, 1.00, 0.73, 0.68, 0.95, 0.80],
  [0.58, 0.77, 0.75, 0.73, 1.00, 0.61, 0.74, 0.72],
  [0.62, 0.72, 0.70, 0.68, 0.61, 1.00, 0.69, 0.76],
  [0.70, 0.93, 0.96, 0.95, 0.74, 0.69, 1.00, 0.83],
  [0.65, 0.85, 0.82, 0.80, 0.72, 0.76, 0.83, 1.00],
];

function corrColor(v: number): string {
  if (v >= 0.9) return 'var(--k-primary)';
  if (v >= 0.75) return 'var(--k-primary-hover)';
  if (v >= 0.5) return 'var(--k-chart-ise)';
  return 'var(--k-text-faint)';
}

function corrBg(v: number, isTarget: boolean): string {
  if (isTarget) return 'var(--k-primary-dim)';
  if (v === 1) return 'var(--k-surface-overlay)';
  if (v >= 0.9) return 'rgba(92,107,192,0.18)';
  if (v >= 0.75) return 'rgba(92,107,192,0.10)';
  return 'transparent';
}

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'indices'|'correlation'|'features'>('indices');

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize:'var(--k-text-lg)', fontWeight:700, color:'var(--k-text)', marginBottom:4 }}>Data Room</h1>
        <p style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)' }}>ISE² vs global indices · 756 daily observations · Jan 2009–Dec 2011</p>
      </div>

      <div className="k-tabs">
        {(['indices','correlation','features'] as const).map(t => (
          <button key={t} className={`k-tab${activeTab===t?' active':''}`} onClick={() => setActiveTab(t)}>
            {{ indices:'Return Series', correlation:'Correlation Matrix', features:'Feature Summary' }[t]}
          </button>
        ))}
      </div>

      {activeTab === 'indices' && (
        <div>
          <div className="k-panel" style={{ marginBottom: 16 }}>
            <div className="k-panel-header">
              <span className="k-panel-title">All Index Returns — 2009–11</span>
              <span className="k-badge k-badge-primary">Model A dataset</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={SERIES_DATA} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                <XAxis dataKey="d" tick={{ fontSize:10, fill:'var(--k-text-faint)', fontFamily:'var(--k-font-data)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:10, fill:'var(--k-text-faint)', fontFamily:'var(--k-font-data)' }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background:'var(--k-surface-overlay)', border:'1px solid var(--k-border)', borderRadius:'var(--k-radius-md)', fontSize:12, fontFamily:'var(--k-font-data)' }}/>
                <Legend wrapperStyle={{ fontSize:11, fontFamily:'var(--k-font-ui)', paddingTop:8 }}/>
                {['ise','sp','dax','ftse','nikkei','bovespa','eu','em'].map((k,i) => (
                  <Line key={k} type="monotone" dataKey={k} name={INDICES[i]}
                    stroke={COLORS[i]} strokeWidth={k==='ise'?2.5:1.2}
                    dot={false} strokeDasharray={k==='ise'?undefined:'4 2'}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {INDICES.map((name,i) => (
              <div key={name} className="k-stat">
                <div className="k-stat-label" style={{ color: COLORS[i] }}>{name}</div>
                <div className="k-stat-value" style={{ fontSize:'var(--k-text-md)', color:'var(--k-text)' }}>
                  {['-0.38%','0.02%','0.04%','0.01%','-0.12%','0.09%','0.03%','0.05%'][i]}
                </div>
                <div className="k-stat-delta neu">mean daily return</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'correlation' && (
        <div className="k-panel">
          <div className="k-panel-header">
            <span className="k-panel-title">Pearson Correlation Matrix</span>
            <span className="k-badge k-badge-primary">2009–11 · 756 obs</span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ padding:'8px 12px', fontSize:'var(--k-text-xs)', color:'var(--k-text-faint)', fontFamily:'var(--k-font-ui)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', textAlign:'left' }}> </th>
                  {INDICES.map((n,i) => (
                    <th key={n} style={{ padding:'8px 12px', fontSize:'var(--k-text-xs)', color: i===0?'var(--k-primary-hover)':'var(--k-text-faint)', fontFamily:'var(--k-font-ui)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', textAlign:'center' }}>{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INDICES.map((row,i) => (
                  <tr key={row}>
                    <td style={{ padding:'6px 12px', fontSize:'var(--k-text-xs)', fontWeight:600, color: i===0?'var(--k-primary-hover)':'var(--k-text-muted)', fontFamily:'var(--k-font-ui)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{row}</td>
                    {CORR_MATRIX[i].map((v,j) => (
                      <td key={j} style={{
                        padding:'6px 12px', textAlign:'center',
                        background: corrBg(v, i===0 || j===0),
                        color: corrColor(v),
                        fontFamily:'var(--k-font-data)', fontSize:'var(--k-text-sm)',
                        fontWeight: (i===0||j===0) ? 700 : 400,
                        borderRadius: 4,
                      }}>{v.toFixed(2)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:12, fontSize:'var(--k-text-xs)', color:'var(--k-text-faint)' }}>
            ISE² row/col highlighted. Highest correlation with SP500 (0.74) and EU (0.70).
          </div>
        </div>
      )}

      {activeTab === 'features' && (
        <div className="k-panel">
          <div className="k-panel-header">
            <span className="k-panel-title">Feature Engineering Summary</span>
          </div>
          <table className="k-table">
            <thead><tr>
              <th>Feature</th><th>Type</th><th>Source</th><th>Used In</th><th>Importance</th>
            </tr></thead>
            <tbody>
              {[
                ['sp','Raw return','S&P 500','A + B','High'],
                ['dax','Raw return','DAX 40','A + B','High'],
                ['ftse','Raw return','FTSE 100','A + B','Medium'],
                ['nikkei','Raw return','Nikkei 225','A + B','Medium'],
                ['bovespa','Raw return','Bovespa','A + B','Low'],
                ['eu','Raw return','Euro Stoxx','A + B','High'],
                ['em','Raw return','MSCI EM','A + B','Medium'],
                ['ise_lag1','Lagged t-1','ISE²','A + B','High'],
                ['ise_roll5','5-day MA','ISE²','A + B','High'],
                ['ise_roll20','20-day MA','ISE²','A + B','Medium'],
                ['ise_vol','Rolling σ','ISE²','A + B','High'],
                ['usd_try','FX rate','Yahoo Finance','B only','Very High'],
                ['cbrt_rate','Policy rate','CBRT / FRED','B only','Very High'],
                ['cds_spread','CDS 5yr','Bloomberg','B only','High'],
                ['try_vol','TRY volatility','Derived','B only','High'],
              ].map(([feat,type,src,model,imp]) => (
                <tr key={feat}>
                  <td style={{ fontFamily:'var(--k-font-data)', color:'var(--k-primary-hover)' }}>{feat}</td>
                  <td>{type}</td>
                  <td style={{ color:'var(--k-text-muted)' }}>{src}</td>
                  <td><span className={`k-badge ${model.includes('B')&&!model.includes('A')?'k-badge-warning':'k-badge-primary'}`}>{model}</span></td>
                  <td style={{ color: imp==='Very High'?'var(--k-crisis)':imp==='High'?'var(--k-primary-hover)':imp==='Medium'?'var(--k-warning)':'var(--k-text-faint)', fontWeight:600, fontSize:'var(--k-text-sm)' }}>{imp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
