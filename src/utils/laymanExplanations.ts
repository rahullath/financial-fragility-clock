/**
 * Layman Explanation Generators
 * 
 * Generates plain-language explanations based on actual data values.
 * Avoids generic chart descriptions and includes specific numerical values.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
 */

import { DataRow } from '../contexts/ModelContext';
import { toNum } from './dataUtils';

/**
 * Generate explanation for the Doomsday Clock visualization
 */
export function generateClockExplanation(row: DataRow | null): string {
  if (!row) {
    return "No data available for the selected date.";
  }

  const score = toNum(row.fragility_score) ?? 0;

  let explanation = `The current fragility score is ${score.toFixed(1)} out of 100. `;

  if (score >= 70) {
    explanation += `This is in the PONZI regime (crisis zone). Markets are extremely fragile and vulnerable to sudden crashes. `;
    explanation += `At this level, investors are relying heavily on asset price increases rather than fundamental income, `;
    explanation += `which makes the system unstable. A score above 70 indicates we're "past midnight" - crisis conditions are active.`;
  } else if (score >= 40) {
    explanation += `This is in the SPECULATIVE regime (elevated risk). Markets are showing increased risk-taking behavior. `;
    explanation += `Investors are becoming more dependent on expected price appreciation rather than income from assets. `;
    explanation += `While not yet critical, this level warrants close monitoring as conditions could deteriorate quickly.`;
  } else {
    explanation += `This is in the HEDGE regime (normal conditions). Markets are relatively stable and healthy. `;
    explanation += `Investors are primarily focused on income-generating assets and fundamental values. `;
    explanation += `This represents normal market functioning with manageable risk levels.`;
  }

  return explanation;
}

/**
 * Generate explanation for the Regime Timeline
 */
export function generateTimelineExplanation(row: DataRow | null): string {
  if (!row) {
    return "No data available for the selected date.";
  }

  const score = toNum(row.fragility_score) ?? 0;
  const regime = (row.regime as string) ?? 'SPECULATIVE';

  let explanation = `On this date, the fragility score was ${score.toFixed(1)}, placing markets in the ${regime} regime. `;

  explanation += `The timeline shows how market conditions evolve over time through three states: `;
  explanation += `HEDGE (green, safe conditions with scores below 40), `;
  explanation += `SPECULATIVE (amber, elevated risk with scores 40-70), and `;
  explanation += `PONZI (red, crisis conditions with scores above 70). `;

  explanation += `When you see long stretches of red, those are periods when the financial system was highly fragile. `;
  explanation += `Green periods indicate stable, healthy markets. The vertical lines mark major financial events like crashes or corrections.`;

  return explanation;
}

/**
 * Generate explanation for the StatStrip
 */
export function generateStatStripExplanation(row: DataRow | null): string {
  if (!row) {
    return "No data available for the selected date.";
  }

  const score = toNum(row.fragility_score) ?? 0;
  const meanCorr = toNum(row.mean_corr);
  const entropy = toNum(row.permutation_entropy);
  const volatility = toNum(row.rolling_volatility);

  let explanation = `These metrics show key market conditions on this date. `;

  // Crash proximity
  const minsToMidnight = Math.round((1 - score / 100) * 120);
  if (score >= 70) {
    explanation += `The fragility score of ${score.toFixed(1)} means we're "past midnight" - in crisis territory. `;
  } else if (minsToMidnight <= 30) {
    explanation += `With ${minsToMidnight} minutes to midnight, markets are approaching dangerous levels. `;
  } else {
    explanation += `Markets are ${Math.floor(minsToMidnight / 60)}h ${minsToMidnight % 60}m from midnight (crisis threshold). `;
  }

  // Mean correlation
  if (meanCorr !== null) {
    explanation += `The average correlation between markets is ${(meanCorr * 100).toFixed(0)}%. `;
    if (meanCorr > 0.7) {
      explanation += `This high correlation means markets are moving together - a warning sign that diversification isn't working and contagion risk is high. `;
    } else if (meanCorr < 0.3) {
      explanation += `This low correlation is healthy - markets are moving independently, which reduces systemic risk. `;
    } else {
      explanation += `This moderate correlation is typical for normal market conditions. `;
    }
  }

  // Entropy
  if (entropy !== null) {
    explanation += `Market entropy is ${entropy.toFixed(2)}. `;
    if (entropy < 0.5) {
      explanation += `Low entropy means markets are becoming more predictable and synchronized, which often precedes crises. `;
    } else {
      explanation += `Higher entropy indicates markets are behaving more randomly and independently, which is generally healthier. `;
    }
  }

  // Volatility
  if (volatility !== null) {
    explanation += `Rolling volatility is ${(volatility * 100).toFixed(1)}%. `;
    if (volatility > 0.03) {
      explanation += `This elevated volatility indicates nervous, unstable markets. `;
    } else {
      explanation += `This volatility level is within normal ranges. `;
    }
  }

  return explanation;
}

