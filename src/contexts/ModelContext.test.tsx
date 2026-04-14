/**
 * Tests for extended ModelContext functionality
 * 
 * Requirements: 11.6, 5.1, 6.1, 7.1, 8.1, 9.1
 */

import { renderHook, waitFor } from '@testing-library/react';
import { ModelProvider, useModelContext } from './ModelContext';
import React from 'react';

describe('ModelContext - Extended Data Loading', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ModelProvider>{children}</ModelProvider>
  );

  test('loads extended data on mount', async () => {
    const { result } = renderHook(() => useModelContext(), { wrapper });

    // Initially loading
    expect(result.current.isLoadingExtendedData).toBe(true);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoadingExtendedData).toBe(false);
    });

    // Verify all extended data is loaded
    expect(result.current.mlModelsExtended).not.toBeNull();
    expect(result.current.regimeTransitions).not.toBeNull();
    expect(result.current.dtwSimilarity).not.toBeNull();
    expect(result.current.correlationNetworks).not.toBeNull();
    expect(result.current.volatilityClusters).not.toBeNull();
    expect(result.current.leadTimeStats).not.toBeNull();
  });

  test('getModelPerformance returns metrics for valid model', async () => {
    const { result } = renderHook(() => useModelContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingExtendedData).toBe(false);
    });

    const performance = result.current.getModelPerformance('GradientBoosting');
    expect(performance).not.toBeNull();
    expect(performance).toHaveProperty('accuracy');
    expect(performance).toHaveProperty('precision');
    expect(performance).toHaveProperty('recall');
    expect(performance).toHaveProperty('f1_score');
    expect(performance).toHaveProperty('roc_auc');
    expect(performance).toHaveProperty('roc_curve');
  });

  test('getModelPerformance returns null for invalid model', async () => {
    const { result } = renderHook(() => useModelContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingExtendedData).toBe(false);
    });

    const performance = result.current.getModelPerformance('InvalidModel');
    expect(performance).toBeNull();
  });

  test('getRegimeTransitions returns snapshot for valid date', async () => {
    const { result } = renderHook(() => useModelContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingExtendedData).toBe(false);
    });

    const transitions = result.current.getRegimeTransitions('2020-01-01');
    expect(transitions).not.toBeNull();
    expect(transitions).toHaveProperty('date');
    expect(transitions).toHaveProperty('matrix');
    expect(transitions).toHaveProperty('current_regime');
    expect(transitions!.matrix).toHaveLength(3); // 3x3 matrix
  });

  test('getSimilarPeriods returns top N similar periods', async () => {
    const { result } = renderHook(() => useModelContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingExtendedData).toBe(false);
    });

    const similarPeriods = result.current.getSimilarPeriods('2020-01-01', 5);
    expect(similarPeriods).toHaveLength(5);
    
    if (similarPeriods.length > 0) {
      expect(similarPeriods[0]).toHaveProperty('date');
      expect(similarPeriods[0]).toHaveProperty('score');
      expect(similarPeriods[0]).toHaveProperty('features_matched');
    }
  });

  test('getNetworkSnapshot returns snapshot for valid date', async () => {
    const { result } = renderHook(() => useModelContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingExtendedData).toBe(false);
    });

    const snapshot = result.current.getNetworkSnapshot('2020-01-01');
    expect(snapshot).not.toBeNull();
    expect(snapshot).toHaveProperty('date');
    expect(snapshot).toHaveProperty('nodes');
    expect(snapshot).toHaveProperty('edges');
    expect(snapshot).toHaveProperty('metrics');
  });

  test('getVolatilityClusters returns clusters within date range', async () => {
    const { result } = renderHook(() => useModelContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingExtendedData).toBe(false);
    });

    const clusters = result.current.getVolatilityClusters(['2020-01-01', '2023-12-31']);
    expect(Array.isArray(clusters)).toBe(true);
    
    if (clusters.length > 0) {
      expect(clusters[0]).toHaveProperty('id');
      expect(clusters[0]).toHaveProperty('start_date');
      expect(clusters[0]).toHaveProperty('end_date');
      expect(clusters[0]).toHaveProperty('intensity');
      expect(clusters[0]).toHaveProperty('duration_days');
    }
  });

  test('getLeadTimeStats returns summary for valid model', async () => {
    const { result } = renderHook(() => useModelContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingExtendedData).toBe(false);
    });

    const stats = result.current.getLeadTimeStats('RandomForest');
    expect(stats).not.toBeNull();
    expect(stats).toHaveProperty('mean_lead_time');
    expect(stats).toHaveProperty('median_lead_time');
    expect(stats).toHaveProperty('min_lead_time');
    expect(stats).toHaveProperty('max_lead_time');
    expect(stats).toHaveProperty('actionable_percentage');
  });

  test('helper methods return null/empty when data not loaded', () => {
    const { result } = renderHook(() => useModelContext(), { wrapper });

    // Before data loads, helper methods should handle gracefully
    expect(result.current.isLoadingExtendedData).toBe(true);
    
    // These should not throw errors
    expect(() => result.current.getModelPerformance('GradientBoosting')).not.toThrow();
    expect(() => result.current.getRegimeTransitions('2020-01-01')).not.toThrow();
    expect(() => result.current.getSimilarPeriods('2020-01-01')).not.toThrow();
    expect(() => result.current.getNetworkSnapshot('2020-01-01')).not.toThrow();
    expect(() => result.current.getVolatilityClusters(['2020-01-01', '2023-12-31'])).not.toThrow();
    expect(() => result.current.getLeadTimeStats('RandomForest')).not.toThrow();
  });
});
