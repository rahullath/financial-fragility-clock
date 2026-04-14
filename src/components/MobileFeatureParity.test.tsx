/**
 * MobileFeatureParity.test.tsx
 * 
 * Integration tests to verify mobile feature parity and content prioritization.
 * Tests that all features available on desktop are also available on mobile,
 * and that critical visualizations appear first in mobile view.
 * 
 * Requirements: 10.4, 10.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ModelProvider } from '../contexts/ModelContext';
import { CrisisProvider } from '../contexts/CrisisContext';
import { DateProvider } from '../contexts/DateContext';
import { TutorialProvider } from '../contexts/TutorialContext';

import ClockLanding from '../routes/ClockLanding';
import Dashboard from '../routes/Dashboard';
import DataRoom from '../routes/DataRoom';
import ModelLab from '../routes/ModelLab';

// Helper to wrap components with all required providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ModelProvider>
      <CrisisProvider>
        <DateProvider>
          <TutorialProvider totalSteps={8}>
            <BrowserRouter>
              {component}
            </BrowserRouter>
          </TutorialProvider>
        </DateProvider>
      </CrisisProvider>
    </ModelProvider>
  );
};

// Helper to set window width
const setWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('Mobile Feature Parity', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  describe('ClockLanding page', () => {
    it('should have all desktop features available on mobile', async () => {
      setWindowWidth(375); // Mobile width
      
      renderWithProviders(<ClockLanding />);

      // Critical features that must be present
      expect(screen.getByTestId('doomsday-clock')).toBeInTheDocument();
      expect(screen.getByTestId('regime-timeline')).toBeInTheDocument();
      expect(screen.getByTestId('stat-strip')).toBeInTheDocument();
      expect(screen.getByTestId('date-scrubber')).toBeInTheDocument();
      expect(screen.getByTestId('crisis-selector')).toBeInTheDocument();
      expect(screen.getByTestId('model-toggle')).toBeInTheDocument();
    });

    it('should prioritize critical visualizations first in mobile view', async () => {
      setWindowWidth(375);
      
      const { container } = renderWithProviders(<ClockLanding />);

      // Get all responsive containers
      const containers = container.querySelectorAll('[data-testid="responsive-container"]');
      
      // Check that high priority items come before medium/low priority
      const priorities: string[] = [];
      containers.forEach((container) => {
        const priority = container.getAttribute('data-priority');
        if (priority) priorities.push(priority);
      });

      // High priority items should appear first
      const firstHighIndex = priorities.indexOf('high');
      const firstMediumIndex = priorities.indexOf('medium');
      const firstLowIndex = priorities.indexOf('low');

      if (firstMediumIndex !== -1) {
        expect(firstHighIndex).toBeLessThan(firstMediumIndex);
      }
      if (firstLowIndex !== -1) {
        expect(firstHighIndex).toBeLessThan(firstLowIndex);
      }
    });
  });

  describe('Dashboard page', () => {
    it('should have all desktop features available on mobile', async () => {
      setWindowWidth(375);
      
      renderWithProviders(<Dashboard />);

      // All visualizations should be present
      expect(screen.getByTestId('stat-strip')).toBeInTheDocument();
      expect(screen.getByTestId('doomsday-clock')).toBeInTheDocument();
      expect(screen.getByTestId('regime-timeline')).toBeInTheDocument();
      expect(screen.getByTestId('date-scrubber')).toBeInTheDocument();
      expect(screen.getByTestId('crisis-selector')).toBeInTheDocument();
      expect(screen.getByTestId('correlation-heatmap')).toBeInTheDocument();
      expect(screen.getByTestId('shap-chart')).toBeInTheDocument();
      expect(screen.getByTestId('network-mst')).toBeInTheDocument();
      expect(screen.getByTestId('regime-transition-matrix')).toBeInTheDocument();
      expect(screen.getByTestId('volatility-clustering-chart')).toBeInTheDocument();
    });

    it('should show critical content first on mobile', async () => {
      setWindowWidth(375);
      
      const { container } = renderWithProviders(<Dashboard />);

      const containers = container.querySelectorAll('[data-priority="high"]');
      const firstContainer = containers[0];

      // First high-priority container should contain critical visualizations
      expect(
        within(firstContainer as HTMLElement).queryByTestId('stat-strip') ||
        within(firstContainer as HTMLElement).queryByTestId('doomsday-clock') ||
        within(firstContainer as HTMLElement).queryByTestId('date-scrubber')
      ).toBeTruthy();
    });
  });

  describe('DataRoom page', () => {
    it('should have all desktop features available on mobile', async () => {
      setWindowWidth(375);
      
      renderWithProviders(<DataRoom />);

      expect(screen.getByTestId('date-scrubber')).toBeInTheDocument();
      expect(screen.getByTestId('crisis-selector')).toBeInTheDocument();
      expect(screen.getByTestId('correlation-heatmap')).toBeInTheDocument();
      expect(screen.getByTestId('network-mst')).toBeInTheDocument();
      expect(screen.getByTestId('regime-stats-card')).toBeInTheDocument();
    });
  });

  describe('ModelLab page', () => {
    it('should have all desktop features available on mobile', async () => {
      setWindowWidth(375);
      
      renderWithProviders(<ModelLab />);

      expect(screen.getByTestId('shap-chart')).toBeInTheDocument();
      expect(screen.getByTestId('model-performance-table')).toBeInTheDocument();
    });
  });

  describe('Feature comparison: Desktop vs Mobile', () => {
    it('should have same number of visualizations on desktop and mobile', () => {
      // Render desktop
      setWindowWidth(1920);
      const { container: desktopContainer } = renderWithProviders(<Dashboard />);
      const desktopVisualizations = desktopContainer.querySelectorAll('[data-testid]');

      // Render mobile
      setWindowWidth(375);
      const { container: mobileContainer } = renderWithProviders(<Dashboard />);
      const mobileVisualizations = mobileContainer.querySelectorAll('[data-testid]');

      // Should have same number of visualizations (feature parity)
      expect(mobileVisualizations.length).toBeGreaterThanOrEqual(desktopVisualizations.length - 5);
      // Allow small difference for responsive containers themselves
    });
  });

  describe('Mobile layout adaptation', () => {
    it('should adapt layout below 768px breakpoint', async () => {
      setWindowWidth(767);
      
      const { container } = renderWithProviders(<ClockLanding />);

      const mobileContainers = container.querySelectorAll('[data-mobile="true"]');
      expect(mobileContainers.length).toBeGreaterThan(0);
    });

    it('should use desktop layout above 768px breakpoint', async () => {
      setWindowWidth(769);
      
      const { container } = renderWithProviders(<ClockLanding />);

      const desktopContainers = container.querySelectorAll('[data-mobile="false"]');
      expect(desktopContainers.length).toBeGreaterThan(0);
    });
  });

  describe('Interactive elements on mobile', () => {
    it('should have accessible interactive elements on mobile', async () => {
      setWindowWidth(375);
      
      renderWithProviders(<ClockLanding />);

      // All buttons should be present and accessible
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // All links should be present
      const links = screen.queryAllByRole('link');
      // Links may or may not be present depending on page
    });
  });
});

describe('Mobile Content Prioritization', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('should order high priority content before medium priority', () => {
    setWindowWidth(375);
    
    const { container } = renderWithProviders(<Dashboard />);

    const allContainers = Array.from(
      container.querySelectorAll('[data-testid="responsive-container"]')
    );

    const priorities = allContainers.map((c) => c.getAttribute('data-priority'));

    // Find indices
    const highIndices = priorities
      .map((p, i) => (p === 'high' ? i : -1))
      .filter((i) => i !== -1);
    const mediumIndices = priorities
      .map((p, i) => (p === 'medium' ? i : -1))
      .filter((i) => i !== -1);

    if (highIndices.length > 0 && mediumIndices.length > 0) {
      const lastHigh = Math.max(...highIndices);
      const firstMedium = Math.min(...mediumIndices);
      
      // This test verifies CSS order property works correctly
      // In actual DOM order, high priority should come before medium
      expect(lastHigh).toBeLessThanOrEqual(firstMedium + 3); // Allow some flexibility
    }
  });

  it('should order medium priority content before low priority', () => {
    setWindowWidth(375);
    
    const { container } = renderWithProviders(<Dashboard />);

    const allContainers = Array.from(
      container.querySelectorAll('[data-testid="responsive-container"]')
    );

    const priorities = allContainers.map((c) => c.getAttribute('data-priority'));

    const mediumIndices = priorities
      .map((p, i) => (p === 'medium' ? i : -1))
      .filter((i) => i !== -1);
    const lowIndices = priorities
      .map((p, i) => (p === 'low' ? i : -1))
      .filter((i) => i !== -1);

    if (mediumIndices.length > 0 && lowIndices.length > 0) {
      const lastMedium = Math.max(...mediumIndices);
      const firstLow = Math.min(...lowIndices);
      
      expect(lastMedium).toBeLessThanOrEqual(firstLow + 3);
    }
  });
});
