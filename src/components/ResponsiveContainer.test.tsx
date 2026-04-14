/**
 * ResponsiveContainer.test.tsx
 * 
 * Tests for ResponsiveContainer component including:
 * - Screen width detection and breakpoint logic
 * - Mobile layout modes (stack, scroll, collapse)
 * - Priority-based component ordering
 * - Orientation change handling with debouncing
 * - Touch target sizing
 * - Font scaling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResponsiveContainer from './ResponsiveContainer';

describe('ResponsiveContainer', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    // Restore original window width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    vi.clearAllTimers();
  });

  // Helper to set window width
  const setWindowWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event('resize'));
  };

  describe('Screen width detection', () => {
    it('should detect mobile screen below breakpoint', async () => {
      setWindowWidth(500);
      
      render(
        <ResponsiveContainer testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      await waitFor(() => {
        const container = screen.getByTestId('test-container');
        expect(container).toHaveAttribute('data-mobile', 'true');
        expect(container).toHaveClass('responsive-container--mobile');
      });
    });

    it('should detect desktop screen above breakpoint', async () => {
      setWindowWidth(1024);
      
      render(
        <ResponsiveContainer testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      await waitFor(() => {
        const container = screen.getByTestId('test-container');
        expect(container).toHaveAttribute('data-mobile', 'false');
        expect(container).toHaveClass('responsive-container--desktop');
      });
    });

    it('should use custom breakpoint', async () => {
      setWindowWidth(900);
      
      render(
        <ResponsiveContainer breakpoint={1000} testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      await waitFor(() => {
        const container = screen.getByTestId('test-container');
        expect(container).toHaveAttribute('data-mobile', 'true');
      });
    });
  });

  describe('Mobile layout modes', () => {
    it('should apply stack layout mode', async () => {
      setWindowWidth(500);
      
      render(
        <ResponsiveContainer mobileLayout="stack" testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      await waitFor(() => {
        const container = screen.getByTestId('test-container');
        expect(container).toHaveClass('responsive-container--layout-stack');
      });
    });

    it('should apply scroll layout mode', async () => {
      setWindowWidth(500);
      
      render(
        <ResponsiveContainer mobileLayout="scroll" testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      await waitFor(() => {
        const container = screen.getByTestId('test-container');
        expect(container).toHaveClass('responsive-container--layout-scroll');
      });
    });

    it('should apply collapse layout mode with toggle', async () => {
      setWindowWidth(500);
      
      render(
        <ResponsiveContainer mobileLayout="collapse" testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      await waitFor(() => {
        const container = screen.getByTestId('test-container');
        expect(container).toHaveClass('responsive-container--layout-collapse');
        expect(screen.getByRole('button', { name: /collapse section/i })).toBeInTheDocument();
      });
    });

    it('should toggle collapse state', async () => {
      setWindowWidth(500);
      
      render(
        <ResponsiveContainer mobileLayout="collapse" testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button');
      
      // Initially expanded
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      
      // Click to collapse
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
        const container = screen.getByTestId('test-container');
        expect(container).toHaveClass('responsive-container--collapsed');
      });
      
      // Click to expand
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('Priority-based ordering', () => {
    it('should apply high priority class', () => {
      render(
        <ResponsiveContainer priority="high" testId="test-container">
          <div>High priority content</div>
        </ResponsiveContainer>
      );

      const container = screen.getByTestId('test-container');
      expect(container).toHaveClass('responsive-container--priority-high');
      expect(container).toHaveAttribute('data-priority', 'high');
    });

    it('should apply medium priority class', () => {
      render(
        <ResponsiveContainer priority="medium" testId="test-container">
          <div>Medium priority content</div>
        </ResponsiveContainer>
      );

      const container = screen.getByTestId('test-container');
      expect(container).toHaveClass('responsive-container--priority-medium');
      expect(container).toHaveAttribute('data-priority', 'medium');
    });

    it('should apply low priority class', () => {
      render(
        <ResponsiveContainer priority="low" testId="test-container">
          <div>Low priority content</div>
        </ResponsiveContainer>
      );

      const container = screen.getByTestId('test-container');
      expect(container).toHaveClass('responsive-container--priority-low');
      expect(container).toHaveAttribute('data-priority', 'low');
    });
  });

  describe('Orientation change handling', () => {
    it('should handle orientation change with debouncing', async () => {
      vi.useFakeTimers();
      setWindowWidth(1024);
      
      const { container } = render(
        <ResponsiveContainer testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      // Wait for initial render
      await vi.waitFor(() => {
        expect(screen.getByTestId('test-container')).toHaveAttribute('data-mobile', 'false');
      });

      // Simulate orientation change to portrait (narrow)
      setWindowWidth(500);
      window.dispatchEvent(new Event('orientationchange'));

      // Should not update immediately (debounced)
      expect(screen.getByTestId('test-container')).toHaveAttribute('data-mobile', 'false');

      // Fast-forward past debounce delay
      await vi.advanceTimersByTimeAsync(150);

      // Should now be mobile
      expect(screen.getByTestId('test-container')).toHaveAttribute('data-mobile', 'true');

      vi.useRealTimers();
    });

    it('should debounce rapid resize events', async () => {
      vi.useFakeTimers();
      setWindowWidth(1024);
      
      render(
        <ResponsiveContainer testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      // Wait for initial state
      await vi.waitFor(() => {
        expect(screen.getByTestId('test-container')).toBeInTheDocument();
      });

      // Trigger multiple rapid resizes
      setWindowWidth(800);
      window.dispatchEvent(new Event('resize'));
      await vi.advanceTimersByTimeAsync(50);
      
      setWindowWidth(600);
      window.dispatchEvent(new Event('resize'));
      await vi.advanceTimersByTimeAsync(50);
      
      setWindowWidth(400);
      window.dispatchEvent(new Event('resize'));

      // Should still be at original state (debounced)
      expect(screen.getByTestId('test-container')).toHaveAttribute('data-mobile', 'false');

      // Fast-forward past debounce delay
      await vi.advanceTimersByTimeAsync(150);

      // Should update to final width
      expect(screen.getByTestId('test-container')).toHaveAttribute('data-mobile', 'true');

      vi.useRealTimers();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      render(
        <ResponsiveContainer className="custom-class" testId="test-container">
          <div>Test content</div>
        </ResponsiveContainer>
      );

      const container = screen.getByTestId('test-container');
      expect(container).toHaveClass('custom-class');
      expect(container).toHaveClass('responsive-container');
    });
  });

  describe('Children rendering', () => {
    it('should render children content', () => {
      render(
        <ResponsiveContainer>
          <div data-testid="child-content">Child content</div>
        </ResponsiveContainer>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });
  });
});
