/**
 * Data Pipeline Preservation Property Tests
 * 
 * These tests validate that the data pipeline behavior remains unchanged
 * after implementing the live data fetch fix (Bug 3).
 * 
 * IMPORTANT: These tests are run on UNFIXED code to establish baseline behavior.
 * They should PASS on unfixed code and continue to PASS after the fix is applied.
 * 
 * Property 2: Preservation - Data Pipeline Unchanged Behaviors
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Data Pipeline Preservation Tests', () => {
  describe('Property 2.1: Feature Computation Parameters (Req 9.1)', () => {
    it('should preserve CORR_WINDOW=60 parameter in fetch_live.py', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify CORR_WINDOW parameter
      expect(content).toContain('CORR_WINDOW = 60');
    });

    it('should preserve VOL_WINDOW=20 parameter in fetch_live.py', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify VOL_WINDOW parameter
      expect(content).toContain('VOL_WINDOW  = 20');
    });

    it('should preserve PE_ORDER=3 parameter in fetch_live.py', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify PE_ORDER parameter
      expect(content).toContain('PE_ORDER    = 3');
    });

    it('should preserve PE_WINDOW=21 parameter in fetch_live.py', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify PE_WINDOW parameter
      expect(content).toContain('PE_WINDOW   = 21');
    });

    it('should preserve fragility score weights in fetch_live.py', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify weight values
      expect(content).toContain('"mean_corr":           0.40');
      expect(content).toContain('"rolling_volatility":  0.35');
      expect(content).toContain('"permutation_entropy": 0.25');
    });
  });

  describe('Property 2.2: Regime Assignment Thresholds (Req 9.2)', () => {
    it('should preserve HEDGE regime threshold (0-40) in fetch_live.py', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify HEDGE threshold
      expect(content).toContain('"HEDGE":       (0,   40)');
    });

    it('should preserve SPECULATIVE regime threshold (40-70) in fetch_live.py', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify SPECULATIVE threshold
      expect(content).toContain('"SPECULATIVE": (40,  70)');
    });

    it('should preserve PONZI regime threshold (70-100) in fetch_live.py', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify PONZI threshold
      expect(content).toContain('"PONZI":       (70, 100)');
    });

    it('should preserve regime assignment logic in fetch_live.py', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify regime assignment logic
      expect(content).toContain('if raw_frag < 40:');
      expect(content).toContain('regime = "HEDGE"');
      expect(content).toContain('elif raw_frag < 70:');
      expect(content).toContain('regime = "SPECULATIVE"');
      expect(content).toContain('else:');
      expect(content).toContain('regime = "PONZI"');
    });
  });

  describe('Property 2.3: JSON Schema Structure (Req 9.3)', () => {
    it('should preserve JSON append logic that skips existing dates', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify skip logic for existing dates
      expect(content).toContain('existing_dates = {r["date"] for r in raw["data"]}');
      expect(content).toContain('if date_str in existing_dates:');
      expect(content).toContain('continue');
    });

    it('should preserve JSON schema field structure', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify schema fields are preserved
      expect(content).toContain('entry.setdefault("crash_probability", None)');
      expect(content).toContain('entry.setdefault("crisis_similarity_composite", None)');
    });

    it('should preserve JSON data sorting by date', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify sorting logic
      expect(content).toContain('raw["data"].sort(key=lambda r: r["date"])');
    });

    it('should preserve metadata update logic', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify metadata updates
      expect(content).toContain('raw.setdefault("metadata", {})["last_updated"]');
      expect(content).toContain('raw["metadata"]["live_data_through"]');
      expect(content).toContain('raw["metadata"]["live_source"]');
    });
  });

  describe('Property 2.4: Phase 2 Methodology (Req 9.4)', () => {
    it('should preserve DTW features list in compute_phase2.py', () => {
      const phase2Path = path.join(process.cwd(), 'python', 'compute_phase2.py');
      const content = fs.readFileSync(phase2Path, 'utf-8');
      
      // Verify DTW features
      expect(content).toContain('DTW_FEATURES = ["mean_corr", "rolling_volatility", "permutation_entropy"]');
    });

    it('should preserve crash horizon and threshold parameters', () => {
      const phase2Path = path.join(process.cwd(), 'python', 'compute_phase2.py');
      const content = fs.readFileSync(phase2Path, 'utf-8');
      
      // Verify parameters
      expect(content).toContain('HORIZON = 30');
      expect(content).toContain('THRESHOLD = 0.07');
    });

    it('should preserve DTW distance calculation methodology', () => {
      const phase2Path = path.join(process.cwd(), 'python', 'compute_phase2.py');
      const content = fs.readFileSync(phase2Path, 'utf-8');
      
      // Verify DTW implementation exists
      expect(content).toContain('def dtw_distance(s1: np.ndarray, s2: np.ndarray) -> float:');
      expect(content).toContain('dtw = np.full((n + 1, m + 1), np.inf)');
    });

    it('should preserve multivariate DTW with z-score normalization', () => {
      const phase2Path = path.join(process.cwd(), 'python', 'compute_phase2.py');
      const content = fs.readFileSync(phase2Path, 'utf-8');
      
      // Verify z-score normalization
      expect(content).toContain('def multivariate_dtw_distance');
      expect(content).toContain('s1 = (s1 - s1.mean()) / (std1 if std1 > 0 else 1)');
      expect(content).toContain('s2 = (s2 - s2.mean()) / (std2 if std2 > 0 else 1)');
    });

    it('should preserve regime transition probability methodology', () => {
      const phase2Path = path.join(process.cwd(), 'python', 'compute_phase2.py');
      const content = fs.readFileSync(phase2Path, 'utf-8');
      
      // Verify regime transition classifier
      expect(content).toContain('def compute_regime_transition_probability');
      expect(content).toContain('RandomForestClassifier');
      expect(content).toContain('CalibratedClassifierCV');
    });
  });

  describe('Property 2.5: Application Data Loading (Req 9.5)', () => {
    it('should preserve ModelContext data loading from model_b_features_slim.json', () => {
      const modelContextPath = path.join(process.cwd(), 'src', 'contexts', 'ModelContext.tsx');
      const content = fs.readFileSync(modelContextPath, 'utf-8');
      
      // Verify import path
      expect(content).toContain("import modelBFeatures from '../data/model_b_features_slim.json'");
    });

    it('should preserve ModelContext data structure', () => {
      const modelContextPath = path.join(process.cwd(), 'src', 'contexts', 'ModelContext.tsx');
      const content = fs.readFileSync(modelContextPath, 'utf-8');
      
      // Verify data structure
      expect(content).toContain('featuresData: modelBFeatures as CurrentModelData');
    });

    it('should preserve DataRow interface fields', () => {
      const modelContextPath = path.join(process.cwd(), 'src', 'contexts', 'ModelContext.tsx');
      const content = fs.readFileSync(modelContextPath, 'utf-8');
      
      // Verify interface fields
      expect(content).toContain('export interface DataRow');
      expect(content).toContain('date: string');
      expect(content).toContain('fragility_score?: number | null');
      expect(content).toContain('regime?: string | null');
    });
  });

  describe('Property 2.6: Historical Data Integrity (Req 9.6)', () => {
    it('should preserve historical data in model_b_features_slim.json', () => {
      const dataPath = path.join(process.cwd(), 'src', 'data', 'model_b_features_slim.json');
      const content = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(content);
      
      // Verify data structure
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('metadata');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should preserve pre-2026 data entries', () => {
      const dataPath = path.join(process.cwd(), 'src', 'data', 'model_b_features_slim.json');
      const content = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(content);
      
      // Find pre-2026 entries
      const pre2026Entries = data.data.filter((row: any) => {
        const year = new Date(row.date).getFullYear();
        return year < 2026;
      });
      
      // Verify pre-2026 data exists
      expect(pre2026Entries.length).toBeGreaterThan(0);
    });

    it('should preserve feature fields in historical data', () => {
      const dataPath = path.join(process.cwd(), 'src', 'data', 'model_b_features_slim.json');
      const content = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(content);
      
      // Check first entry has required fields
      const firstEntry = data.data[0];
      expect(firstEntry).toHaveProperty('date');
      expect(firstEntry).toHaveProperty('fragility_score');
      expect(firstEntry).toHaveProperty('regime');
      expect(firstEntry).toHaveProperty('mean_corr');
      expect(firstEntry).toHaveProperty('rolling_volatility');
      expect(firstEntry).toHaveProperty('permutation_entropy');
    });

    it('should preserve pairwise_correlations structure in historical data', () => {
      const dataPath = path.join(process.cwd(), 'src', 'data', 'model_b_features_slim.json');
      const content = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(content);
      
      // Find entry with pairwise correlations
      const entryWithCorr = data.data.find((row: any) => row.pairwise_correlations);
      
      // Verify structure
      expect(entryWithCorr).toBeDefined();
      expect(typeof entryWithCorr.pairwise_correlations).toBe('object');
    });
  });

  describe('Property 2.7: Cross-validation - Parameters Consistency', () => {
    it('should ensure feature computation parameters are consistent across pipeline', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify all parameters are defined together
      const hasAllParams = 
        content.includes('CORR_WINDOW = 60') &&
        content.includes('VOL_WINDOW  = 20') &&
        content.includes('PE_ORDER    = 3') &&
        content.includes('PE_WINDOW   = 21');
      
      expect(hasAllParams).toBe(true);
    });

    it('should ensure regime thresholds are consistent across pipeline', () => {
      const fetchLivePath = path.join(process.cwd(), 'python', 'fetch_live.py');
      const content = fs.readFileSync(fetchLivePath, 'utf-8');
      
      // Verify all thresholds are defined together
      const hasAllThresholds = 
        content.includes('"HEDGE":       (0,   40)') &&
        content.includes('"SPECULATIVE": (40,  70)') &&
        content.includes('"PONZI":       (70, 100)');
      
      expect(hasAllThresholds).toBe(true);
    });
  });
});
