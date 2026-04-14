/**
 * Example usage of mock data generators
 * 
 * This file demonstrates how to use the mock data generators for development
 * and testing. It can also be used to generate sample JSON files for the
 * Python backend team to reference.
 */

import {
  generateMockMLModelsExtended,
  generateMockRegimeTransitions,
  generateMockDTWSimilarity,
  generateMockCorrelationNetworks,
  generateMockVolatilityClustering,
  generateMockLeadTimeStats,
} from './mockDataGenerators';

/**
 * Generate all mock data files for a given date range
 */
export function generateAllMockData(startDate: string, endDate: string) {
  return {
    mlModelsExtended: generateMockMLModelsExtended(startDate, endDate),
    regimeTransitions: generateMockRegimeTransitions(startDate, endDate),
    dtwSimilarity: generateMockDTWSimilarity(startDate, endDate),
    correlationNetworks: generateMockCorrelationNetworks(startDate, endDate),
    volatilityClustering: generateMockVolatilityClustering(startDate, endDate),
    leadTimeStats: generateMockLeadTimeStats(),
  };
}

/**
 * Example: Generate mock data for Model B's date range (2003-2025)
 */
export function generateModelBMockData() {
  return generateAllMockData('2003-01-01', '2025-12-31');
}

/**
 * Example: Generate mock data for Model A's date range (2009-2011)
 */
export function generateModelAMockData() {
  return generateAllMockData('2009-01-01', '2011-12-31');
}

/**
 * Example: Generate mock data for a specific crisis period (COVID-19)
 */
export function generateCovidPeriodMockData() {
  return generateAllMockData('2019-01-01', '2021-12-31');
}

/**
 * Utility function to save mock data to JSON files (for Node.js environment)
 * 
 * Note: This requires Node.js fs module and should be run in a Node environment,
 * not in the browser.
 */
export async function saveMockDataToFiles(startDate: string, endDate: string) {
  const data = generateAllMockData(startDate, endDate);
  
  // This would require fs module in Node.js
  // Example usage:
  // import fs from 'fs';
  // fs.writeFileSync('src/data/ml_models_extended.json', JSON.stringify(data.mlModelsExtended, null, 2));
  // fs.writeFileSync('src/data/regime_transitions.json', JSON.stringify(data.regimeTransitions, null, 2));
  // ... etc
  
  return data;
}

// Example usage in development:
// Uncomment to generate sample data for inspection
/*
if (import.meta.env?.DEV) {
  const sampleData = generateAllMockData('2020-01-01', '2023-12-31');
  console.log('Sample ML Models Extended:', sampleData.mlModelsExtended.metadata);
  console.log('Sample Regime Transitions:', sampleData.regimeTransitions.metadata);
  console.log('Sample DTW Similarity:', sampleData.dtwSimilarity.metadata);
  console.log('Sample Correlation Networks:', sampleData.correlationNetworks.metadata);
  console.log('Sample Volatility Clustering:', sampleData.volatilityClustering.metadata);
  console.log('Sample Lead Time Stats:', sampleData.leadTimeStats.metadata);
}
*/
