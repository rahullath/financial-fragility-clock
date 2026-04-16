/**
 * ClockLanding — / (Overview)
 * Clock visual + ISE² chart + KPIs + crisis timeline
 * Warm editorial style, no forced dark, no terminal aesthetic
 */
import React, { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';

// ── Data ──────────────────────────────────────────────────────────

const ISE_SERIES = [
  { d: 'Jan 09', v: -8.2 }, { d: 'Apr 09', v: -3.1 },
  { d: 'Jul 09', v:  4.5 }, { d: 'Oct 09', v:  6.1 },
  { d: 'Jan 10', v:  2.8 }, { d: 'Apr 10', v:  1.2 },
  { d: 'Jul 10', v:  3.9 }, { d: 'Oct 10', v:  5.4 },
  { d: 'Jan 11', v: -1.4 }, { d: 'Apr 11', v:  0.7 },
  { d: 'Jul 11', v: -2.9 }, { d: 'Oct 11', v: -5.8 },
  { d: 'Jan 18', v: -6.2 }, { d: 'Apr 18', v: -9.4 },
  { d: 'Aug 18', v:-14.1 }, { d: 'Jan 19', v: -3.2 },
  { d: 'Jul 21', v: -7.8 }, { d: 'Jan 22', v:-11.2 },
  { d: 'Jan 23', v: -4.3 }, { d: 'Jul 23', v: -6.1 },
  { d: 'Jan 24', v: -5.4 },
];

const CRISES = [
  { label: 'GFC Recovery',  date: '2009–2011', regime: 'speculative', desc: 'Post-crisis stabilisation. Model A training window.' },
  { label: 'TL Collapse',   date: 'Aug 2018',  regime: 'ponzi',       desc: 'USD/TRY surged to 7.2. ISE² fell ~40% in weeks.' },
  { label: 'CBRT Rate Cuts',date: '2021–22',   regime: 'ponzi',       desc: 'Rate cuts into 80%+ inflation. Erdoğan doctrine.' },
  { label: 'Earthquake',    date: 'Feb 2023',  regime: 'ponzi',       desc: 'Kahramanmaraş M7.8 — macro shock on fragile base.' },
  { label: 'Ongoing',       date: '2024',      regime: 'ponzi',       desc: 'Persistent lira fragility. Elevated Ponzi regime.' },
];

const KPI = [
  { label: 'Mean Daily Return',    value: '−0.38%', sub: '−14.2% annualised',       neg: true  },
  { label: 'Peak Drawdown',        value: '−14.1%', sub: 'Aug 2018 TL crash',       neg: true  },
  { label: 'Crisis Days (Model B)', value: '31.4%', sub: 'of extended dataset',      neg: false },
  { label: 'Best Model R²',        value: '0.847',  sub: 'XGBoost · Model B',        neg: false },
];

// ── Helpers ────────────────────────────────────────────────────────

function regimeLabel(r: string) {
  return r === 'ponzi' ? 'Ponzi'
       : r === 'speculative' ? 'Speculative'
       : 'Hedge';
}

// ── Clock SVG ─────────────────────────────────────────────────────
// Keep the original clock concept but with warm palette
function FragilityClock({ score }: { score: number }) {
  const arc = (score / 100) * 300 - 150; // -150 to +150 deg
  const rad = (a: number) => (a * Math.PI) / 180;
  const cx = 100, cy = 108, r = 72;

  const hx = cx + 56 * Math.sin(rad(arc));
  const hy = cy - 56 * Math.cos(rad(arc));

  const regime = score >= 67 ? 'ponzi' : score >= 34 ? 'speculative' : 'hedge';
  const handColor = regime === 'ponzi' ? 'var(--c-ponzi-raw)'
                  : regime === 'speculative' ? 'var(--c-speculative-raw)'
                  : 'var(--c-hedge)';

  return (
    <svg viewBox="0 0 200 216" style={{ width: '100%', maxWidth: 200 }} aria-label={`Fragility score ${score}`}>
      {/* Outer arc segments */}
      {/* Hedge zone — bottom left */}
      <path d={`M ${cx + (r+14)*Math.sin(rad(-150))} ${cy - (r+14)*Math.cos(rad(-150))}
                A ${r+14} ${r+14} 0 0 1 ${cx + (r+14)*Math.sin(rad(-50))} ${cy - (r+14)*Math.cos(rad(-50))}`}
        fill="none" stroke="var(--c-hedge)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      {/* Speculative zone — top */}
      <path d={`M ${cx + (r+14)*Math.sin(rad(-50))} ${cy - (r+14)*Math.cos(rad(-50))}
                A ${r+14} ${r+14} 0 0 1 ${cx + (r+14)*Math.sin(rad(50))} ${cy - (r+14)*Math.cos(rad(50))}`}
        fill="none" stroke="var(--c-speculative-raw)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      {/* Ponzi zone — right */}
      <path d={`M ${cx + (r+14)*Math.sin(rad(50))} ${cy - (r+14)*Math.cos(rad(50))}
                A ${r+14} ${r+14} 0 0 1 ${cx + (r+14)*Math.sin(rad(150))} ${cy - (r+14)*Math.cos(rad(150))}`}
        fill="none" stroke="var(--c-ponzi-raw)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />

      {/* Clock face */}
      <circle cx={cx} cy={cy} r={r} fill="var(--c-surface-raised)" stroke="var(--c-border)" strokeWidth="1.5"/>

      {/* Hour ticks */}
      {[...Array(12)].map((_,i) => {
        const a = i * 30 - 90;
        const isMajor = i % 3 === 0;
        const x1 = cx + (r - 3) * Math.cos(rad(a)), y1 = cy + (r - 3) * Math.sin(rad(a));
        const x2 = cx + (r - (isMajor ? 11 : 7)) * Math.cos(rad(a)),
              y2 = cy + (r - (isMajor ? 11 : 7)) * Math.sin(rad(a));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={isMajor ? 'var(--c-border-strong)' : 'var(--c-border)'} strokeWidth={isMajor ? 1.5 : 1} />;
      })}

      {/* PONZI label at 12 */}
      <text x={cx} y={cy - r + 18} textAnchor="middle" fill="var(--c-ponzi)" fontFamily="var(--font-mono)" fontSize="8" fontWeight="700" letterSpacing="1.5">PONZI</text>
      {/* HEDGE label at bottom */}
      <text x={cx - r + 14} y={cy + 8} textAnchor="middle" fill="var(--c-hedge)" fontFamily="var(--font-mono)" fontSize="7.5" fontWeight="600" transform={`rotate(-90,${cx - r + 14},${cy + 8})`}>HEDGE</text>

      {/* Hand */}
      <line x1={cx} y1={cy} x2={hx} y2={hy}
        stroke={handColor} strokeWidth="2.5" strokeLinecap="round"
        style={{ transition: 'x2 0.9s cubic-bezier(.34,1.56,.64,1), y2 0.9s cubic-bezier(.34,1.56,.64,1)' }}/>
      {/* Centre pin */}
      <circle cx={cx} cy={cy} r="5" fill={handColor} />
      <circle cx={cx} cy={cy} r="2.5" fill="var(--c-surface)" />

      {/* Score display */}
      <text x={cx} y={cy + 28} textAnchor="middle" fill="var(--c-text)" fontFamily="var(--font-mono)" fontSize="26" fontWeight="500">{score}</text>
      <text x={cx} y={cy + 42} textAnchor="middle" fill="var(--c-text-faint)" fontFamily="var(--font-sans)" fontSize="9" fontWeight="600" letterSpacing="1.5">FRAGILITY SCORE</text>

      {/* Regime label */}
      <text x={cx} y={cy + 58} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="11" fontWeight="700"
        fill={handColor}>{regimeLabel(regime).toUpperCase()} REGIME</text>
    </svg>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-value" style={{ color: v < 0 ? 'var(--c-ponzi)' : 'var(--c-hedge)' }}>
        {v > 0 ? '+' : ''}{v.toFixed(2)}%
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

const ClockLanding: React.FC = () => {
  const [activeModel, setActiveModel] = useState<'A' | 'B'>('B');
  const score = 78;

  return (
    <main className="page">

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1>Turkey Financial Fragility</h1>
          <p>Istanbul Stock Exchange (USD) · Minsky regime analysis · 2009–2024</p>
        </div>
        {/* Model toggle */}
        <div style={{ display:'flex', alignItems:'center', gap: 8, marginTop: 'var(--sp-2)' }}>
          <span style={{ fontSize:'var(--text-sm)', color:'var(--c-text-faint)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>Model</span>
          {(['A','B'] as const).map(m => (
            <button key={m}
              onClick={() => setActiveModel(m)}
              className={`btn btn-sm ${activeModel === m ? 'btn-primary' : 'btn-outline'}`}
            >
              {m === 'A' ? 'A · 2009–11' : 'B · Extended'}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
        {KPI.map(({ label, value, sub, neg }) => (
          <div key={label} className="stat">
            <div className="stat-label">{label}</div>
            <div className={`stat-value ${neg ? 'neg' : ''} mono`}>{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Hero: clock + chart ── */}
      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:'var(--sp-5)', alignItems:'start', marginBottom:'var(--sp-6)' }}>

        {/* Clock */}
        <div className="panel" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'var(--sp-3)', paddingTop:'var(--sp-6)', paddingBottom:'var(--sp-5)' }}>
          <FragilityClock score={score} />
          <div style={{ textAlign:'center', marginTop:'var(--sp-2)' }}>
            <div style={{ fontSize:'var(--text-xs)', color:'var(--c-text-faint)', fontFamily:'var(--font-mono)' }}>
              Model {activeModel} · {activeModel === 'A' ? 'Aug 2011' : 'Live 2024'}
            </div>
          </div>
        </div>

        {/* ISE² chart */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div style={{ fontWeight:600, color:'var(--c-text)', fontSize:'var(--text-md)' }}>ISE² Returns</div>
              <div style={{ fontSize:'var(--text-sm)', color:'var(--c-text-muted)', marginTop:2 }}>Istanbul Stock Exchange (USD) · monthly avg log returns</div>
            </div>
            <span className="regime-badge ponzi">
              <span className="regime-dot ponzi" />
              Ponzi
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ISE_SERIES} margin={{ top:4, right:4, left:-18, bottom:0 }}>
              <defs>
                <linearGradient id="gISE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--c-ise)" stopOpacity={0.18}/>
                  <stop offset="95%" stopColor="var(--c-ise)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--c-divider)" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="d" tick={{ fontSize:10, fill:'var(--c-text-faint)', fontFamily:'var(--font-mono)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:10, fill:'var(--c-text-faint)', fontFamily:'var(--font-mono)' }} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="var(--c-border-strong)" strokeDasharray="4 3"/>
              <Area type="monotone" dataKey="v" stroke="var(--c-ise)" strokeWidth={2}
                fill="url(#gISE)" dot={false}
                activeDot={{ r:4, fill:'var(--c-ise)', strokeWidth:0 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Crisis events ── */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Key Crisis Events</span>
          <span className="regime-badge ponzi">2009–2024</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Date</th>
              <th>Regime</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {CRISES.map((c) => (
              <tr key={c.label}>
                <td style={{ fontWeight: 600 }}>{c.label}</td>
                <td className="mono">{c.date}</td>
                <td>
                  <span className={`regime-badge ${c.regime}`}>
                    <span className={`regime-dot ${c.regime}`} />
                    {regimeLabel(c.regime)}
                  </span>
                </td>
                <td style={{ color:'var(--c-text-muted)' }}>{c.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </main>
  );
};

export default ClockLanding;
