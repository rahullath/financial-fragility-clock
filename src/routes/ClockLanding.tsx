/**
 * ClockLanding — / 
 * Hero: fragility score + SVG clock + regime timeline
 * Below: 4 KPI stats + crisis events strip
 */
import React, { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, ReferenceLine
} from 'recharts';

// ── Mock data (replace with context/JSON) ────────────────────────
const ISE_SERIES = [
  { d: 'Jan 09', v: -8.2, r: 'crisis' }, { d: 'Apr 09', v: -3.1, r: 'stress' },
  { d: 'Jul 09', v:  4.5, r: 'stable' }, { d: 'Oct 09', v:  6.1, r: 'stable' },
  { d: 'Jan 10', v:  2.8, r: 'stable' }, { d: 'Apr 10', v:  1.2, r: 'stable' },
  { d: 'Jul 10', v:  3.9, r: 'stable' }, { d: 'Oct 10', v:  5.4, r: 'stable' },
  { d: 'Jan 11', v: -1.4, r: 'stress' }, { d: 'Apr 11', v:  0.7, r: 'stable' },
  { d: 'Jul 11', v: -2.9, r: 'stress' }, { d: 'Oct 11', v: -5.8, r: 'crisis' },
  { d: 'Jan 18', v: -6.2, r: 'crisis' }, { d: 'Apr 18', v: -9.4, r: 'crisis' },
  { d: 'Aug 18', v:-14.1, r: 'crisis' }, { d: 'Jan 19', v: -3.2, r: 'stress' },
  { d: 'Jul 21', v: -7.8, r: 'crisis' }, { d: 'Jan 22', v:-11.2, r: 'crisis' },
  { d: 'Jan 23', v: -4.3, r: 'stress' }, { d: 'Jul 23', v: -6.1, r: 'crisis' },
  { d: 'Jan 24', v: -5.4, r: 'crisis' },
];

const CRISES = [
  { label: 'GFC Recovery',  date: '2009–11', type: 'stress',  desc: 'Post-GFC stabilisation period' },
  { label: 'TL Collapse',   date: 'Aug 2018', type: 'crisis',  desc: 'USD/TRY hit 7.2, -40% in weeks' },
  { label: 'Rate Cuts',     date: '2021–22', type: 'crisis',  desc: 'CBRT cut rates despite 80%+ inflation' },
  { label: 'Earthquake',    date: 'Feb 2023', type: 'crisis',  desc: 'Kahramanmaraş M7.8, macro shock' },
  { label: 'Ongoing',       date: '2024',     type: 'crisis',  desc: 'Persistent lira fragility' },
];

const REGIME_COLOR: Record<string,string> = {
  stable: 'var(--k-success)',
  stress: 'var(--k-warning)',
  crisis: 'var(--k-crisis)',
};

