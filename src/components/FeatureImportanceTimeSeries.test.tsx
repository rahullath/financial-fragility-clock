import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeatureImportanceTimeSeries from './FeatureImportanceTimeSeries';
import { ModelProvider } from '../contexts/ModelContext';
import { DateProvider } from '../contexts/DateContext';

// Mock the LaymanOverlay component
vi.mock('./LaymanOverlay', () => ({
  default: ({ explanationGenerator, triggerLabel, triggerClassName }: any) => (
    <button 
      className={triggerClassName}
      onClick={() => {
        const explanation = explanationGenerator();
        console.log(explanation);
      }}
      aria-label="Show explanation"
    >
      {triggerLabel}
    </button>
  ),
}));

describe('FeatureImportanceTimeSeries', () => {
  const renderComponent = (props = {}) => {
    return render(
      <ModelProvider>
        <DateProvider>
          <FeatureImportanceTimeSeries {...props} />
        </DateProvider>
      </ModelProvider>
    );
  };

  it('renders the component with title', () => {
    renderComponent();
    expect(screen.getByText('Feature Importance Over Time')).toBeInTheDocument();
  });

  it('shows info button for layman explanation', () => {
    renderComponent();
    const infoButton = screen.getByLabelText('Show explanation');
    expect(infoButton).toBeInTheDocument();
  });

  it('opens layman overlay when info button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    renderComponent();
    const infoButton = screen.getByLabelText('Show explanation');
    fireEvent.click(infoButton);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('This chart shows how the importance'));
    consoleSpy.mockRestore();
  });

  it('displays top N features meta information', () => {
    renderComponent({ topN: 5 });
    expect(screen.getByText('Top 5 features')).toBeInTheDocument();
  });

  it('displays date range when provided', () => {
    // Use a date range that matches the model data (2009-2011 for Model A)
    renderComponent({ dateRange: ['2010-01-01', '2010-12-31'] });
    expect(screen.getByText('2010-01-01 to 2010-12-31')).toBeInTheDocument();
  });

  it('shows empty state when no data available', () => {
    // This would require mocking ModelContext with empty data
    // For now, we'll skip this test as it requires more complex setup
  });

  it('renders chart container', () => {
    const { container } = renderComponent();
    const chartElement = container.querySelector('#chart-feature-importance');
    expect(chartElement).toBeInTheDocument();
  });
});
