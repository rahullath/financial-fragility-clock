import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CorrelationNetworkEvolution from './CorrelationNetworkEvolution';
import { ModelProvider } from '../contexts/ModelContext';
import { DateProvider } from '../contexts/DateContext';

// Mock D3 completely to avoid rendering issues in tests
vi.mock('d3', () => {
  const mockSelection = {
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    append: vi.fn().mockReturnThis(),
    attr: vi.fn().mockReturnThis(),
    style: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    data: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    call: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn(() => mockSelection),
    forceSimulation: vi.fn(() => ({
      force: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      stop: vi.fn(),
    })),
    forceLink: vi.fn(() => ({
      id: vi.fn().mockReturnThis(),
      distance: vi.fn().mockReturnThis(),
    })),
    forceManyBody: vi.fn(() => ({
      strength: vi.fn().mockReturnThis(),
    })),
    forceCenter: vi.fn(),
    forceCollide: vi.fn(() => ({
      radius: vi.fn().mockReturnThis(),
    })),
    zoom: vi.fn(() => ({
      scaleExtent: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
    })),
    drag: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
    })),
  };
});

// Mock exportChart utility
vi.mock('../utils/exportChart', () => ({
  exportChart: vi.fn(),
}));

// Mock LaymanOverlay
vi.mock('./LaymanOverlay', () => ({
  default: () => <div data-testid="layman-overlay">Layman Overlay</div>,
}));

// Mock laymanExplanations
vi.mock('../utils/laymanExplanations', () => ({
  generateCorrelationNetworkExplanation: vi.fn(() => 'Mock explanation'),
}));

describe('CorrelationNetworkEvolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <ModelProvider>
        <DateProvider>
          <CorrelationNetworkEvolution />
        </DateProvider>
      </ModelProvider>
    );
  };

  it('renders the component with title', () => {
    renderComponent();
    expect(screen.getByText('Correlation Network Evolution')).toBeInTheDocument();
  });

  it('displays network metrics panel', () => {
    renderComponent();
    expect(screen.getByText('Network Metrics')).toBeInTheDocument();
    expect(screen.getByText(/Density:/)).toBeInTheDocument();
    expect(screen.getByText(/Clustering:/)).toBeInTheDocument();
    expect(screen.getByText(/Avg Degree:/)).toBeInTheDocument();
    expect(screen.getByText(/Nodes:/)).toBeInTheDocument();
    expect(screen.getByText(/Edges:/)).toBeInTheDocument();
  });

  it('displays animation controls', () => {
    renderComponent();
    expect(screen.getByText('Animation')).toBeInTheDocument();
    const playButton = screen.getByRole('button', { name: /Play/ });
    expect(playButton).toBeInTheDocument();
  });

  it('displays speed control slider', () => {
    renderComponent();
    const speedSlider = screen.getByLabelText('Speed:');
    expect(speedSlider).toBeInTheDocument();
    expect(speedSlider).toHaveAttribute('type', 'range');
  });

  it('displays legend with node color meanings', () => {
    renderComponent();
    expect(screen.getByText('Legend')).toBeInTheDocument();
    expect(screen.getByText('Normal connectivity')).toBeInTheDocument();
    expect(screen.getByText('High connectivity')).toBeInTheDocument();
    expect(screen.getByText('Crisis pattern')).toBeInTheDocument();
  });

  it('displays export button', () => {
    renderComponent();
    const exportButton = screen.getByRole('button', { name: /Export PNG/ });
    expect(exportButton).toBeInTheDocument();
  });

  it('includes LaymanOverlay component', () => {
    renderComponent();
    expect(screen.getByTestId('layman-overlay')).toBeInTheDocument();
  });

  it('displays SVG canvas for network visualization', () => {
    renderComponent();
    const svg = document.querySelector('.cne-svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '600');
    expect(svg).toHaveAttribute('height', '500');
  });
});