/**
 * Generate explanation for the Correlation Heatmap
 */
export function generateCorrelationExplanation(row: DataRow | null, _indices: string[]): string {
  if (!row) {
    return "No data available for the selected date.";
  }

  const meanCorr = toNum(row.mean_corr);
  const pairwiseCorrs = row.pairwise_correlations as Record<string, number | null> | null;

  let explanation = `This shows how closely different stock markets move together over a 60-day window. `;

  if (meanCorr !== null) {
    explanation += `The average correlation across all market pairs is ${(meanCorr * 100).toFixed(0)}%. `;

    if (meanCorr > 0.7) {
      explanation += `When correlations are this high (dark red boxes), it means markets are losing their independence - `;
      explanation += `they're all rising or falling together. This is a classic warning sign of systemic crisis. `;
      explanation += `During normal times, different markets move at different speeds and sometimes in different directions, `;
      explanation += `which provides natural diversification. But when everything moves together, there's nowhere to hide.`;
    } else if (meanCorr > 0.5) {
      explanation += `These moderate-to-high correlations (orange-red boxes) suggest markets are somewhat synchronized. `;
      explanation += `This is elevated compared to normal conditions but not yet at crisis levels. `;
      explanation += `It indicates that global factors are starting to dominate local market dynamics.`;
    } else {
      explanation += `These lower correlations (lighter colors) are healthy. Markets are moving more independently, `;
      explanation += `which means diversification across different countries and regions is working as intended. `;
      explanation += `This reduces the risk of simultaneous crashes across all markets.`;
    }
  }

  // Find highest correlation pair if available
  if (pairwiseCorrs) {
    let maxCorr = -1;
    let maxPair = '';
    
    for (const [key, value] of Object.entries(pairwiseCorrs)) {
      if (value !== null && value > maxCorr) {
        maxCorr = value;
        maxPair = key;
      }
    }

    if (maxCorr > 0 && maxPair) {
      const [idx1, idx2] = maxPair.split('_');
      explanation += ` The strongest connection is between ${idx1} and ${idx2} at ${(maxCorr * 100).toFixed(0)}% correlation.`;
    }
  }

  return explanation;
}

/**
 * Generate explanation for the Regime Transition Matrix
 */
export function generateRegimeTransitionExplanation(
  transitionData: { date: string; matrix: number[][]; current_regime: string } | null,
  currentRegime: string
): string {
  if (!transitionData) {
    return "No regime transition data available for the selected date.";
  }

  const regimes = ['normal', 'stressed', 'crisis'];
  const regimeLabels: Record<string, string> = {
    normal: 'Normal',
    stressed: 'Stressed',
    crisis: 'Crisis',
  };

  const currentIdx = regimes.indexOf(currentRegime);
  const matrix = transitionData.matrix;

  let explanation = `Markets are currently in the ${regimeLabels[currentRegime]} regime. `;

  if (currentIdx >= 0 && matrix[currentIdx]) {
    const transitions = matrix[currentIdx];
    const normalProb = transitions[0] * 100;
    const stressedProb = transitions[1] * 100;
    const crisisProb = transitions[2] * 100;

    explanation += `Based on historical patterns, the probabilities of transitioning to different regimes are: `;
    explanation += `${normalProb.toFixed(0)}% chance of moving to Normal, `;
    explanation += `${stressedProb.toFixed(0)}% chance of Stressed, and `;
    explanation += `${crisisProb.toFixed(0)}% chance of Crisis. `;

    // Interpret the most likely transition
    const maxProb = Math.max(normalProb, stressedProb, crisisProb);
    
    if (currentRegime === 'crisis') {
      if (normalProb === maxProb) {
        explanation += `The high probability of returning to Normal suggests crisis conditions may be resolving. `;
      } else if (crisisProb === maxProb) {
        explanation += `The high probability of remaining in Crisis indicates persistent instability. `;
      }
    } else if (currentRegime === 'stressed') {
      if (crisisProb > 30) {
        explanation += `The ${crisisProb.toFixed(0)}% chance of escalating to Crisis is concerning and warrants close monitoring. `;
      } else if (normalProb > 50) {
        explanation += `The high probability of returning to Normal is encouraging. `;
      }
    } else if (currentRegime === 'normal') {
      if (stressedProb + crisisProb > 40) {
        explanation += `The combined ${(stressedProb + crisisProb).toFixed(0)}% chance of deterioration suggests emerging risks. `;
      } else {
        explanation += `The high probability of remaining in Normal indicates stable conditions. `;
      }
    }

    explanation += `These probabilities are calculated from historical regime transitions and help assess the likelihood of market conditions changing.`;
  }

  return explanation;
}

