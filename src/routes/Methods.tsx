import React from 'react';
import { Link } from 'react-router-dom';
import './Methods.css';

/**
 * Methods
 * Methodology and Theoretical Foundation Explanation Component
 */
const Methods: React.FC = () => {
  return (
    <div className="methods-route">
      <header className="methods-header">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
        <h1>Methodology & Theoretical Foundation</h1>
        <p>The mathematics and theory powering the Financial Fragility Clock</p>
      </header>

      <main className="methods-content">
        <section className="article-section">
          <h2>1. Minsky's Financial Instability Hypothesis</h2>
          <p>
            Hyman Minsky's <em>Financial Instability Hypothesis</em> (1992) proposes that over periods of prolonged prosperity, a capitalist economy naturally shifts from financial relations that make for a stable system, to relations that make for an unstable system. 
          </p>
          <p>
            Minsky identified three distinct financing regimes that actors within an economy adopt over a financial cycle:
          </p>
          <ul>
            <li><strong>Hedge Finance:</strong> Firms can fulfill all of their debt obligations from cash flows. The system is resilient.</li>
            <li><strong>Speculative Finance:</strong> Firms can pay the interest on debt from cash flows, but must constantly roll over the principal. Subject to interest rate shocks.</li>
            <li><strong>Ponzi Finance:</strong> Cash flows from operations are insufficient to pay either principal or interest. Firms must borrow or sell assets simply to pay interest. This is highly fragile.</li>
          </ul>
          <p>The "Minsky Moment" occurs when Ponzi structures unravel, leading to sudden asset liquidation and a systemic credit crisis.</p>
        </section>

        <section className="article-section">
          <h2>2. Constructing the Fragility Score</h2>
          <p>
            The Composite Risk Index (Fragility Score) serves as a quantitative proxy for systemic risk. To capture the nonlinear nature of financial instability, we blend together statistical entropy, network correlation analysis, and dynamic volatility into a composite bounded between 0 and 100.
          </p>
          
          <pre className="formula-block">
            FragilityScore = 0.40 × RollingCorrelation 
                         + 0.30 × PermutationEntropy⁻¹ 
                         + 0.20 × NormVolatility 
                         + 0.10 × PredictionError
          </pre>

          <ul>
            <li><strong>Rolling Correlation (40%):</strong> Assesses systemic contagion. Markets operating in Ponzi states invariably move tightly as a single block during liquidation events. 60-day Pearson correlations are utilized.</li>
            <li><strong>Permutation Entropy Inverse (30%):</strong> A time-series complexity metric. Low entropy indicates highly structured, deterministic behavior (e.g., herd behavior), which precedes crashes.</li>
            <li><strong>Normalized Volatility (20%):</strong> 30-day standard deviation, representing the chaotic price dispersion during unfolding events.</li>
            <li><strong>Model Prediction Error (10%):</strong> Structural breaks lower traditional model accuracy. High prediction error signals a regime breakdown.</li>
          </ul>
          <p><em>In Model B, macro indicators such as the TED Spread and VIX heavily modify these weightings.</em></p>
        </section>

        <section className="article-section">
          <h2>3. Regime Classification</h2>
          <p>
            Transforming a continuous 1-100 score into Minsky’s three discrete regimes is handled via historically verified threshold calibration:
          </p>
          <ul>
            <li><strong>HEDGE (0-33):</strong> Correlation &lt; 0.4, Volatility &lt; 0.8× Median. Stable operations.</li>
            <li><strong>SPECULATIVE (34-66):</strong> The intermediate transition. Correlation builds but remains contained.</li>
            <li><strong>PONZI (67-100):</strong> Correlation &gt; 0.7, Volatility &gt; 1.5× Median. The market is deeply cross-contaminated and fragile.</li>
          </ul>
        </section>
        
        <section className="article-section">
          <h2>4. Model Framework Comparisons</h2>
          <p>
            The dashboard visualizes two competing architectures:
          </p>
          <p>
            <strong>Model A (Localized Framework):</strong> Restricted to the Turkish ISE index spanning 2009-2011 to prove underlying mathematical validity of Permutation Entropy on localized returns.
          </p>
          <p>
            <strong>Model B (Global Macro Framework):</strong> An expanded 2003-2025 global dataset containing additional macroeconomic constraints (TED Spread, Fed Funds Rate, Yield inversions). This setup empirically demonstrates that predicting exact crisis inflection points requires a globally intertwined macroeconomic view.
          </p>
        </section>

        <footer className="article-footer">
          <h3>References</h3>
          <ul>
            <li>Minsky, H. P. (1992). <em>The Financial Instability Hypothesis</em>. Working Paper No. 74, The Jerome Levy Economics Institute of Bard College.</li>
            <li>Mantegna, R. N. (1999). <em>Hierarchical structure in financial markets</em>. The European Physical Journal B, 11(1), 193-197.</li>
          </ul>
        </footer>
      </main>
    </div>
  );
};

export default Methods;
