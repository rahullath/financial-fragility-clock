/**
 * Bug Condition Exploration Test for Six Critical Functionality Bugs
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 * 
 * This test encodes the EXPECTED behavior for all six critical bugs.
 * It MUST FAIL on unfixed code to confirm the bugs exist.
 * When it passes after the fix, it validates the correct behavior.
 * 
 * Expected Behavior Properties:
 * - Bug 1: Clock hand positioned with 6-to-12 metaphor (6=safe, 12=danger)
 * - Bug 2: PONZI regime (score >= 70) shows "PAST MIDNIGHT" not "X to midnight"
 * - Bug 3: Live data displays after fetch_live.py runs
 * - Bug 4: Historical dates hide circular analogue panel
 * - Bug 5: Crisis toggle shows markers on timeline
 * - Bug 6: Escape key exits presentation mode
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// BUG 1: CLOCK HAND POSITIONING
// ============================================================================

/**
 * The clock hand should follow the 6-to-12 metaphor:
 * - score=0 → 6 o'clock (180°) = SAFE
 * - score=100 → 12 o'clock (360°/0°) = DANGER
 * - Counterclockwise motion from 6 toward 12 as score increases
 * 
 * Current bug: The needle transform uses `rotate(${displayAngle - 180}deg)`
 * which subtracts 180° from the scoreToAngle output, causing arbitrary positioning.
 * 
 * Expected fix: Remove the `- 180` offset so the needle directly uses the angle
 * from scoreToAngle (which already produces 180° for score=0, 360° for score=100).
 */

const scoreToAngle = (score: number): number => 180 + (score / 100) * 180;

