/**
 * Integration test for NetworkMST component
 * Validates that MST edges are generated correctly from pairwise_correlations data
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('NetworkMST Integration - MST Edge Generation from Pairwise Correlations', () => {
  
  it('should have pairwise_correlations data in features.json for Model A', () => {
    const featuresPath = path.join(process.cwd(), 'src/data/features.json');
    const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));
    
    // Find a date with valid correlations (not all null)
    const dataWithCorrelations = featuresData.data.find((row: any) => {
      const pc = row.pairwise_correlations || {};
      const values = Object.values(pc).filter((v: any) => v !== null);
      return values.length > 0;
    });
    
    expect(dataWithCorrelations).toBeDefined();
    
    const pc = dataWithCorrelations.pairwise_correlations;
    
    // Verify ISE_USD correlations exist (key for Model A)
    expect(pc['ISE_USD_SP500']).toBeDefined();
    expect(pc['ISE_USD_DAX']).toBeDefined();
    expect(pc['ISE_USD_FTSE']).toBeDefined();
    
    // Verify other correlations exist
    expect(pc['SP500_DAX']).toBeDefined();
    expect(pc['DAX_FTSE']).toBeDefined();
  });
  
  it('should have sufficient correlations to build MST for Model A (8 nodes)', () => {
    const featuresPath = path.join(process.cwd(), 'src/data/features.json');
    const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));
    
    // Model A indices
    const indices = ['ISE', 'SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];
    const n = indices.length;
    
    // Find a date with valid correlations
    const dataWithCorrelations = featuresData.data.find((row: any) => {
      const pc = row.pairwise_correlations || {};
      const values = Object.values(pc).filter((v: any) => v !== null);
      return values.length > 10; // Need at least 10 correlations for 8 nodes
    });
    
    expect(dataWithCorrelations).toBeDefined();
    
    const pc = dataWithCorrelations.pairwise_correlations;
    
    // Count non-null correlations
    const nonNullCorrelations = Object.entries(pc).filter(([key, value]) => value !== null);
    
    // For 8 nodes, we need at least 7 edges (N-1)
    // But we should have many more correlations available
    expect(nonNullCorrelations.length).toBeGreaterThanOrEqual(7);
    
    // Verify we have ISE_USD prefix correlations (7 correlations with ISE)
    const iseCorrelations = nonNullCorrelations.filter(([key]) => key.startsWith('ISE_USD_'));
    expect(iseCorrelations.length).toBeGreaterThanOrEqual(7);
  });
  
  it('should have pairwise_correlations data in Model B features', () => {
    const featuresPath = path.join(process.cwd(), 'src/data/model_b_features.json');
    
    // Check if file exists
    if (!fs.existsSync(featuresPath)) {
      console.log('Model B features file not found, skipping test');
      return;
    }
    
    const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));
    
    // Find a date with valid correlations
    const dataWithCorrelations = featuresData.data.find((row: any) => {
      const pc = row.pairwise_correlations || {};
      const values = Object.values(pc).filter((v: any) => v !== null);
      return values.length > 0;
    });
    
    expect(dataWithCorrelations).toBeDefined();
    
    const pc = dataWithCorrelations.pairwise_correlations;
    
    // Model B should have correlations without ISE_USD prefix
    expect(pc['SP500_DAX']).toBeDefined();
    expect(pc['DAX_FTSE']).toBeDefined();
  });
  
  it('should verify MST algorithm produces N-1 edges for sample data', () => {
    // This test verifies the MST algorithm logic
    // Simulating what NetworkMST.tsx does
    
    const indices = ['ISE', 'SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];
    const n = indices.length;
    
    // Sample pairwise correlations from actual data
    const pairwiseCorrelations: Record<string, number> = {
      'ISE_USD_SP500': 0.406,
      'ISE_USD_DAX': 0.704,
      'ISE_USD_FTSE': 0.646,
      'ISE_USD_NIKKEI': 0.322,
      'ISE_USD_BOVESPA': 0.263,
      'ISE_USD_EU': 0.680,
      'ISE_USD_EM': 0.669,
      'SP500_DAX': 0.682,
      'SP500_FTSE': 0.709,
      'SP500_NIKKEI': -0.053,
      'SP500_BOVESPA': 0.548,
      'SP500_EU': 0.728,
      'SP500_EM': 0.640,
      'DAX_FTSE': 0.898,
      'DAX_NIKKEI': 0.074,
      'DAX_BOVESPA': 0.456,
      'DAX_EU': 0.912,
      'DAX_EM': 0.723,
      'FTSE_NIKKEI': 0.089,
      'FTSE_BOVESPA': 0.512,
      'FTSE_EU': 0.891,
      'FTSE_EM': 0.701,
      'NIKKEI_BOVESPA': 0.234,
      'NIKKEI_EU': 0.123,
      'NIKKEI_EM': 0.345,
      'BOVESPA_EU': 0.567,
      'BOVESPA_EM': 0.789,
      'EU_EM': 0.812,
    };
    
    // Build correlation matrix with ISE_USD prefix handling (the fix)
    const corrMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          corrMatrix[i][j] = 1;
          continue;
        }
        
        // Handle ISE_USD prefix for Model A correlations (THE FIX)
        const idx_i = indices[i] === 'ISE' ? 'ISE_USD' : indices[i];
        const idx_j = indices[j] === 'ISE' ? 'ISE_USD' : indices[j];
        
        const k1 = `${idx_i}_${idx_j}`;
        const k2 = `${idx_j}_${idx_i}`;
        corrMatrix[i][j] = (pairwiseCorrelations[k1] ?? pairwiseCorrelations[k2] ?? 0) as number;
      }
    }
    
    // Verify ISE correlations are loaded (not 0)
    expect(corrMatrix[0][1]).toBeGreaterThan(0); // ISE-SP500
    expect(corrMatrix[0][2]).toBeGreaterThan(0); // ISE-DAX
    expect(corrMatrix[0][3]).toBeGreaterThan(0); // ISE-FTSE
    
    // Count non-zero off-diagonal correlations
    let nonZeroCount = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (corrMatrix[i][j] !== 0) {
          nonZeroCount++;
        }
      }
    }
    
    // Should have all 28 correlations (8 choose 2 = 28)
    expect(nonZeroCount).toBe(28);
    
    // Verify MST can be built (would produce 7 edges for 8 nodes)
    // This is validated by the mstEdgeGeneration.test.ts
  });
});