/**
 * Generate explanation for the DTW Similarity Heatmap
 */
export function generateDTWSimilarityExplanation(
  referenceDate: string,
  top5Periods: Array<{ date: string; score: number; features_matched: string[] }>
): string {
  if (top5Periods.length === 0) {
    return "No similar historical periods found for the selected date.";
  }

  const refDate = new Date(referenceDate).toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  let explanation = `This analysis uses Dynamic Time Warping (DTW) to find historical periods with similar market patterns to ${refDate}. `;
  
  explanation += `DTW compares the shape and sequence of market indicators over time, identifying periods that behaved similarly even if they occurred at different scales or speeds. `;

  // Describe top match
  const topMatch = top5Periods[0];
  const topDate = new Date(topMatch.date).toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const topScore = (topMatch.score * 100).toFixed(0);

  explanation += `The most similar period was ${topDate}, with a ${topScore}% similarity score. `;

  // Interpret similarity level
  if (topMatch.score > 0.8) {
    explanation += `This extremely high similarity means market conditions were nearly identical - `;
    explanation += `the same indicators were moving in the same patterns. `;
  } else if (topMatch.score > 0.6) {
    explanation += `This strong similarity indicates comparable market dynamics and risk patterns. `;
  } else {
    explanation += `This moderate similarity suggests some common patterns but also notable differences. `;
  }

  // Mention matched features
  if (topMatch.features_matched.length > 0) {
    const features = topMatch.features_matched.slice(0, 3).join(', ');
    explanation += `Key matching indicators include: ${features}. `;
  }

  // Explain utility
  explanation += `By studying what happened after similar historical periods, you can gain insights into potential future developments. `;
  explanation += `Click on any highlighted period to navigate to that date and compare market conditions in detail.`;

  return explanation;
}

/**
 * Generate explanation for the Correlation Network Evolution
 */
export function generateCorrelationNetworkExplanation(
  snapshot: { date: string; nodes: Array<{ id: string; label: string }>; edges: Array<{ source: string; target: string; weight: number }>; metrics: { density: number; clustering_coefficient: number; avg_degree: number } } | null,
  isCrisisPattern: boolean
): string {
  if (!snapshot) {
    return "No network data available for the selected date.";
  }

  const { metrics, nodes, edges } = snapshot;
  const density = (metrics.density * 100).toFixed(0);
  const clustering = (metrics.clustering_coefficient * 100).toFixed(0);
  const avgDegree = metrics.avg_degree.toFixed(1);

  let explanation = `This network shows how ${nodes.length} financial markets are interconnected through correlations. `;
  explanation += `Each circle (node) represents a market, and lines (edges) connect markets that move together. `;

  // Network density interpretation
  explanation += `The network density is ${density}%, meaning ${density}% of all possible connections exist. `;
  
  if (metrics.density > 0.6) {
    explanation += `This high density indicates markets are tightly interconnected - almost everything is correlated with everything else. `;
    explanation += `This is a warning sign because it means shocks can spread rapidly across the entire system. `;
    explanation += `During crises, markets lose their independence and move as one, eliminating diversification benefits. `;
  } else if (metrics.density > 0.4) {
    explanation += `This moderate density shows significant interconnection but markets still maintain some independence. `;
  } else {
    explanation += `This lower density is healthy - markets are connected but maintain independence, allowing diversification to work. `;
  }

  // Clustering coefficient interpretation
  explanation += `The clustering coefficient is ${clustering}%, which measures how much markets form tight groups. `;
  
  if (metrics.clustering_coefficient > 0.7) {
    explanation += `High clustering means markets are forming tightly-knit communities where everyone is connected to everyone else. `;
    explanation += `This amplifies contagion risk - if one market in a cluster crashes, the whole cluster tends to follow. `;
  } else if (metrics.clustering_coefficient > 0.5) {
    explanation += `Moderate clustering indicates some regional or sectoral groupings are forming. `;
  } else {
    explanation += `Lower clustering suggests markets are more evenly distributed in their connections. `;
  }

  // Average degree interpretation
  explanation += `On average, each market is directly connected to ${avgDegree} other markets. `;

  // Node size explanation
  explanation += `Larger circles represent markets with more connections (higher degree), making them potential contagion hubs. `;
  explanation += `Thicker lines indicate stronger correlations between markets. `;

  // Crisis pattern warning
  if (isCrisisPattern) {
    explanation += `⚠️ WARNING: This network shows a crisis-like pattern with high density and clustering. `;
    explanation += `When networks look like this, the financial system is vulnerable to cascading failures. `;
    explanation += `A shock to any major hub can rapidly spread throughout the entire network.`;
  } else {
    explanation += `The current network structure suggests normal market conditions with manageable interconnection levels.`;
  }

  return explanation;
}
