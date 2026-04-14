/**
 * Tutorial step definitions
 * 
 * Defines the 8-step guided tour covering all major dashboard components.
 * Each step includes a target selector, title, content, and tooltip position.
 * 
 * Requirements: 3.3, 3.4
 */

import { TutorialStep } from '../components/TutorialOverlay';

/**
 * Tutorial steps covering the complete dashboard experience
 * 
 * Steps:
 * 1. Welcome - Introduction to the Financial Fragility Clock
 * 2. Model Toggle - Switching between prediction models
 * 3. Fragility Score - Understanding the current risk level
 * 4. Regime Timeline - Identifying market regimes over time
 * 5. Date Scrubber - Time travel through historical data
 * 6. Stat Strip - Key market indicators
 * 7. Layman Overlay - Getting plain-language explanations
 * 8. Navigation - Exploring other sections
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    targetSelector: '.doomsday-clock',
    title: 'Welcome to the Financial Fragility Clock',
    content: 'This dashboard visualizes market fragility in real-time. The clock shows how close we are to a financial crisis, with midnight representing maximum danger. Watch for the clock hands moving closer to 12:00 as risk increases.',
    position: 'bottom',
  },
  {
    id: 'model-toggle',
    targetSelector: '.model-toggle',
    title: 'Switch Between Models',
    content: 'Toggle between Model A (ISE 2009-2011) and Model B (Global 2003-2025) to compare different prediction models and time periods. Each model uses different training data and may show different risk assessments.',
    position: 'bottom',
  },
  {
    id: 'fragility-score',
    targetSelector: '.cfr-card',
    title: 'Current Fragility Score',
    content: 'This shows the current market fragility score (0-100). Higher scores indicate greater risk of crisis. Look for scores above 70 as warning signals. The score combines multiple market indicators including correlation, volatility, and entropy.',
    position: 'left',
  },
  {
    id: 'regime-timeline',
    targetSelector: '.regime-timeline',
    title: 'Market Regime Timeline',
    content: 'The timeline shows market regimes over time: Normal (green), Stressed (yellow), and Crisis (red). Use this to identify historical patterns and see how regimes transition. Click on any period to jump to that date.',
    position: 'left',
  },
  {
    id: 'date-scrubber',
    targetSelector: '.date-scrubber',
    title: 'Time Travel',
    content: 'Drag the slider to explore historical data. Watch how the clock and visualizations update to show market conditions at any point in time. This lets you study past crises and compare them to current conditions.',
    position: 'top',
  },
  {
    id: 'stat-strip',
    targetSelector: '.stat-strip',
    title: 'Key Metrics',
    content: 'These cards show critical market indicators: correlation (market interconnectedness), entropy (uncertainty), volatility (price swings), and eigenvalue ratio (systemic risk). Rising values often precede crises.',
    position: 'top',
  },
  {
    id: 'layman-overlay',
    targetSelector: '.layman-overlay-trigger',
    title: 'Get Explanations',
    content: 'Click the info icon on any chart to see plain-language explanations of what the data means for current market conditions. These overlays provide context-specific interpretations based on actual data values.',
    position: 'right',
  },
  {
    id: 'navigation',
    targetSelector: '.sidebar',
    title: 'Explore More',
    content: 'Use the sidebar to access detailed analysis: Clock (overview), Data Room (correlations and networks), ML Lab (SHAP values and model performance), Archive (crisis timeline), and Methods (methodology). Press Ctrl+B to toggle the sidebar.',
    position: 'right',
  },
];

/**
 * Get a tutorial step by ID
 */
export const getTutorialStep = (id: string): TutorialStep | undefined => {
  return TUTORIAL_STEPS.find(step => step.id === id);
};

/**
 * Get the total number of tutorial steps
 */
export const getTutorialStepCount = (): number => {
  return TUTORIAL_STEPS.length;
};
