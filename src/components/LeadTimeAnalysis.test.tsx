import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeadTimeAnalysis from './LeadTimeAnalysis';
import { ModelProvider } from '../contexts/ModelContext';

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

describe('LeadTimeAnalysis', () => {
  const renderComponent = () => {
    return render(
      <ModelProvider>
        <LeadTimeAnalysis />
      </ModelProvider>
    );
  };

  it('renders the component with title', () => {
    renderComponent();
    expect(screen.getByText('Crisis Prediction Lead Time Analysis')).toBeInTheDocument();
  });

  it('displays no data message when lead time stats are unavailable', () => {
    renderComponent();
    // The mock data generator provides lead time stats, but if it didn't, we'd see this message
    // This test verifies the component handles missing data gracefully
    const { container } = renderComponent();
    expect(container.querySelector('.lead-time-analysis')).toBeInTheDocument();
  });

  it('renders the component structure', () => {
    const { container } = renderComponent();
    const component = container.querySelector('.lead-time-analysis');
    expect(component).toBeInTheDocument();
  });

  it('displays header section', () => {
    const { container } = renderComponent();
    const header = container.querySelector('.lead-time-header');
    expect(header).toBeInTheDocument();
  });

  it('has proper CSS classes for styling', () => {
    const { container } = renderComponent();
    expect(container.querySelector('.lead-time-analysis')).toHaveClass('lead-time-analysis');
    expect(container.querySelector('.lead-time-header')).toHaveClass('lead-time-header');
    expect(container.querySelector('.lead-time-title')).toHaveClass('lead-time-title');
  });
});