// ── Clock SVG ─────────────────────────────────────────────────────
function FragilityClock({ score }: { score: number }) {
  // score 0–100, 100 = midnight = total crisis
  const angle = (score / 100) * 330 - 165; // -165 to +165 deg arc
  const rad = (a: number) => (a * Math.PI) / 180;
  const cx = 100, cy = 100, r = 72;
  const handLen = 52;
  const hx = cx + handLen * Math.sin(rad(angle));
  const hy = cy - handLen * Math.cos(rad(angle));

  const regime = score >= 70 ? 'crisis' : score >= 40 ? 'stress' : 'stable';
  const color = REGIME_COLOR[regime];

  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 220 }}>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r+10} fill="none" stroke="var(--k-border)" strokeWidth="1"/>
      {/* Danger arc (top 1/3) */}
      <path
        d={`M ${cx + (r+10)*Math.sin(rad(-55))} ${cy - (r+10)*Math.cos(rad(-55))}
            A ${r+10} ${r+10} 0 0 1 ${cx + (r+10)*Math.sin(rad(55))} ${cy - (r+10)*Math.cos(rad(55))}`}
        fill="none" stroke="var(--k-crisis)" strokeWidth="3" opacity="0.25" strokeLinecap="round"
      />
      {/* Main face */}
      <circle cx={cx} cy={cy} r={r} fill="var(--k-surface-raised)"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--k-border)" strokeWidth="1.5"/>
      {/* Hour ticks */}
      {[...Array(12)].map((_,i) => {
        const a = i * 30;
        const x1 = cx + (r-4)*Math.sin(rad(a)), y1 = cy - (r-4)*Math.cos(rad(a));
        const x2 = cx + (r-10)*Math.sin(rad(a)), y2 = cy - (r-10)*Math.cos(rad(a));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={i === 0 ? 'var(--k-crisis)' : 'var(--k-border)'}
          strokeWidth={i === 0 ? 2.5 : 1} />;
      })}
      {/* 12 label */}
      <text x={cx} y={cy - r + 22} textAnchor="middle" fill="var(--k-crisis)"
        style={{ font: '700 10px var(--k-font-data)' }}>CRISIS</text>
      {/* Hand */}
      <line x1={cx} y1={cy} x2={hx} y2={hy}
        stroke={color} strokeWidth="3" strokeLinecap="round"
        style={{ transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}/>
      <circle cx={cx} cy={cy} r="5" fill={color}/>
      {/* Score */}
      <text x={cx} y={cy + 26} textAnchor="middle" fill={color}
        style={{ font: '700 22px var(--k-font-data)' }}>{score}</text>
      <text x={cx} y={cy + 38} textAnchor="middle" fill="var(--k-text-muted)"
        style={{ font: '500 8px var(--k-font-ui)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>fragility score</text>
    </svg>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="k-tooltip">
      <div className="k-tooltip-label">{label}</div>
      <div className="k-tooltip-value" style={{ color: v < 0 ? 'var(--k-crisis)' : 'var(--k-success)' }}>
        {v > 0 ? '+' : ''}{v.toFixed(2)}%
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
const ClockLanding: React.FC = () => {
  const [activeModel, setActiveModel] = useState<'A'|'B'>('B');
  const score = 78;
  const regime = 'crisis';

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Model toggle ── */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 20 }}>
        <div style={{
          display:'flex', background:'var(--k-surface)', border:'1px solid var(--k-border)',
          borderRadius:'var(--k-radius-md)', padding: 3, gap: 2
        }}>
          {(['A','B'] as const).map(m => (
            <button key={m} onClick={() => setActiveModel(m)}
              style={{
                padding: '6px 20px', borderRadius: 'var(--k-radius-sm)', border: 'none',
                background: activeModel === m ? 'var(--k-primary)' : 'transparent',
                color: activeModel === m ? '#fff' : 'var(--k-text-muted)',
                fontFamily: 'var(--k-font-ui)', fontSize: 'var(--k-text-sm)', fontWeight: 600,
                cursor: 'pointer', transition: 'all var(--k-transition)'
              }}>
              Model {m}{m === 'A' ? ' · 2009–11' : ' · Extended'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap: 20, marginBottom: 20, alignItems:'start' }}>

        {/* Clock */}
        <div className="k-panel" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 12, padding: 24 }}>
          <FragilityClock score={score} />
          <div style={{ textAlign:'center' }}>
            <div className={`k-badge k-badge-${regime}`} style={{ margin:'0 auto 6px' }}>
              <span className="k-regime-dot" style={{ background: REGIME_COLOR[regime], boxShadow:`0 0 6px ${REGIME_COLOR[regime]}`, width:6, height:6, borderRadius:'50%', display:'inline-block', marginRight:5 }}/>
              {regime.toUpperCase()} REGIME
            </div>
            <div style={{ fontSize:'var(--k-text-xs)', color:'var(--k-text-faint)', fontFamily:'var(--k-font-data)' }}>
              Model {activeModel} · Last update: Dec 2011
            </div>
          </div>
        </div>

        {/* ISE² Area chart */}
        <div className="k-panel" style={{ padding: '20px 20px 8px' }}>
          <div className="k-panel-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize:'var(--k-text-sm)', fontWeight:700, color:'var(--k-text)' }}>ISE² Returns — Full Timeline</div>
              <div style={{ fontSize:'var(--k-text-xs)', color:'var(--k-text-muted)', marginTop:2 }}>Istanbul Stock Exchange (USD) · daily log returns</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ISE_SERIES} margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="gISE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--k-chart-ise)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--k-chart-ise)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="d" tick={{ fontSize:10, fill:'var(--k-text-faint)', fontFamily:'var(--k-font-data)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:10, fill:'var(--k-text-faint)', fontFamily:'var(--k-font-data)' }} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="var(--k-border)" strokeDasharray="4 4"/>
              <Area type="monotone" dataKey="v" stroke="var(--k-chart-ise)" strokeWidth={1.5}
                fill="url(#gISE)" dot={false}
                activeDot={{ r:4, fill:'var(--k-chart-ise)', strokeWidth:0 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom: 20 }}>
        {[
          { label:'Mean Daily Return',  value:'-0.38%', delta:'-14.2% annualised', neg:true },
          { label:'Peak Drawdown',       value:'-14.1%', delta:'Aug 2018 TL crash', neg:true },
          { label:'Crisis Days (Model B)',value:'31.4%',  delta:'of total dataset',  neg:false },
          { label:'Best Model R²',       value:'0.847',  delta:'XGBoost · Model B',  neg:false },
        ].map(({ label, value, delta, neg }) => (
          <div key={label} className="k-stat">
            <div className="k-stat-label">{label}</div>
            <div className="k-stat-value" style={{ color: neg ? 'var(--k-crisis)' : 'var(--k-text)' }}>{value}</div>
            <div className={`k-stat-delta ${neg ? 'neg' : 'neu'}`}>{delta}</div>
          </div>
        ))}
      </div>

      {/* ── Crisis events ── */}
      <div className="k-panel">
        <div className="k-panel-header">
          <span className="k-panel-title">Key Crisis Events</span>
          <span className="k-badge k-badge-crisis">2009–2024</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap: 0 }}>
          {CRISES.map((c, i) => (
            <div key={i} style={{
              display:'grid', gridTemplateColumns:'120px 100px 1fr',
              alignItems:'center', gap: 16,
              padding: '10px 0',
              borderBottom: i < CRISES.length - 1 ? '1px solid var(--k-divider)' : 'none'
            }}>
              <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                <span className={`k-regime-dot ${c.type}`}/>
                <span style={{ fontSize:'var(--k-text-sm)', fontWeight:600, color:'var(--k-text)' }}>{c.label}</span>
              </div>
              <span style={{ fontFamily:'var(--k-font-data)', fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)' }}>{c.date}</span>
              <span style={{ fontSize:'var(--k-text-sm)', color:'var(--k-text-muted)' }}>{c.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClockLanding;
