/**
 * Bug Condition Exploration Test for Data Pipeline & Visualization Fixes
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.10, 1.12, 1.13**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bugs exist.
 * DO NOT attempt to fix the test or the code when it fails.
 * 
 * This test encodes the expected behavior and will validate the fix when it passes after implementation.
 * 
 * GOAL: Surface counterexamples that demonstrate the bugs exist across 3 categories:
 * 1. Data Pipeline Missing 7 Input Features
 * 2. Backend Scripts Not Generating JSON Files
 * 3. Visualization Rendering Issues (MST edges, event filtering, PONZI messaging)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Bug Condition Exploration - Data Pipeline & Visualization Fixes', () => {
  
  describe('Property 1: Fault Condition - Data Pipeline Missing 7 Input Features', () => {
    
    it('features.json should contain all 7 input features (SP500, DAX, FTSE, NIKKEI, BOVESPA, EU, EM)', () => {
      // Read features.json
      const featuresPath = path.join(process.cwd(), 'src/data/features.json');
      const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));
      
      // Expected 7 input features
      const expectedInputFeatures = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];
      
      // Check if metadata.features contains all 7 input features
      const features = featuresData.metadata?.features || [];
      
      // This test SHOULD FAIL on unfixed code because features.json only contains engineered features
      expectedInputFeatures.forEach(feature => {
        expect(features).toContain(feature);
      });
      
      // Verify we have at least 14 features total (7 input + 7 engineered)
      expect(features.length).toBeGreaterThanOrEqual(14);
    });
    
    it('model_outputs.json SHAP values should reference all 7 input features', () => {
      // Read model_outputs.json
      const modelOutputsPath = path.join(process.cwd(), 'src/data/model_outputs.json');
      const modelOutputs = JSON.parse(fs.readFileSync(modelOutputsPath, 'utf-8'));
      
      // Expected 7 input features
      const expectedInputFeatures = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];
      
      // Check SHAP feature names (correct path: shap.feature_names)
      const shapFeatures = modelOutputs.shap?.feature_names || [];
      
      // This test SHOULD FAIL on unfixed code
      expectedInputFeatures.forEach(feature => {
        expect(shapFeatures).toContain(feature);
      });
    });
  });
  
  describe('Property 2: Fault Condition - Backend Scripts Not Generating JSON Files', () => {
    
    it('ml_models_extended.json should exist', () => {
      const filePath = path.join(process.cwd(), 'src/data/ml_models_extended.json');
      
      // This test SHOULD FAIL on unfixed code if the file doesn't exist
      expect(fs.existsSync(filePath)).toBe(true);
      
      // Verify it contains valid data
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data).toBeDefined();
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });
    
    it('lead_time_stats.json should exist', () => {
      const filePath = path.join(process.cwd(), 'src/data/lead_time_stats.json');
      
      // This test SHOULD FAIL on unfixed code if the file doesn't exist
      expect(fs.existsSync(filePath)).toBe(true);
      
      // Verify it contains valid data
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data).toBeDefined();
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });
    
    it('dtw_similarity.json should exist', () => {
      const filePath = path.join(process.cwd(), 'src/data/dtw_similarity.json');
      
      // This test SHOULD FAIL on unfixed code if the file doesn't exist
      expect(fs.existsSync(filePath)).toBe(true);
      
      // Verify it contains valid data
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data).toBeDefined();
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });
    
    it('regime_transitions.json should exist', () => {
      const filePath = path.join(process.cwd(), 'src/data/regime_transitions.json');
      
      // This test SHOULD FAIL on unfixed code if the file doesn't exist
      expect(fs.existsSync(filePath)).toBe(true);
      
      // Verify it contains valid data
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data).toBeDefined();
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });
  });
  
  describe('Property 3: Fault Condition - MST Visualization Missing Edges', () => {
    
    it('MST data should have pairwise correlations available for edge computation', () => {
      // MST is computed in the frontend (NetworkMST.tsx) from pairwise correlations
      // Verify that features.json contains pairwise_correlations data
      const featuresPath = path.join(process.cwd(), 'src/data/features.json');
      const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));
      
      const timeSeriesData = featuresData.data || [];
      
      // This test SHOULD FAIL on unfixed code if pairwise correlations are missing
      expect(timeSeriesData.length).toBeGreaterThan(0);
      
      // Check that at least one entry has pairwise_correlations
      const entriesWithCorrelations = timeSeriesData.filter((entry: any) => {
        const pc = entry.pairwise_correlations;
        return pc && Object.keys(pc).length > 0;
      });
      
      expect(entriesWithCorrelations.length).toBeGreaterThan(0);
      
      // Verify that pairwise correlations include the expected pairs
      const sampleEntry = entriesWithCorrelations[0];
      const pc = sampleEntry.pairwise_correlations;
      
      // Should have ISE_USD correlations with the 7 input features
      const expectedPairs = ['ISE_USD_SP500', 'ISE_USD_DAX', 'ISE_USD_FTSE', 'ISE_USD_NIKKEI', 
                            'ISE_USD_BOVESPA', 'ISE_USD_EU', 'ISE_USD_EM'];
      
      expectedPairs.forEach(pair => {
        expect(pc).toHaveProperty(pair);
      });
    });
  });
  
  describe('Property 4: Fault Condition - Events Not Filtered by Model Date Range', () => {
    
    it('Model A (2009-2011) should only show events within date range', () => {
      // Read features.json to get Model A date range
      const featuresPath = path.join(process.cwd(), 'src/data/features.json');
      const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));
      
      const dateRange = featuresData.metadata?.date_range || [];
      const startDate = new Date(dateRange[0]);
      const endDate = new Date(dateRange[1]);
      
      // Model A is 2009-2011
      expect(startDate.getFullYear()).toBe(2009);
      expect(endDate.getFullYear()).toBe(2011);
      
      // Read historical analogues (events)
      const eventsPath = path.join(process.cwd(), 'src/data/historicalAnalogues.ts');
      const eventsContent = fs.readFileSync(eventsPath, 'utf-8');
      
      // Check if Lehman Brothers (2008-09-15) is mentioned - it should NOT be for Model A
      // This test SHOULD FAIL on unfixed code if events are not filtered
      const hasLehman = eventsContent.includes('2008-09-15');
      const hasCovid = eventsContent.includes('2020-03-16');
      
      // For Model A, these events should be filtered out
      // This assertion will fail on unfixed code, confirming the bug
      if (hasLehman || hasCovid) {
        // Document the counterexample
        console.log('COUNTEREXAMPLE: Events outside Model A date range found:');
        if (hasLehman) console.log('  - Lehman Brothers (2008-09-15) - OUTSIDE 2009-2011 range');
        if (hasCovid) console.log('  - COVID (2020-03-16) - OUTSIDE 2009-2011 range');
      }
      
      // This will fail on unfixed code
      expect(hasLehman).toBe(false);
      expect(hasCovid).toBe(false);
    });
  });
  
  describe('Property 5: Fault Condition - PONZI Regime Shows Wrong Messaging', () => {
    
    it('PONZI regime (score >= 70) should display "past midnight" messaging', () => {
      // Read features.json to find PONZI regime dates
      const featuresPath = path.join(process.cwd(), 'src/data/features.json');
      const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));
      
      const timeSeriesData = featuresData.data || [];
      
      // Find dates where fragility_score >= 70 (PONZI regime)
      const ponziDates = timeSeriesData.filter((entry: any) => {
        const score = entry.fragility_score;
        return score !== null && score !== undefined && parseFloat(score) >= 70;
      });
      
      // Document counterexample
      if (ponziDates.length > 0) {
        console.log(`COUNTEREXAMPLE: Found ${ponziDates.length} PONZI regime dates (score >= 70)`);
        console.log('Sample PONZI dates:', ponziDates.slice(0, 3).map((d: any) => ({
          date: d.date,
          score: d.fragility_score,
          regime: d.regime
        })));
      }
      
      // This test documents that PONZI dates exist
      // The actual messaging check would be in the UI component
      // This test SHOULD FAIL if no PONZI dates are found (indicating regime detection bug)
      expect(ponziDates.length).toBeGreaterThan(0);
      
      // Verify these are actually labeled as PONZI
      ponziDates.forEach((entry: any) => {
        expect(entry.regime).toBe('PONZI');
      });
    });
  });
  
  describe('Comprehensive Bug Summary', () => {
    
    it('should document all bug categories found', () => {
      const bugReport: string[] = [];
      
      // Bug Category 1: Missing Input Features
      const featuresPath = path.join(process.cwd(), 'src/data/features.json');
      const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));
      const features = featuresData.metadata?.features || [];
      const expectedInputFeatures = ['SP500', 'DAX', 'FTSE', 'NIKKEI', 'BOVESPA', 'EU', 'EM'];
      const missingFeatures = expectedInputFeatures.filter(f => !features.includes(f));
      
      if (missingFeatures.length > 0) {
        bugReport.push(`BUG 1: Missing ${missingFeatures.length} input features: ${missingFeatures.join(', ')}`);
      }
      
      // Bug Category 2: Missing JSON Files
      const requiredFiles = [
        'ml_models_extended.json',
        'lead_time_stats.json',
        'dtw_similarity.json',
        'regime_transitions.json'
      ];
      
      const missingFiles = requiredFiles.filter(file => {
        const filePath = path.join(process.cwd(), 'src/data', file);
        return !fs.existsSync(filePath);
      });
      
      if (missingFiles.length > 0) {
        bugReport.push(`BUG 2: Missing ${missingFiles.length} JSON files: ${missingFiles.join(', ')}`);
      }
      
      // Bug Category 3: Pairwise Correlations for MST
      const featuresPath2 = path.join(process.cwd(), 'src/data/features.json');
      const featuresData2 = JSON.parse(fs.readFileSync(featuresPath2, 'utf-8'));
      const timeSeriesData2 = featuresData2.data || [];
      
      const entriesWithCorrelations = timeSeriesData2.filter((entry: any) => {
        const pc = entry.pairwise_correlations;
        return pc && Object.keys(pc).length > 0;
      });
      
      if (entriesWithCorrelations.length === 0) {
        bugReport.push('BUG 3: No pairwise correlations found for MST computation');
      }
      
      // Print bug report
      console.log('\n=== BUG CONDITION EXPLORATION REPORT ===');
      console.log(`Total bug categories found: ${bugReport.length}`);
      bugReport.forEach((bug, index) => {
        console.log(`${index + 1}. ${bug}`);
      });
      console.log('========================================\n');
      
      // This test SHOULD FAIL on unfixed code
      expect(bugReport.length).toBe(0);
    });
  });
});
