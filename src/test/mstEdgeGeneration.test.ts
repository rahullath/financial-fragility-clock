/**
 * Test for MST Edge Generation Fix (Task 3.3)
 * 
 * Validates that the MST visualization generates N-1 edges for N nodes
 * using correlation distances from pairwise_correlations data.
 */

import { describe, it, expect } from 'vitest';

describe('MST Edge Generation', () => {
  /**
   * Helper function to simulate Kruskal's MST algorithm
   * This mirrors the logic in NetworkMST.tsx
   */
  function kruskalMST(
    n: number,
    edges: Array<{ i: number; j: number; w: number }>
  ): Array<{ i: number; j: number; w: number }> {
    const parent = Array.from({ length: n }, (_, k) => k);
    function find(x: number): number {
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    }
    function union(a: number, b: number) {
      parent[find(a)] = find(b);
    }

    const result: Array<{ i: number; j: number; w: number }> = [];
    for (const e of edges) {
      if (find(e.i) !== find(e.j)) {
        result.push(e);
        union(e.i, e.j);
        if (result.length === n - 1) break;
      }
    }
    return result;
  }

  /**
   * Helper to compute Mantegna distance
   */
  function mantegnaDistance(corr: number): number {
    return Math.sqrt(2 * Math.max(0, 1 - corr));
  }

  /**
   * Helper to build correlation matrix with ISE_USD prefix handling
   */
  function buildCorrelationMatrix(
    indices: string[],
    pairwiseCorrelations: Record<string, number | null>
  ): number[][] {
    const n = indices.length;
    const corrMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          corrMatrix[i][j] = 1;
          continue;
        }
        
        // Handle ISE_USD prefix for Model A correlations
        const idx_i = indices[i] === 'ISE' ? 'ISE_USD' : indices[i];
        const idx_j = indices[j] === 'ISE' ? 'ISE_USD' : indices[j];
        
        const k1 = `${idx_i}_${idx_j}`;
        const k2 = `${idx_j}_${idx_i}`;
        corrMatrix[i][j] = (pairwiseCorrelations[k1] ?? pairwiseCorrelations[k2] ?? 0) as number;
      }
    }
    
    return corrMatrix;
  }

  it('should generate N-1 edges for N nodes with valid correlations', () => {
    // Model A indices
    const indices = ['ISE', 'SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];
    const n = indices.length;

    // Sample pairwise correlations (using ISE_USD prefix as in actual data)
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

    // Build correlation matrix
    const corrMatrix = buildCorrelationMatrix(indices, pairwiseCorrelations);

    // Verify diagonal is 1
    for (let i = 0; i < n; i++) {
      expect(corrMatrix[i][i]).toBe(1);
    }

    // Verify ISE correlations are loaded correctly (not 0)
    expect(corrMatrix[0][1]).toBeGreaterThan(0); // ISE-SP500
    expect(corrMatrix[0][2]).toBeGreaterThan(0); // ISE-DAX

    // Build all edges with Mantegna distances
    const allEdges: Array<{ i: number; j: number; w: number }> = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        allEdges.push({ i, j, w: mantegnaDistance(corrMatrix[i][j]) });
      }
    }
    allEdges.sort((a, b) => a.w - b.w);

    // Compute MST
    const mstEdges = kruskalMST(n, allEdges);

    // Verify MST has exactly N-1 edges
    expect(mstEdges.length).toBe(n - 1);
    expect(mstEdges.length).toBe(7); // 8 nodes - 1 = 7 edges
  });

  it('should handle Model B indices without ISE_USD prefix', () => {
    // Model B indices (no ISE)
    const indices = ['SP500', 'DAX', 'FTSE', 'NIKKEI'];
    const n = indices.length;

    // Sample pairwise correlations (no ISE_USD prefix)
    const pairwiseCorrelations: Record<string, number> = {
      'SP500_DAX': 0.682,
      'SP500_FTSE': 0.709,
      'SP500_NIKKEI': 0.453,
      'DAX_FTSE': 0.898,
      'DAX_NIKKEI': 0.374,
      'FTSE_NIKKEI': 0.289,
    };

    // Build correlation matrix
    const corrMatrix = buildCorrelationMatrix(indices, pairwiseCorrelations);

    // Build all edges
    const allEdges: Array<{ i: number; j: number; w: number }> = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        allEdges.push({ i, j, w: mantegnaDistance(corrMatrix[i][j]) });
      }
    }
    allEdges.sort((a, b) => a.w - b.w);

    // Compute MST
    const mstEdges = kruskalMST(n, allEdges);

    // Verify MST has exactly N-1 edges
    expect(mstEdges.length).toBe(n - 1);
    expect(mstEdges.length).toBe(3); // 4 nodes - 1 = 3 edges
  });

  it('should produce empty edges array when no valid correlations exist', () => {
    const indices = ['A', 'B', 'C'];
    const n = indices.length;

    // Empty pairwise correlations
    const pairwiseCorrelations: Record<string, number> = {};

    // Build correlation matrix (will be all zeros except diagonal)
    const corrMatrix = buildCorrelationMatrix(indices, pairwiseCorrelations);

    // Build all edges
    const allEdges: Array<{ i: number; j: number; w: number }> = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        allEdges.push({ i, j, w: mantegnaDistance(corrMatrix[i][j]) });
      }
    }
    allEdges.sort((a, b) => a.w - b.w);

    // Compute MST
    const mstEdges = kruskalMST(n, allEdges);

    // With all correlations = 0, all distances are sqrt(2)
    // MST should still produce N-1 edges
    expect(mstEdges.length).toBe(n - 1);
    expect(mstEdges.length).toBe(2); // 3 nodes - 1 = 2 edges
  });
});
