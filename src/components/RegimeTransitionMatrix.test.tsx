/**
 * RegimeTransitionMatrix.test.tsx
 * 
 * Tests for the RegimeTransitionMatrix component
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RegimeTransitionMatrix from './RegimeTransitionMatrix';
import { ModelProvider } from '../contexts/ModelContext';
import { DateProvider } from '../contexts/DateContext';

// Mock the exportChart utility
vi.mock('../utils/exportChart', () => ({
  exportChart: vi.fn(),
}));

// Mock the LaymanOverlay component
vi.mock('./LaymanOverlay', () => ({
  default: () => <div data-testid="layman-overlay">Layman Overlay</div>,
}));

describe('RegimeTransitionMatrix', () => {
  const renderComponent = () => {
    return render(
      <ModelProvider>
        <DateProvider>
          <RegimeTransitionMatrix />
        </DateProvider>
      </ModelProvider>
    );
  };

  it('renders the component title', () => {
    renderComponent();
    expect(screen.getByText(/Regime Transition Probabilities/i)).toBeInTheDocument();
  });

  it('displays current regime information', () => {
    renderComponent();
    expect(screen.getByText(/Current Regime:/i)).toBeInTheDocument();
  });

  it('renders the transition matrix SVG', () => {
    const { container } = renderComponent();
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('displays regime labels (Normal, Stressed, Crisis)', () => {
    renderComponent();
    // The labels are in SVG text elements, so we need to check the container
    const { container } = renderComponent();
    const svgTexts = container.querySelectorAll('text');
    const textContents = Array.from(svgTexts).map(t => t.textContent);
    
    expect(textContents.some(t => t?.includes('Normal'))).toBe(true);
    expect(textContents.some(t => t?.includes('Stressed'))).toBe(true);
    expect(textContents.some(t => t?.includes('Crisis'))).toBe(true);
  });

  it('renders the probability legend', () => {
    renderComponent();
    expect(screen.getByText(/Low \(0%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/High \(100%\)/i)).toBeInTheDocument();
  });

  it('includes LaymanOverlay component', () => {
    renderComponent();
    expect(screen.getByTestId('layman-overlay')).toBeInTheDocument();
  });

  it('includes export button', () => {
    renderComponent();
    expect(screen.getByText(/Export PNG/i)).toBeInTheDocument();
  });

  it('has proper ARIA label', () => {
    const { container } = renderComponent();
    const component = container.querySelector('[aria-label="Regime transition probability matrix"]');
    expect(component).toBeInTheDocument();
  });
});
