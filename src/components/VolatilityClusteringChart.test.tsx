import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import VolatilityClusteringChart from './VolatilityClusteringChart';
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

describe('VolatilityClusteringChart', () => {
  const renderComponent = () => {
    return render(
      <ModelProvider>
        <DateProvider>
          <VolatilityClusteringChart />
        </DateProvider>
      </ModelProvider>
    );
  };

  it('renders the component with title', () => {
    renderComponent();
    expect(screen.getByText('Volatility Clustering')).toBeInTheDocument();
  });

  it('shows info button for layman explanation', () => {
    renderComponent();
    const infoButton = screen.getByLabelText('Show explanation');
    expect(infoButton).toBeInTheDocument();
  });

  it('displays algorithm metadata', () => {
    renderComponent();
    // Check for algorithm label (the actual value comes from mock data)
    expect(screen.getByText(/Algorithm:/)).toBeInTheDocument();
  });

  it('displays min duration metadata', () => {
    renderComponent();
    // Check for min duration label
    expect(screen.getByText(/Min Duration:/)).toBeInTheDocument();
  });

  it('displays current volatility stat', () => {
    renderComponent();
    expect(screen.getByText('Current Volatility')).toBeInTheDocument();
  });

  it('displays historical average stat', () => {
    renderComponent();
    expect(screen.getByText('Historical Average')).toBeInTheDocument();
  });

  it('displays total clusters stat', () => {
    renderComponent();
    expect(screen.getByText('Total Clusters')).toBeInTheDocument();
  });

  it('renders chart container', () => {
    const { container } = renderComponent();
    const chartElement = container.querySelector('#chart-volatility-clustering');
    expect(chartElement).toBeInTheDocument();
  });

  it('displays identified clusters section when clusters exist', () => {
    renderComponent();
    // The mock data should have clusters, so this section should appear
    expect(screen.getByText('Identified Clusters')).toBeInTheDocument();
  });

  it('shows cluster cards with details', () => {
    const { container } = renderComponent();
    // Check for cluster card elements
    const clusterCards = container.querySelectorAll('.cluster-card');
    expect(clusterCards.length).toBeGreaterThan(0);
  });

  it('displays cluster duration in cluster cards', () => {
    renderComponent();
    // Check for duration label in cluster details
    expect(screen.getAllByText('Duration:').length).toBeGreaterThan(0);
  });

  it('displays cluster intensity in cluster cards', () => {
    renderComponent();
    // Check for intensity label in cluster details
    expect(screen.getAllByText('Intensity:').length).toBeGreaterThan(0);
  });
});
