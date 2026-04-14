/**
 * ModelToggle Component Tests
 * 
 * Tests for the ModelToggle component that allows users to switch between
 * Model A (ISE 2009-2011) and Model B (Global 2003-2025).
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelProvider } from '../contexts/ModelContext';
import ModelToggle from './ModelToggle';

describe('ModelToggle Component', () => {
  // Requirement 1.1: ModelToggle appears on the page
  it('renders the model toggle component', () => {
    render(
      <ModelProvider>
        <ModelToggle />
      </ModelProvider>
    );
    
    const toggleGroup = screen.getByRole('group', { name: 'Model selection' });
    expect(toggleGroup).toBeInTheDocument();
  });

  // Requirement 1.2: Indicates which model is currently active
  it('indicates the currently active model', () => {
    render(
      <ModelProvider>
        <ModelToggle />
      </ModelProvider>
    );
    
    const modelAButton = screen.getByRole('button', { name: /Model A/i });
    expect(modelAButton).toHaveClass('active');
    expect(modelAButton).toHaveAttribute('aria-pressed', 'true');
  });

  // Requirement 1.3: Switches between models when clicked
  it('switches between models when clicked', () => {
    render(
      <ModelProvider>
        <ModelToggle />
      </ModelProvider>
    );
    
    const modelBButton = screen.getByRole('button', { name: /Model B/i });
    fireEvent.click(modelBButton);
    
    expect(modelBButton).toHaveClass('active');
    expect(modelBButton).toHaveAttribute('aria-pressed', 'true');
  });

  // Requirement 1.5: Displays model name and date range
  it('displays model name and date range for Model A', () => {
    render(
      <ModelProvider>
        <ModelToggle />
      </ModelProvider>
    );
    
    expect(screen.getByText('Model A')).toBeInTheDocument();
    expect(screen.getByText('ISE 2009–2011')).toBeInTheDocument();
    
    // Check that date range is displayed in the metadata section
    const metaRange = document.querySelector('.model-meta-range');
    expect(metaRange).toBeInTheDocument();
    expect(metaRange?.textContent).toMatch(/\w{3}\s+\d{4}/); // e.g., "Jan 2009"
  });

  // Requirement 1.5: Displays model name and date range for Model B
  it('displays model name and date range for Model B', () => {
    render(
      <ModelProvider>
        <ModelToggle />
      </ModelProvider>
    );
    
    expect(screen.getByText('Model B')).toBeInTheDocument();
    expect(screen.getByText('Global 2003–2025')).toBeInTheDocument();
  });

  // Additional test: Displays observation count
  it('displays observation count for the active model', () => {
    render(
      <ModelProvider>
        <ModelToggle />
      </ModelProvider>
    );
    
    const metaObs = document.querySelector('.model-meta-obs');
    expect(metaObs).toBeInTheDocument();
    expect(metaObs?.textContent).toMatch(/\d+\s+obs/); // e.g., "536 obs"
  });

  // Additional test: Updates metadata when switching models
  it('updates metadata when switching models', () => {
    render(
      <ModelProvider>
        <ModelToggle />
      </ModelProvider>
    );
    
    const modelBButton = screen.getByRole('button', { name: /Model B/i });
    fireEvent.click(modelBButton);
    
    const metaObs = document.querySelector('.model-meta-obs');
    expect(metaObs?.textContent).toMatch(/\d+\s+obs/);
  });

  // Edge case: Both buttons are always present
  it('always displays both model options', () => {
    render(
      <ModelProvider>
        <ModelToggle />
      </ModelProvider>
    );
    
    const modelAButton = screen.getByRole('button', { name: /Model A/i });
    const modelBButton = screen.getByRole('button', { name: /Model B/i });
    
    expect(modelAButton).toBeInTheDocument();
    expect(modelBButton).toBeInTheDocument();
  });

  // Accessibility: Proper ARIA attributes
  it('has proper accessibility attributes', () => {
    render(
      <ModelProvider>
        <ModelToggle />
      </ModelProvider>
    );
    
    const toggleGroup = screen.getByRole('group', { name: 'Model selection' });
    expect(toggleGroup).toBeInTheDocument();
    
    const modelAButton = screen.getByRole('button', { name: /Model A/i });
    expect(modelAButton).toHaveAttribute('aria-pressed');
    expect(modelAButton).toHaveAttribute('title');
  });
});
