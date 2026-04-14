/**
 * Event Filtering Test - Task 3.4
 * 
 * Validates that events are correctly filtered by model date range:
 * - Model A (2009-2011): Should only show Flash Crash 2010 and Greece Crisis
 * - Model B: Should show all events including Lehman 2008 and COVID 2020
 * 
 * **Validates: Requirements 2.12, 2.13, 3.6**
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelProvider } from '../contexts/ModelContext';
import { DateProvider } from '../contexts/DateContext';
import { CrisisProvider } from '../contexts/CrisisContext';
import HistoryArchive from '../routes/HistoryArchive';

// Helper to render with all required contexts
const renderWithContexts = (component: React.ReactElement) => {
  return render(
    <ModelProvider>
      <DateProvider>
        <CrisisProvider>
          {component}
        </CrisisProvider>
      </DateProvider>
    </ModelProvider>
  );
};

describe('Event Filtering by Model Date Range - Task 3.4', () => {
  
  it('Model A should only show events within 2009-2011 date range', () => {
    // Render HistoryArchive with Model A (default)
    const { container } = renderWithContexts(<HistoryArchive />);
    
    // Find the event legend section
    const eventLegend = container.querySelector('.history-events-grid');
    expect(eventLegend).toBeInTheDocument();
    
    // Model A should show Flash Crash (2010-05-06) and Greece Crisis (2010-04-27) in the event legend
    const eventLabels = eventLegend?.querySelectorAll('.history-event-label');
    const eventTexts = Array.from(eventLabels || []).map(el => el.textContent);
    
    expect(eventTexts).toContain('Flash Crash');
    expect(eventTexts).toContain('Greece Crisis');
    
    // Model A should NOT show Lehman Brothers (2008) or COVID Crash (2020) in the event legend
    expect(eventTexts).not.toContain('Lehman Brothers');
    expect(eventTexts).not.toContain('COVID Crash');
    
    // Verify event count is 2 for Model A
    expect(screen.getByText('2 annotated events')).toBeInTheDocument();
    
    // Verify exactly 2 events are displayed
    expect(eventLabels?.length).toBe(2);
  });
  
  it('Model A events should be within 2009-2011 date range', () => {
    renderWithContexts(<HistoryArchive />);
    
    // Check that displayed dates are within 2009-2011
    const flashCrashDate = screen.getByText('2010-05-06');
    const greeceCrisisDate = screen.getByText('2010-04-27');
    
    expect(flashCrashDate).toBeInTheDocument();
    expect(greeceCrisisDate).toBeInTheDocument();
    
    // Verify dates are within range
    const flashCrashYear = new Date('2010-05-06').getFullYear();
    const greeceCrisisYear = new Date('2010-04-27').getFullYear();
    
    expect(flashCrashYear).toBeGreaterThanOrEqual(2009);
    expect(flashCrashYear).toBeLessThanOrEqual(2011);
    expect(greeceCrisisYear).toBeGreaterThanOrEqual(2009);
    expect(greeceCrisisYear).toBeLessThanOrEqual(2011);
  });
  
  it('Model A should not display events outside date range (Lehman 2008, COVID 2020)', () => {
    const { container } = renderWithContexts(<HistoryArchive />);
    
    // Find the event legend section
    const eventLegend = container.querySelector('.history-events-grid');
    expect(eventLegend).toBeInTheDocument();
    
    // Get all event dates and labels from the event legend
    const eventDates = eventLegend?.querySelectorAll('.history-event-date');
    const eventLabels = eventLegend?.querySelectorAll('.history-event-label');
    
    const dates = Array.from(eventDates || []).map(el => el.textContent);
    const labels = Array.from(eventLabels || []).map(el => el.textContent);
    
    // Verify Lehman Brothers (2008-09-15) is NOT displayed in the event legend
    expect(dates).not.toContain('2008-09-15');
    expect(labels).not.toContain('Lehman Brothers');
    
    // Verify COVID (2020-03-16) is NOT displayed in the event legend
    expect(dates).not.toContain('2020-03-16');
    expect(labels).not.toContain('COVID Crash');
    
    // Verify only 2009-2011 dates are shown
    dates.forEach(date => {
      const year = new Date(date || '').getFullYear();
      expect(year).toBeGreaterThanOrEqual(2009);
      expect(year).toBeLessThanOrEqual(2011);
    });
  });
});
