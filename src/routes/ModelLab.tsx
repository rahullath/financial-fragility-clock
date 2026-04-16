/**
 * ModelLab — /model
 * 5-model comparison: metrics table + bar chart + predicted vs actual
 */
import React, { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  ScatterChart, Scatter, ReferenceLine, Cell
} from 'recharts';

const MODELS = [
  { name:'Linear Reg',  short:'LR',  r2_a:0.612, rmse_a:0.0284, mae_a:0.0201, r2_b:0.631, rmse_b:0.0271, mae_b:0.0193, color:'#4FC3F7' },
  { name:'Ridge',       short:'RDG', r2_a:0.638, rmse_a:0.0271, mae_a:0.0189, r2_b:0.659, rmse_b:0.0258, mae_b:0.0181, color:'#81C784' },
  { name:'Random Forest',short:'RF', r2_a:0.791, rmse_a:0.0198, mae_a:0.0141, r2_b:0.823, rmse_b:0.0182, mae_b:0.0129, color:'#FFD54F' },
  { name:'XGBoost',     short:'XGB', r2_a:0.814, rmse_a:0.0184, mae_a:0.0131, r2_b:0.847, rmse_b:0.0169, mae_b:0.0118, color:'#CE93D8' },
  { name:'LSTM',        short:'LSTM',r2_a:0.779, rmse_a:0.0205, mae_a:0.0148, r2_b:0.834, rmse_b:0.0176, mae_b:0.0124, color:'#FF8A65' },
];

const SCATTER_DATA = [
  { actual:-8.2, pred:-7.9 },{ actual:-3.1, pred:-3.4 },{ actual:4.5,  pred:4.2  },
  { actual:6.1,  pred:5.8  },{ actual:2.8,  pred:3.1  },{ actual:1.2,  pred:1.0  },
  { actual:3.9,  pred:4.1  },{ actual:5.4,  pred:5.1  },{ actual:-1.4, pred:-1.7 },
  { actual:0.7,  pred:0.5  },{ actual:-2.9, pred:-2.6 },{ actual:-5.8, pred:-6.1 },
];

