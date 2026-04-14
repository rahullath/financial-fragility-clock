/// <reference types="vitest/globals" />
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { TutorialProvider, useTutorialContext } from './TutorialContext';

/**
 * Test suite for TutorialContext
 * 
 * Requirements: 3.1, 3.6
 */

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('TutorialContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Provider initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(0);
      expect(result.current.totalSteps).toBe(8);
      expect(result.current.isCompleted).toBe(false);
    });

    it('should accept custom totalSteps', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TutorialProvider totalSteps={10}>{children}</TutorialProvider>
      );

      const { result } = renderHook(() => useTutorialContext(), { wrapper });

      expect(result.current.totalSteps).toBe(10);
    });

    it('should load completion state from localStorage', () => {
      localStorageMock.setItem(
        'tutorial_state',
        JSON.stringify({ isCompleted: true })
      );

      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      expect(result.current.isCompleted).toBe(true);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.setItem('tutorial_state', 'invalid json');

      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      expect(result.current.isCompleted).toBe(false);
    });
  });

  describe('startTutorial', () => {
    it('should activate tutorial and reset to step 0', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe(0);
    });
  });

  describe('nextStep', () => {
    it('should advance to the next step', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('should not advance beyond totalSteps', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TutorialProvider totalSteps={3}>{children}</TutorialProvider>
      );

      const { result } = renderHook(() => useTutorialContext(), { wrapper });

      act(() => {
        result.current.startTutorial();
      });

      // Advance to step 2 (last step)
      act(() => {
        result.current.nextStep();
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(2);

      // Try to advance beyond
      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(2);
    });
  });

  describe('previousStep', () => {
    it('should go back to the previous step', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
        result.current.nextStep();
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(2);

      act(() => {
        result.current.previousStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('should not go below step 0', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
      });

      expect(result.current.currentStep).toBe(0);

      act(() => {
        result.current.previousStep();
      });

      expect(result.current.currentStep).toBe(0);
    });
  });

  describe('goToStep', () => {
    it('should jump to a specific step', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
      });

      act(() => {
        result.current.goToStep(5);
      });

      expect(result.current.currentStep).toBe(5);
    });

    it('should not allow jumping to invalid steps', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TutorialProvider totalSteps={5}>{children}</TutorialProvider>
      );

      const { result } = renderHook(() => useTutorialContext(), { wrapper });

      act(() => {
        result.current.startTutorial();
      });

      // Try to jump to step 10 (out of range)
      act(() => {
        result.current.goToStep(10);
      });

      expect(result.current.currentStep).toBe(0);

      // Try to jump to negative step
      act(() => {
        result.current.goToStep(-1);
      });

      expect(result.current.currentStep).toBe(0);
    });
  });

  describe('closeTutorial', () => {
    it('should deactivate tutorial and reset step', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
        result.current.nextStep();
        result.current.nextStep();
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe(2);

      act(() => {
        result.current.closeTutorial();
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(0);
    });

    it('should not mark tutorial as completed', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
        result.current.closeTutorial();
      });

      expect(result.current.isCompleted).toBe(false);
    });
  });

  describe('completeTutorial', () => {
    it('should mark tutorial as completed and deactivate', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
        result.current.completeTutorial();
      });

      expect(result.current.isCompleted).toBe(true);
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(0);
    });

    it('should persist completion state to localStorage', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
        result.current.completeTutorial();
      });

      const stored = localStorageMock.getItem('tutorial_state');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.isCompleted).toBe(true);
    });
  });

  describe('resetTutorial', () => {
    it('should reset completion state', () => {
      const { result } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
        result.current.completeTutorial();
      });

      expect(result.current.isCompleted).toBe(true);

      act(() => {
        result.current.resetTutorial();
      });

      expect(result.current.isCompleted).toBe(false);
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(0);
    });
  });

  describe('localStorage persistence', () => {
    it('should persist completion state across provider remounts', () => {
      const { result, unmount } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.completeTutorial();
      });

      unmount();

      // Remount the provider
      const { result: result2 } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      expect(result2.current.isCompleted).toBe(true);
    });

    it('should not persist active state or current step', () => {
      const { result, unmount } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      act(() => {
        result.current.startTutorial();
        result.current.nextStep();
        result.current.nextStep();
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe(2);

      unmount();

      // Remount the provider
      const { result: result2 } = renderHook(() => useTutorialContext(), {
        wrapper: TutorialProvider,
      });

      // Active state and step should be reset
      expect(result2.current.isActive).toBe(false);
      expect(result2.current.currentStep).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      expect(() => {
        renderHook(() => useTutorialContext());
      }).toThrow('useTutorialContext must be used within a TutorialProvider');

      console.error = originalError;
    });
  });
});
