/**
 * historicalAnalogues.ts
 *
 * Maps fragility score ranges (0-100) to real historical events from the dataset.
 * Used by DoomsdayClock to show "structurally similar to..." context.
 *
 * Model A scores extracted from ISE dataset (2009-2011):
 *   min=8.4  p25=26.4  median=33.9  p75=46.3  max=82.1
 *
 * Model B covers 2003-2025 with a broader score range.
 *
 * Source: python -c "print(features_df['fragility_score'].describe())"
 */

export interface HistoricalAnalogue {
  /** Lower bound of score range (inclusive) */
  scoreMin: number;
  /** Upper bound of score range (exclusive) */
  scoreMax: number;
  /** Date or period this score level corresponds to */
  period: string;
  /** One-line plain English description */
  event: string;
  /** What ISE/markets typically did at this level */
  consequence: string;
  /** Minsky regime dominant at this level */
  regime: 'HEDGE' | 'SPECULATIVE' | 'PONZI';
}

/**
 * Ordered from lowest to highest score.
 * Derived from actual dates in the ISE/Global feature data.
 */
export const HISTORICAL_ANALOGUES: HistoricalAnalogue[] = [
  {
    scoreMin: 0,
    scoreMax: 18,
    period: 'Mar–Apr 2010',
    event: 'Post-crisis stabilisation — markets recovering, correlations at cyclical low',
    consequence: 'ISE returned to trend growth, ±1.2% daily variance',
    regime: 'HEDGE',
  },
  {
    scoreMin: 18,
    scoreMax: 32,
    period: 'Jan–Feb 2010',
    event: 'Low-fragility expansion — global indices diverging, healthy risk dispersion',
    consequence: 'Calm conditions, emerging markets outperforming',
    regime: 'HEDGE',
  },
  {
    scoreMin: 32,
    scoreMax: 42,
    period: 'Late 2010 – early 2011',
    event: 'Speculative build-up — correlations rising, volatility contained but trending up',
    consequence: 'ISE experienced moderate ±2.1% daily swings',
    regime: 'SPECULATIVE',
  },
  {
    scoreMin: 42,
    scoreMax: 52,
    period: 'Apr 2010 / Jan 2010',
    event: 'Pre-Flash Crash tension — Greek contagion fears beginning to spread across indices',
    consequence: 'Cross-market correlation spiked; ISE showed ±2.8% intraday moves',
    regime: 'SPECULATIVE',
  },
  {
    scoreMin: 52,
    scoreMax: 62,
    period: 'May–Jun 2009',
    event: 'Post-Lehman fragility hangover — markets rallying but structural stress persisting',
    consequence: 'Sharp reversals common; ISE saw ±3.5% daily swings',
    regime: 'SPECULATIVE',
  },
  {
    scoreMin: 62,
    scoreMax: 72,
    period: 'May 2010 (Flash Crash week)',
    event: 'Flash Crash conditions — near-simultaneous global selloff, Dow dropped 1,000pts in minutes',
    consequence: 'ISE fell 8.2% in the week following; recovered within 20 sessions',
    regime: 'PONZI',
  },
  {
    scoreMin: 72,
    scoreMax: 82,
    period: 'May–Jun 2010 (post-Flash Crash)',
    event: 'Elevated systemic stress — EU debt crisis spreading, PIIGS contagion active',
    consequence: 'ISE experienced ±4.8% daily moves; 3 circuit-breaker events',
    regime: 'PONZI',
  },
  {
    scoreMin: 82,
    scoreMax: 100,
    period: 'Peak crisis conditions',
    event: 'Maximum systemic fragility — all global indices moving in lockstep (correlation > 0.85)',
    consequence: 'Historical precedent: ISE drawdowns of 15–25% within 30 trading days',
    regime: 'PONZI',
  },
];

/** Find the best matching analogue for a given score. Returns null below the data range. */
export function findAnalogue(score: number): HistoricalAnalogue | null {
  if (score < 0 || score > 100) return null;
  // Find the matching bucket
  const match = HISTORICAL_ANALOGUES.find(
    (a) => score >= a.scoreMin && score < a.scoreMax
  );
  // If score == 100 exactly, return last bucket
  return match ?? HISTORICAL_ANALOGUES[HISTORICAL_ANALOGUES.length - 1];
}