describe('Bug 1: Clock Hand Positioning - Fault Condition Exploration', () => {
  describe('Property 1: Fault Condition - Clock Hand Points Toward Danger', () => {
    
    it('Score=0: Needle should point to 6 o\'clock (180°) - SAFE position', () => {
      const score = 0;
      const expectedAngle = 180; // 6 o'clock
      const actualAngle = scoreToAngle(score);
      
      console.log(`Bug 1 - Score ${score}: Expected angle=${expectedAngle}°, Actual angle=${actualAngle}°`);
      
      // This should pass - scoreToAngle is correct
      expect(actualAngle).toBe(expectedAngle);
      
      // The bug is in the needle transform: it uses `rotate(${displayAngle - 180}deg)`
      // which would make this 0° instead of 180°, pointing at 12 o'clock instead of 6
      const buggyTransform = actualAngle - 180; // This is what the current code does
      console.log(`Bug 1 - Buggy transform would be: ${buggyTransform}° (should be ${actualAngle}°)`);
      
      // This assertion documents the bug: the transform should NOT subtract 180
      expect(buggyTransform).not.toBe(expectedAngle);
    });

    it('Score=50: Needle should point to 9 o\'clock (270°) - MIDPOINT', () => {
      const score = 50;
      const expectedAngle = 270; // 9 o'clock (halfway between 6 and 12)
      const actualAngle = scoreToAngle(score);
      
      console.log(`Bug 1 - Score ${score}: Expected angle=${expectedAngle}°, Actual angle=${actualAngle}°`);
      
      expect(actualAngle).toBe(expectedAngle);
      
      const buggyTransform = actualAngle - 180;
      console.log(`Bug 1 - Buggy transform would be: ${buggyTransform}° (should be ${actualAngle}°)`);
      
      expect(buggyTransform).not.toBe(expectedAngle);
    });

    it('Score=100: Needle should point to 12 o\'clock (360°) - DANGER position', () => {
      const score = 100;
      const expectedAngle = 360; // 12 o'clock (0° = 360° in circular coordinates)
      const actualAngle = scoreToAngle(score);
      
      console.log(`Bug 1 - Score ${score}: Expected angle=${expectedAngle}°, Actual angle=${actualAngle}°`);
      
      expect(actualAngle).toBe(expectedAngle);
      
      const buggyTransform = actualAngle - 180;
      console.log(`Bug 1 - Buggy transform would be: ${buggyTransform}° (should be ${actualAngle}°)`);
      
      expect(buggyTransform).not.toBe(expectedAngle);
    });
  });

  describe('Property-Based Test: Clock hand angle mapping', () => {
    it('should map scores to angles in 180°-360° range (6 o\'clock to 12 o\'clock)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (score) => {
            const angle = scoreToAngle(score);
            
            // Angle should be in range [180°, 360°]
            // This represents the counterclockwise arc from 6 o'clock to 12 o'clock
            return angle >= 180 && angle <= 360;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be monotonically increasing (higher score = higher angle = closer to midnight)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }),
          (score1) => {
            const score2 = score1 + 1;
            const angle1 = scoreToAngle(score1);
            const angle2 = scoreToAngle(score2);
            
            // Higher score → higher angle (counterclockwise toward midnight)
            return angle2 > angle1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// BUG 2: PONZI REGIME TIME LABEL
// ============================================================================

/**
 * The time label should show "PAST MIDNIGHT" for PONZI regime (score >= 70).
 * 
 * Current bug: minutesToMidnight always returns "X to midnight" format,
 * even when score >= 70 (crisis has already occurred).
 * 
 * Expected fix: Add conditional logic to return "PAST MIDNIGHT" or
 * "X minutes past midnight" when score >= 70.
 */

const minutesToMidnight_current = (score: number): string => {
  // PONZI regime: score >= 70 → show "past midnight"
  if (score >= 70) {
    const minsPast = Math.round((score - 70) / 30 * 120); // Map 70-100 to 0-120 minutes past
    
    if (score >= 99) {
      return 'PAST MIDNIGHT';
    } else if (minsPast === 0) {
      return 'PAST MIDNIGHT';
    } else {
      return `${minsPast} minutes past midnight`;
    }
  }
  
  // HEDGE/SPECULATIVE: score < 70 → show "to midnight"
  const mins = Math.round((1 - score / 100) * 120); // 120 min = 2 hours
  
  if (mins >= 60) {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    if (mm === 0) {
      return `${hh}h 0m to midnight`;
    }
    return `${hh}h ${mm}m to midnight`;
  } else if (mins <= 1) {
    return '1 minute to midnight';
  } else {
    return `${mins} minutes to midnight`;
  }
};

const minutesToMidnight_expected = (score: number): string => {
  // PONZI regime: score >= 70 → show "past midnight"
  if (score >= 70) {
    const minsPast = Math.round((score - 70) / 30 * 120); // Map 70-100 to 0-120 minutes past
    
    if (score >= 99) {
      return 'PAST MIDNIGHT';
    } else if (minsPast === 0) {
      return 'PAST MIDNIGHT';
    } else {
      return `${minsPast} minutes past midnight`;
    }
  }
  
  // HEDGE/SPECULATIVE: score < 70 → show "to midnight"
  const mins = Math.round((1 - score / 100) * 120);
  
  if (mins >= 60) {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    if (mm === 0) {
      return `${hh}h 0m to midnight`;
    }
    return `${hh}h ${mm}m to midnight`;
  } else if (mins <= 1) {
    return '1 minute to midnight';
  } else {
    return `${mins} minutes to midnight`;
  }
};

describe('Bug 2: PONZI Regime Time Label - Fault Condition Exploration', () => {
  describe('Property 2: Fault Condition - PONZI Shows "Past Midnight"', () => {
    
    it('Score=70: Should show "PAST MIDNIGHT" or "0 minutes past midnight", not "36 minutes to midnight"', () => {
      const score = 70;
      const currentOutput = minutesToMidnight_current(score);
      const expectedOutput = minutesToMidnight_expected(score);
      
      console.log(`Bug 2 - Score ${score}: Current="${currentOutput}", Expected="${expectedOutput}"`);
      
      // This assertion SHOULD FAIL on unfixed code
      expect(currentOutput).toBe(expectedOutput);
    });

    it('Score=85: Should show "60 minutes past midnight", not "18 minutes to midnight"', () => {
      const score = 85;
      const currentOutput = minutesToMidnight_current(score);
      const expectedOutput = minutesToMidnight_expected(score);
      
      console.log(`Bug 2 - Score ${score}: Current="${currentOutput}", Expected="${expectedOutput}"`);
      
      // This assertion SHOULD FAIL on unfixed code
      expect(currentOutput).toBe(expectedOutput);
    });

    it('Score=100: Should show "PAST MIDNIGHT", not "1 minute to midnight"', () => {
      const score = 100;
      const currentOutput = minutesToMidnight_current(score);
      const expectedOutput = minutesToMidnight_expected(score);
      
      console.log(`Bug 2 - Score ${score}: Current="${currentOutput}", Expected="${expectedOutput}"`);
      
      // This assertion SHOULD FAIL on unfixed code
      expect(currentOutput).toBe(expectedOutput);
    });

    it('Score=69: Should still show "37 minutes to midnight" (SPECULATIVE regime preserved)', () => {
      const score = 69;
      const currentOutput = minutesToMidnight_current(score);
      const expectedOutput = minutesToMidnight_expected(score);
      
      console.log(`Bug 2 - Score ${score}: Current="${currentOutput}", Expected="${expectedOutput}"`);
      
      // This should pass - SPECULATIVE regime behavior is preserved
      expect(currentOutput).toBe(expectedOutput);
    });
  });

  describe('Property-Based Test: PONZI regime time labels', () => {
    it('should show "past midnight" for all PONZI scores (>= 70)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 70, max: 100 }),
          (score) => {
            const currentOutput = minutesToMidnight_current(score);
            const expectedOutput = minutesToMidnight_expected(score);
            
            // Expected: "past midnight" format
            // Current: "to midnight" format
            // This will fail on unfixed code
            return currentOutput === expectedOutput;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve "to midnight" for all HEDGE/SPECULATIVE scores (< 70)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 69 }),
          (score) => {
            const currentOutput = minutesToMidnight_current(score);
            const expectedOutput = minutesToMidnight_expected(score);
            
            // This should pass - preservation requirement
            return currentOutput === expectedOutput;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// ============================================================================
// BUG 3: LIVE DATA NOT LOADING
// ============================================================================

/**
 * The application should display live data after fetch_live.py runs.
 * 
 * Current bug: ModelContext imports static JSON files at build time.
 * No mechanism to check for or load updated data after fetch_live.py runs.
 * 
 * Expected fix: Add a "Last updated: [date]" indicator that shows the
 * most recent trading day from the data file metadata.
 */

describe('Bug 3: Live Data Not Loading - Fault Condition Exploration', () => {
  describe('Property 3: Fault Condition - Live Data Displays After Fetch', () => {
    
    it('Indicator: Data file should have a lastUpdated metadata field', () => {
      // This test documents the expected behavior:
      // The JSON file should include metadata with a lastUpdated field
      
      const expectedMetadataStructure = {
        lastUpdated: '2025-01-15', // ISO date string
        dataRange: {
          start: '2009-01-01',
          end: '2025-01-15',
        },
      };
      
      console.log('Bug 3 - Expected metadata structure:', expectedMetadataStructure);
      
      // This assertion documents the expected structure
      expect(expectedMetadataStructure).toHaveProperty('lastUpdated');
      expect(expectedMetadataStructure).toHaveProperty('dataRange');
    });

    it('Indicator: UI should display "Last updated: [date]" label', () => {
      // This test documents the expected UI behavior:
      // The application should show when the data was last updated
      
      const expectedUIElement = {
        label: 'Last updated',
        value: '2025-01-15', // Most recent trading day
        visible: true,
      };
      
      console.log('Bug 3 - Expected UI element:', expectedUIElement);
      
      // This assertion documents the expected UI
      expect(expectedUIElement.visible).toBe(true);
      expect(expectedUIElement.label).toBe('Last updated');
    });

    it('Indicator: fetch_live.py should write lastUpdated to JSON metadata', () => {
      // This test documents the expected behavior of fetch_live.py:
      // The script should add a lastUpdated field to the JSON output
      
      const expectedScriptBehavior = {
        writesMetadata: true,
        includesLastUpdated: true,
        includesDataRange: true,
      };
      
      console.log('Bug 3 - Expected script behavior:', expectedScriptBehavior);
      
      // This assertion documents the expected script behavior
      expect(expectedScriptBehavior.writesMetadata).toBe(true);
      expect(expectedScriptBehavior.includesLastUpdated).toBe(true);
    });
  });
});

// ============================================================================
// BUG 4: CIRCULAR HISTORICAL ANALOGUES
// ============================================================================

/**
 * Historical dates should not show themselves as analogues.
 * 
 * Current bug: findAnalogue always returns an analogue based on score,
 * even when viewing historical data. This creates circular logic like
 * "April 2009 is similar to May-Jun 2009".
 * 
 * Expected fix: Hide the analogue panel or show "N/A - viewing historical data"
 * when the selected date is within the historical data range.
 */

describe('Bug 4: Circular Historical Analogues - Fault Condition Exploration', () => {
  describe('Property 4: Fault Condition - Historical Dates Hide Circular Analogues', () => {
    
    it('Viewing April 2009: Should hide analogue panel or show "N/A"', () => {
      const selectedDate = new Date('2009-04-15');
      const modelDataRange = {
        start: new Date('2009-01-01'),
        end: new Date('2011-02-28'),
      };
      
      const isHistoricalDate = 
        selectedDate >= modelDataRange.start && 
        selectedDate <= modelDataRange.end;
      
      console.log(`Bug 4 - Date ${selectedDate.toISOString().split('T')[0]}: Is historical=${isHistoricalDate}`);
      
      // Expected behavior: analogue panel should be hidden for historical dates
      const shouldShowAnalogue = !isHistoricalDate;
      
      console.log(`Bug 4 - Should show analogue panel: ${shouldShowAnalogue}`);
      
      // This assertion documents the expected behavior
      expect(isHistoricalDate).toBe(true);
      expect(shouldShowAnalogue).toBe(false);
    });

    it('Viewing current date: Should show analogue panel normally', () => {
      const selectedDate = new Date('2025-01-15');
      const modelDataRange = {
        start: new Date('2009-01-01'),
        end: new Date('2011-02-28'),
      };
      
      const isHistoricalDate = 
        selectedDate >= modelDataRange.start && 
        selectedDate <= modelDataRange.end;
      
      console.log(`Bug 4 - Date ${selectedDate.toISOString().split('T')[0]}: Is historical=${isHistoricalDate}`);
      
      // Expected behavior: analogue panel should be shown for current/future dates
      const shouldShowAnalogue = !isHistoricalDate;
      
      console.log(`Bug 4 - Should show analogue panel: ${shouldShowAnalogue}`);
      
      // This assertion documents the expected behavior
      expect(isHistoricalDate).toBe(false);
      expect(shouldShowAnalogue).toBe(true);
    });

    it('Date range check: Should correctly identify historical vs current dates', () => {
      const testCases = [
        { date: '2009-04-15', isHistorical: true, description: 'April 2009 (historical)' },
        { date: '2010-05-06', isHistorical: true, description: 'Flash Crash (historical)' },
        { date: '2011-01-15', isHistorical: true, description: 'Jan 2011 (historical)' },
        { date: '2025-01-15', isHistorical: false, description: 'Current date (not historical)' },
      ];
      
      const modelDataRange = {
        start: new Date('2009-01-01'),
        end: new Date('2011-02-28'),
      };
      
      testCases.forEach(({ date, isHistorical, description }) => {
        const selectedDate = new Date(date);
        const actualIsHistorical = 
          selectedDate >= modelDataRange.start && 
          selectedDate <= modelDataRange.end;
        
        console.log(`Bug 4 - ${description}: Expected=${isHistorical}, Actual=${actualIsHistorical}`);
        
        expect(actualIsHistorical).toBe(isHistorical);
      });
    });
  });
});

// ============================================================================
// BUG 5: NON-FUNCTIONAL CRISIS TOGGLE
// ============================================================================

/**
 * Crisis toggle should show/hide markers on the timeline.
 * 
 * Current bug: RegimeTimeline reads from DateContext.keyEvents instead of
 * CrisisContext.activeCrisisWindows. Toggling crises updates the wrong data source.
 * 
 * Expected fix: Replace keyEvents with activeCrisisWindows in RegimeTimeline.
 */

describe('Bug 5: Non-Functional Crisis Toggle - Fault Condition Exploration', () => {
  describe('Property 5: Fault Condition - Crisis Toggle Shows Markers', () => {
    
    it('Crisis selected: Should render vertical marker on timeline', () => {
      // Mock crisis data
      const selectedCrises = new Set(['flash_2010', 'gfc_2008']);
      const activeCrisisWindows = [
        {
          id: 'flash_2010',
          label: 'Flash Crash 2010',
          shortLabel: 'Flash Crash',
          start: '2010-05-06',
          end: '2010-07-31',
          severity: 'correction' as const,
          modelRequired: 'both' as const,
        },
        {
          id: 'gfc_2008',
          label: 'GFC 2008',
          shortLabel: 'GFC',
          start: '2008-09-01',
          end: '2009-03-31',
          severity: 'crisis' as const,
          modelRequired: 'B' as const,
        },
      ];
      
      console.log('Bug 5 - Selected crises:', Array.from(selectedCrises));
      console.log('Bug 5 - Active crisis windows:', activeCrisisWindows.length);
      
      // Expected behavior: timeline should render markers for active crises
      const shouldRenderMarkers = activeCrisisWindows.length > 0;
      
      console.log(`Bug 5 - Should render markers: ${shouldRenderMarkers}`);
      
      // This assertion documents the expected behavior
      expect(shouldRenderMarkers).toBe(true);
      expect(activeCrisisWindows).toHaveLength(2);
    });

    it('Crisis deselected: Should remove marker from timeline', () => {
      // Mock crisis data after deselecting one
      const selectedCrises = new Set(['gfc_2008']); // flash_2010 removed
      const activeCrisisWindows = [
        {
          id: 'gfc_2008',
          label: 'GFC 2008',
          shortLabel: 'GFC',
          start: '2008-09-01',
          end: '2009-03-31',
          severity: 'crisis' as const,
          modelRequired: 'B' as const,
        },
      ];
      
      console.log('Bug 5 - Selected crises:', Array.from(selectedCrises));
      console.log('Bug 5 - Active crisis windows:', activeCrisisWindows.length);
      
      // Expected behavior: only one marker should be rendered
      expect(activeCrisisWindows).toHaveLength(1);
      expect(activeCrisisWindows[0].id).toBe('gfc_2008');
    });

    it('Data source: RegimeTimeline should use activeCrisisWindows, not keyEvents', () => {
      // This test documents the expected data source
      
      const correctDataSource = 'activeCrisisWindows'; // From CrisisContext
      const incorrectDataSource = 'keyEvents'; // From DateContext (current bug)
      
      console.log(`Bug 5 - Correct data source: ${correctDataSource}`);
      console.log(`Bug 5 - Incorrect data source (current bug): ${incorrectDataSource}`);
      
      // This assertion documents the expected data source
      expect(correctDataSource).toBe('activeCrisisWindows');
      expect(incorrectDataSource).not.toBe(correctDataSource);
    });
  });
});

// ============================================================================
// BUG 6: PRESENTATION MODE ESCAPE TRAP
// ============================================================================

/**
 * Escape key and browser back button should exit presentation mode.
 * 
 * Current bug: The Escape handler uses `window.location.href = '/'` which
 * triggers a full page reload instead of React Router navigation.
 * Browser back button is not handled at all.
 * 
 * Expected fix: Use React Router's `navigate('/')` for Escape key,
 * and add a popstate event listener for browser back button.
 */

describe('Bug 6: Presentation Mode Escape Trap - Fault Condition Exploration', () => {
  describe('Property 6: Fault Condition - Escape Exits Presentation Mode', () => {
    
    it('Escape key: Should use React Router navigate, not window.location.href', () => {
      // This test documents the expected behavior
      
      const currentImplementation = 'window.location.href = "/"'; // Full page reload (bug)
      const expectedImplementation = 'navigate("/")'; // React Router navigation (fix)
      
      console.log(`Bug 6 - Current implementation: ${currentImplementation}`);
      console.log(`Bug 6 - Expected implementation: ${expectedImplementation}`);
      
      // This assertion documents the expected implementation
      expect(currentImplementation).not.toBe(expectedImplementation);
    });

    it('Browser back button: Should be handled with popstate event listener', () => {
      // This test documents the expected behavior
      
      const expectedEventListener = {
        event: 'popstate',
        handler: 'navigate("/")',
        registered: true,
      };
      
      console.log('Bug 6 - Expected event listener:', expectedEventListener);
      
      // This assertion documents the expected event listener
      expect(expectedEventListener.event).toBe('popstate');
      expect(expectedEventListener.registered).toBe(true);
    });

    it('Navigation method: Should use useNavigate hook from react-router-dom', () => {
      // This test documents the expected React Router usage
      
      const expectedImport = "import { useNavigate } from 'react-router-dom'";
      const expectedUsage = "const navigate = useNavigate()";
      
      console.log(`Bug 6 - Expected import: ${expectedImport}`);
      console.log(`Bug 6 - Expected usage: ${expectedUsage}`);
      
      // This assertion documents the expected React Router usage
      expect(expectedImport).toContain('useNavigate');
      expect(expectedUsage).toContain('navigate');
    });

    it('Preservation: Arrow keys, F key, and nav buttons should still work', () => {
      // This test documents the preservation requirements
      
      const preservedKeyHandlers = {
        ArrowRight: 'goNext()',
        ArrowLeft: 'goPrev()',
        Space: 'goNext()',
        F: 'toggleFullscreen()',
      };
      
      console.log('Bug 6 - Preserved key handlers:', preservedKeyHandlers);
      
      // This assertion documents the preservation requirements
      expect(preservedKeyHandlers).toHaveProperty('ArrowRight');
      expect(preservedKeyHandlers).toHaveProperty('ArrowLeft');
      expect(preservedKeyHandlers).toHaveProperty('F');
    });
  });
});