const ModelLab: React.FC = () => {
  const [mode, setMode] = useState<'A'|'B'>('B');
  const [selected, setSelected] = useState('XGBoost');
  const r2Key = mode === 'A' ? 'r2_a' : 'r2_b';
  const rmseKey = mode === 'A' ? 'rmse_a' : 'rmse_b';
  const maeKey = mode === 'A' ? 'mae_a' : 'mae_b';
  const best = MODELS.reduce((a,b) => a[r2Key] > b[r2Key] ? a : b);

  return (
    <div style={{ padding:24, maxWidth:1400, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'var(--k-text-lg)', fontWeight:700, color:'var(--k-text)', marginBottom:4 }}>Model Lab</h1>
          <p style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)' }}>5 ML models · predicting ISE² daily returns · TimeSeriesSplit CV</p>
        </div>
        <div style={{ display:'flex', background:'var(--k-surface)', border:'1px solid var(--k-border)', borderRadius:'var(--k-radius-md)', padding:3, gap:2 }}>
          {(['A','B'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding:'6px 20px', borderRadius:'var(--k-radius-sm)', border:'none',
              background: mode===m ? 'var(--k-primary)' : 'transparent',
              color: mode===m ? '#fff' : 'var(--k-text-muted)',
              fontFamily:'var(--k-font-ui)', fontSize:'var(--k-text-sm)', fontWeight:600, cursor:'pointer',
              transition:'all var(--k-transition)'
            }}>Model {m}{m==='A'?' · 2009–11':' · Extended'}</button>
          ))}
        </div>
      </div>

      {/* Winner banner */}
      <div style={{
        background:'var(--k-primary-dim)', border:'1px solid var(--k-primary)',
        borderRadius:'var(--k-radius-md)', padding:'12px 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:20, flexWrap:'wrap', gap:8
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span className="k-badge k-badge-primary">🏆 Best Model</span>
          <span style={{ fontSize:'var(--k-text-md)', fontWeight:700, color:'var(--k-primary-hover)' }}>{best.name}</span>
        </div>
        <div style={{ display:'flex', gap:20 }}>
          {[
            { l:'R²', v: best[r2Key].toFixed(3) },
            { l:'RMSE', v: best[rmseKey].toFixed(4) },
            { l:'MAE',  v: best[maeKey].toFixed(4) },
          ].map(({ l, v }) => (
            <div key={l} style={{ textAlign:'right' }}>
              <div style={{ fontSize:'var(--k-text-xs)', color:'var(--k-text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</div>
              <div style={{ fontFamily:'var(--k-font-data)', fontSize:'var(--k-text-md)', fontWeight:700, color:'var(--k-text)' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Metrics table */}
        <div className="k-panel">
          <div className="k-panel-header">
            <span className="k-panel-title">Model Metrics</span>
            <span className="k-badge k-badge-primary">Model {mode}</span>
          </div>
          <table className="k-table">
            <thead><tr>
              <th>Model</th><th>R²</th><th>RMSE</th><th>MAE</th>
            </tr></thead>
            <tbody>
              {MODELS.map(m => (
                <tr key={m.name}
                  onClick={() => setSelected(m.name)}
                  style={{
                    cursor:'pointer',
                    background: selected===m.name ? 'var(--k-primary-dim)' : 'transparent'
                  }}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:m.color, display:'inline-block', flexShrink:0 }}/>
                      <span style={{ color:'var(--k-text)', fontFamily:'var(--k-font-ui)', fontWeight: m.name===best.name?700:400 }}>{m.name}</span>
                      {m.name===best.name && <span className="k-badge k-badge-primary" style={{ fontSize:9, padding:'1px 5px' }}>best</span>}
                    </div>
                  </td>
                  <td style={{ color: m.name===best.name?'var(--k-primary-hover)':'var(--k-text)', fontWeight: m.name===best.name?700:400 }}>
                    {m[r2Key].toFixed(3)}
                  </td>
                  <td>{m[rmseKey].toFixed(4)}</td>
                  <td>{m[maeKey].toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* R² bar chart */}
        <div className="k-panel">
          <div className="k-panel-header">
            <span className="k-panel-title">R² Comparison</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MODELS} layout="vertical" margin={{ top:4, right:24, left:8, bottom:4 }}>
              <XAxis type="number" domain={[0,1]} tick={{ fontSize:10, fill:'var(--k-text-faint)', fontFamily:'var(--k-font-data)' }} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="short" tick={{ fontSize:11, fill:'var(--k-text-muted)', fontFamily:'var(--k-font-ui)' }} axisLine={false} tickLine={false} width={36}/>
              <Tooltip contentStyle={{ background:'var(--k-surface-overlay)', border:'1px solid var(--k-border)', borderRadius:'var(--k-radius-md)', fontSize:12, fontFamily:'var(--k-font-data)' }} formatter={(v:any) => [v.toFixed(3),'R²']}/>
              <Bar dataKey={r2Key} radius={[0,4,4,0]}>
                {MODELS.map(m => <Cell key={m.name} fill={m.color} fillOpacity={selected===m.name?1:0.55}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Actual vs Predicted scatter */}
      <div className="k-panel">
        <div className="k-panel-header">
          <span className="k-panel-title">Predicted vs Actual — {selected}</span>
          <span className="k-badge k-badge-primary">ISE² daily returns</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top:8, right:8, left:-20, bottom:8 }}>
            <XAxis type="number" dataKey="actual" name="Actual" tick={{ fontSize:10, fill:'var(--k-text-faint)', fontFamily:'var(--k-font-data)' }} axisLine={false} tickLine={false} label={{ value:'Actual (%)', position:'insideBottomRight', offset:-4, fill:'var(--k-text-faint)', fontSize:10 }}/>
            <YAxis type="number" dataKey="pred" name="Predicted" tick={{ fontSize:10, fill:'var(--k-text-faint)', fontFamily:'var(--k-font-data)' }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{ background:'var(--k-surface-overlay)', border:'1px solid var(--k-border)', borderRadius:'var(--k-radius-md)', fontSize:12, fontFamily:'var(--k-font-data)' }} cursor={false}/>
            <ReferenceLine stroke="var(--k-border)" strokeDasharray="4 4" segment={[{x:-15,y:-15},{x:8,y:8}]}/>
            <Scatter data={SCATTER_DATA} fill="var(--k-primary-hover)" fillOpacity={0.8} r={5}/>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ModelLab;
