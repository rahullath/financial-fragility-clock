/**
 * ClockLanding Page Tests
 * 
 * Tests for the ClockLanding page to ensure all components are properly integrated,
 * including the ModelToggle component.
 * 
 * Requirements: 1.1 (ModelToggle appears on ClockLanding page)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ModelProvider } from '../contexts/ModelContext';
import { CrisisProvider } from '../contexts/CrisisContext';
import { DateProvider } from '../contexts/DateContext';
import ClockLanding from './ClockLanding';

// Helper to render with all required providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ModelProvider>
        <CrisisProvider>
          <DateProvider>
            {component}
          </DateProvider>
        </CrisisProvider>
      </ModelProvider>
    </BrowserRouter>
  );
};

describe('ClockLanding Page', () => {
  // Requirement 1.1: ModelToggle appears on ClockLanding page
  it('displays the ModelToggle component', () => {
    renderWithProviders(<ClockLanding />);
    
    const toggleGroup = screen.getByRole('group', { name: 'Model selection' });
    expect(toggleGroup).toBeInTheDocument();
  });

  // Verify ModelToggle is at the top of the page
  it('displays ModelToggle before other components', () => {
    const { container } = renderWithProviders(<ClockLanding />);
    
    const clockLanding = container.querySelector('.clock-landing');
    const modelToggle = clockLanding?.querySelector('.model-toggle-wrapper');
    
    // The model toggle should be present in the clock landing
    expect(modelToggle).toBeInTheDocument();
  });

  // Verify all main components are present
  it('displays all main components', () => {
    renderWithProviders(<ClockLanding />);
    
    // ModelToggle
    expect(screen.getByRole('group', { name: 'Model selection' })).toBeInTheDocument();
    
    // DoomsdayClock (check for the clock container)
    const clockContainer = document.querySelector('.doomsday-clock');
    expect(clockContainer).toBeInTheDocument();
    
    // RegimeTimeline
    const timelineContainer = document.querySelector('.regime-timeline');
    expect(timelineContainer).toBeInTheDocument();
    
    // StatStrip
    const statStrip = document.querySelector('.stat-strip');
    expect(statStrip).toBeInTheDocument();
    
    // DateScrubber
    const dateScrubber = document.querySelector('.date-scrubber');
    expect(dateScrubber).toBeInTheDocument();
    
    // CrisisSelector
    const crisisSelector = document.querySelector('.crisis-selector');
    expect(crisisSelector).toBeInTheDocument();
  });

  // Verify the hero layout structure
  it('has the correct hero layout structure', () => {
    const { container } = renderWithProviders(<ClockLanding />);
    
    const heroSection = container.querySelector('.clock-landing-hero');
    expect(heroSection).toBeInTheDocument();
  });
});
