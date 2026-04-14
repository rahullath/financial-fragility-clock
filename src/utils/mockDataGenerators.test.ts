/**
 * Unit tests for mock data generators
 * 
 * Validates that mock data generators produce correctly structured data
 * matching the TypeScript interfaces.
 */

import { describe, it, expect } from 'vitest';
import {
  generateMockMLModelsExtended,
  generateMockRegimeTransitions,
  generateMockDTWSimilarity,
  generateMockCorrelationNetworks,
  generateMockVolatilityClustering,
  generateMockLeadTimeStats,
} from './mockDataGenerators';

describe('Mock Data Generators', () => {
  describe('generateMockMLModelsExtended', () => {
    it('should generate valid ML models extended data structure', () => {
      const data = generateMockMLModelsExtended('2020-01-01', '2020-12-31');
      
      expect(data.metadata).toBeDefined();
      expect(data.metadata.models).toHaveLength(5);
      expect(data.metadata.models).toContain('GradientBoosting');
      expect(data.metadata.models).toContain('LSTM');
      expect(data.metadata.models).toContain('SVR');
      expect(data.metadata.models).toContain('ElasticNet');
      expect(data.metadata.models).toContain('Ensemble');
      
      expect(data.predictions).toBeDefined();
      expect(data.performance).toBeDefined();
      
      // Check each model has predictions and performance
      data.metadata.models.forEach((modelId) => {
        expect(data.predictions[modelId]).toBeDefined();
        expect(Array.isArray(data.predictions[modelId])).toBe(true);
        expect(data.predictions[modelId].length).toBeGreaterThan(0);
        
        expect(data.performance[modelId]).toBeDefined();
        expect(data.performance[modelId].accuracy).toBeGreaterThan(0);
        expect(data.performance[modelId].accuracy).toBeLessThanOrEqual(1);
      });
    });
    
    it('should generate predictions with valid structure', () => {
      const data = generateMockMLModelsExtended('2020-01-01', '2020-01-31');
      const firstModel = data.metadata.models[0];
      const predictions = data.predictions[firstModel];
      
      expect(predictions.length).toBeGreaterThan(0);
      
      predictions.forEach((pred) => {
        expect(pred.date).toBeDefined();
        expect(typeof pred.date).toBe('string');
        expect(pred.fragility_score).toBeGreaterThanOrEqual(0);
        expect(pred.fragility_score).toBeLessThanOrEqual(100);
        expect(['normal', 'stressed', 'crisis']).toContain(pred.regime);
        expect(pred.confidence).toBeGreaterThan(0);
        expect(pred.confidence).toBeLessThanOrEqual(1);
      });
    });
    
    it('should generate performance metrics with ROC curve', () => {
      const data = generateMockMLModelsExtended('2020-01-01', '2020-01-31');
      const firstModel = data.metadata.models[0];
      const performance = data.performance[firstModel];
      
      expect(performance.roc_curve).toBeDefined();
      expect(Array.isArray(performance.roc_curve)).toBe(true);
      expect(performance.roc_curve.length).toBeGreaterThan(0);
      
      performance.roc_curve.forEach((point) => {
        expect(point.fpr).toBeGreaterThanOrEqual(0);
        expect(point.fpr).toBeLessThanOrEqual(1);
        expect(point.tpr).toBeGreaterThanOrEqual(0);
        expect(point.tpr).toBeLessThanOrEqual(1);
      });
    });
  });
  
  describe('generateMockRegimeTransitions', () => {
    it('should generate valid regime transition data', () => {
      const data = generateMockRegimeTransitions('2020-01-01', '2020-12-31');
      
      expect(data.metadata.regimes).toEqual(['normal', 'stressed', 'crisis']);
      expect(data.transitions).toBeDefined();
      expect(Array.isArray(data.transitions)).toBe(true);
      expect(data.transitions.length).toBeGreaterThan(0);
    });
    
    it('should generate valid transition matrices', () => {
      const data = generateMockRegimeTransitions('2020-01-01', '2020-03-31');
      
      data.transitions.forEach((snapshot) => {
        expect(snapshot.date).toBeDefined();
        expect(snapshot.matrix).toBeDefined();
        expect(snapshot.matrix.length).toBe(3); // 3x3 matrix
        
        snapshot.matrix.forEach((row) => {
          expect(row.length).toBe(3);
          const rowSum = row.reduce((sum, val) => sum + val, 0);
          expect(rowSum).toBeCloseTo(1.0, 1); // Probabilities sum to 1
        });
        
        expect(['normal', 'stressed', 'crisis']).toContain(snapshot.current_regime);
      });
    });
  });
  
  describe('generateMockDTWSimilarity', () => {
    it('should generate valid DTW similarity data', () => {
      const data = generateMockDTWSimilarity('2020-01-01', '2020-06-30');
      
      expect(data.metadata.window_size).toBeGreaterThan(0);
      expect(data.metadata.feature_set).toBeDefined();
      expect(Array.isArray(data.metadata.feature_set)).toBe(true);
      
      expect(data.similarities).toBeDefined();
      expect(Array.isArray(data.similarities)).toBe(true);
      expect(data.similarities.length).toBeGreaterThan(0);
    });
    
    it('should generate similar periods with valid scores', () => {
      const data = generateMockDTWSimilarity('2020-01-01', '2020-03-31');
      
      data.similarities.forEach((snapshot) => {
        expect(snapshot.reference_date).toBeDefined();
        expect(snapshot.similar_periods).toBeDefined();
        expect(Array.isArray(snapshot.similar_periods)).toBe(true);
        
        snapshot.similar_periods.forEach((period) => {
          expect(period.date).toBeDefined();
          expect(period.score).toBeGreaterThanOrEqual(0);
          expect(period.score).toBeLessThanOrEqual(1);
          expect(Array.isArray(period.features_matched)).toBe(true);
        });
      });
    });
  });
  
  describe('generateMockCorrelationNetworks', () => {
    it('should generate valid correlation network data', () => {
      const data = generateMockCorrelationNetworks('2020-01-01', '2020-06-30');
      
      expect(data.metadata.indices).toBeDefined();
      expect(Array.isArray(data.metadata.indices)).toBe(true);
      expect(data.metadata.threshold).toBeGreaterThan(0);
      
      expect(data.snapshots).toBeDefined();
      expect(Array.isArray(data.snapshots)).toBe(true);
      expect(data.snapshots.length).toBeGreaterThan(0);
    });
    
    it('should generate network snapshots with nodes and edges', () => {
      const data = generateMockCorrelationNetworks('2020-01-01', '2020-03-31');
      
      data.snapshots.forEach((snapshot) => {
        expect(snapshot.date).toBeDefined();
        expect(snapshot.nodes).toBeDefined();
        expect(Array.isArray(snapshot.nodes)).toBe(true);
        expect(snapshot.nodes.length).toBeGreaterThan(0);
        
        expect(snapshot.edges).toBeDefined();
        expect(Array.isArray(snapshot.edges)).toBe(true);
        
        expect(snapshot.metrics).toBeDefined();
        expect(snapshot.metrics.density).toBeGreaterThanOrEqual(0);
        expect(snapshot.metrics.density).toBeLessThanOrEqual(1);
        expect(snapshot.metrics.clustering_coefficient).toBeGreaterThanOrEqual(0);
        expect(snapshot.metrics.avg_degree).toBeGreaterThanOrEqual(0);
      });
    });
  });
  
  describe('generateMockVolatilityClustering', () => {
    it('should generate valid volatility clustering data', () => {
      const data = generateMockVolatilityClustering('2020-01-01', '2020-12-31');
      
      expect(data.metadata.clustering_algorithm).toBeDefined();
      expect(data.metadata.min_cluster_duration).toBeGreaterThan(0);
      
      expect(data.time_series).toBeDefined();
      expect(Array.isArray(data.time_series)).toBe(true);
      expect(data.time_series.length).toBeGreaterThan(0);
      
      expect(data.clusters).toBeDefined();
      expect(Array.isArray(data.clusters)).toBe(true);
    });
    
    it('should generate volatility time series with valid values', () => {
      const data = generateMockVolatilityClustering('2020-01-01', '2020-03-31');
      
      data.time_series.forEach((point) => {
        expect(point.date).toBeDefined();
        expect(point.volatility).toBeGreaterThan(0);
        expect(point.volatility).toBeLessThan(1);
      });
    });
    
    it('should generate clusters with valid structure', () => {
      const data = generateMockVolatilityClustering('2020-01-01', '2020-12-31');
      
      data.clusters.forEach((cluster) => {
        expect(cluster.id).toBeGreaterThanOrEqual(0);
        expect(cluster.start_date).toBeDefined();
        expect(cluster.end_date).toBeDefined();
        expect(cluster.intensity).toBeGreaterThan(0);
        expect(cluster.duration_days).toBeGreaterThanOrEqual(data.metadata.min_cluster_duration);
      });
    });
  });
  
  describe('generateMockLeadTimeStats', () => {
    it('should generate valid lead time statistics data', () => {
      const data = generateMockLeadTimeStats();
      
      expect(data.metadata.crisis_threshold).toBeGreaterThan(0);
      expect(data.metadata.actionable_lead_time).toBeGreaterThan(0);
      
      expect(data.predictions).toBeDefined();
      expect(Array.isArray(data.predictions)).toBe(true);
      expect(data.predictions.length).toBeGreaterThan(0);
      
      expect(data.summary).toBeDefined();
    });
    
    it('should generate predictions with valid lead times', () => {
      const data = generateMockLeadTimeStats();
      
      data.predictions.forEach((pred) => {
        expect(pred.crisis_date).toBeDefined();
        expect(pred.prediction_date).toBeDefined();
        expect(pred.lead_time_days).toBeGreaterThan(0);
        expect(pred.model_id).toBeDefined();
        expect(typeof pred.was_actionable).toBe('boolean');
        
        // Verify lead time calculation
        const crisisDate = new Date(pred.crisis_date);
        const predictionDate = new Date(pred.prediction_date);
        expect(crisisDate.getTime()).toBeGreaterThan(predictionDate.getTime());
      });
    });
    
    it('should generate summary statistics for each model', () => {
      const data = generateMockLeadTimeStats();
      
      Object.keys(data.summary).forEach((modelId) => {
        const summary = data.summary[modelId];
        
        expect(summary.mean_lead_time).toBeGreaterThan(0);
        expect(summary.median_lead_time).toBeGreaterThan(0);
        expect(summary.min_lead_time).toBeGreaterThan(0);
        expect(summary.max_lead_time).toBeGreaterThan(0);
        expect(summary.actionable_percentage).toBeGreaterThanOrEqual(0);
        expect(summary.actionable_percentage).toBeLessThanOrEqual(100);
        
        // Verify min <= median <= mean <= max (approximately)
        expect(summary.min_lead_time).toBeLessThanOrEqual(summary.median_lead_time);
        expect(summary.max_lead_time).toBeGreaterThanOrEqual(summary.median_lead_time);
      });
    });
  });
});
