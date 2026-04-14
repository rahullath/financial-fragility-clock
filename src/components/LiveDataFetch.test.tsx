/**
 * Bug Condition Exploration Test for Stale Data (Bug 3)
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * This test encodes the EXPECTED behavior for live data freshness.
 * It MUST FAIL on unfixed code to confirm the bug exists.
 * When it passes after the fix, it validates the correct behavior.
 * 
 * Expected Behavior Properties:
 * - Data reflects most recent trading day (not weeks/months old)
 * - fetch_live.py has been executed (logs exist)
 * - Phase 2 fields (crash_probability, crisis_similarity_composite) are populated
 * - Cron job is configured for daily updates
 * 
 * Bug Indicators:
 * - Application displays stale data (e.g., "49 days" statistic)
 * - model_b_features_slim.json last date is weeks/months old
 * - No fetch_live.py execution logs
 * - crash_probability and crisis_similarity_composite are null for recent dates
 * - No cron job configured
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * ============================================================================
 * FAULT CONDITION EXPLORATION TESTS (Task 9)
 * ============================================================================
 */

describe('Bug 3: Live Data Fetch Not Executed - Fault Condition Exploration', () => {
  describe('Property 1: Fault Condition - Live Data Not Current', () => {
    
    it('Indicator 1: model_b_features_slim.json last date should be recent (not weeks/months old)', () => {
      // Read the data file
      const dataPath = path.join(process.cwd(), 'src/data/model_b_features_slim.json');
      const dataContent = fs.readFileSync(dataPath, 'utf-8');
      const jsonData = JSON.parse(dataContent);
      const data = jsonData.data || jsonData; // Handle both array and object with data property
      
      // Get the last entry
      const lastEntry = data[data.length - 1];
      const lastDate = new Date(lastEntry.date);
      const today = new Date();
      
      // Calculate days difference
      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`Last data date: ${lastDate.toISOString().split('T')[0]}`);
      console.log(`Today: ${today.toISOString().split('T')[0]}`);
      console.log(`Days difference: ${daysDiff}`);
      
      // Expected: Data should be from the most recent trading day (within 7 days accounting for weekends)
      // This will FAIL on unfixed code (data is stale, showing "49 days" or more)
      expect(daysDiff).toBeLessThanOrEqual(7);
    });

    it('Indicator 2: Phase 2 fields should be populated for recent dates', () => {
      // Read the data file
      const dataPath = path.join(process.cwd(), 'src/data/model_b_features_slim.json');
      const dataContent = fs.readFileSync(dataPath, 'utf-8');
      const jsonData = JSON.parse(dataContent);
      const data = jsonData.data || jsonData; // Handle both array and object with data property
      
      // Get the last 10 entries
      const recentEntries = data.slice(-10);
      
      // Check if crisis_similarity_composite is populated (crash_probability may be null for recent dates due to 30-day horizon)
      const nullCrisisSim = recentEntries.filter((entry: any) => entry.crisis_similarity_composite === null);
      
      console.log(`Recent entries with null crisis_similarity_composite: ${nullCrisisSim.length}/10`);
      
      // Expected: crisis_similarity_composite should be populated (not null)
      // This will FAIL on unfixed code (Phase 2 has not been run on live data)
      // Note: crash_probability may be null for recent dates due to 30-day future horizon requirement
      expect(nullCrisisSim.length).toBe(0);
    });

    it('Indicator 3: fetch_live.py should have been executed (logs should exist)', () => {
      // Check if fetch_live.py has been executed by looking for log file
      const logPath = '/tmp/fragility_update.log';
      const logExists = fs.existsSync(logPath);
      
      console.log(`Log file exists at ${logPath}: ${logExists}`);
      
      if (logExists) {
        const logContent = fs.readFileSync(logPath, 'utf-8');
        const logLines = logContent.split('\n').slice(0, 10); // First 10 lines
        console.log('Log file preview:', logLines.join('\n'));
      }
      
      // Expected: Log file should exist (fetch_live.py has been executed)
      // This will FAIL on unfixed code (script has never been run)
      expect(logExists).toBe(true);
    });

    it('Indicator 4: Cron job should be configured for daily updates', () => {
      // Check if cron job is configured
      let cronOutput = '';
      let cronConfigured = false;
      
      try {
        cronOutput = execSync('crontab -l 2>/dev/null || echo "No crontab"', { encoding: 'utf-8' });
        cronConfigured = cronOutput.includes('fetch_live.py');
        
        console.log('Crontab output:');
        console.log(cronOutput);
        console.log(`Cron job configured: ${cronConfigured}`);
      } catch (error) {
        console.log('Error reading crontab:', error);
      }
      
      // Expected: Cron job should be configured
      // This will FAIL on unfixed code (no cron job exists)
      expect(cronConfigured).toBe(true);
    });

    it('Indicator 5: Data freshness check - last date should match most recent trading day', () => {
      // Read the data file
      const dataPath = path.join(process.cwd(), 'src/data/model_b_features_slim.json');
      const dataContent = fs.readFileSync(dataPath, 'utf-8');
      const jsonData = JSON.parse(dataContent);
      const data = jsonData.data || jsonData; // Handle both array and object with data property
      
      // Get the last entry
      const lastEntry = data[data.length - 1];
      const lastDate = new Date(lastEntry.date);
      const today = new Date();
      
      // Calculate the most recent trading day (accounting for weekends)
      const dayOfWeek = today.getDay();
      let expectedDaysDiff = 0;
      
      if (dayOfWeek === 0) { // Sunday
        expectedDaysDiff = 2;
      } else if (dayOfWeek === 6) { // Saturday
        expectedDaysDiff = 1;
      }
      
      const expectedLastDate = new Date(today);
      expectedLastDate.setDate(today.getDate() - expectedDaysDiff);
      
      const actualDaysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`Expected last trading day: ${expectedLastDate.toISOString().split('T')[0]}`);
      console.log(`Actual last data date: ${lastDate.toISOString().split('T')[0]}`);
      console.log(`Actual days difference: ${actualDaysDiff}`);
      
      // Expected: Data should be from the most recent trading day
      // This will FAIL on unfixed code (data is stale)
      expect(actualDaysDiff).toBeLessThanOrEqual(expectedDaysDiff + 1); // +1 for timezone/timing tolerance
    });
  });

  describe('Property-Based Test: Data freshness across multiple indicators', () => {
    it('should have fresh data across all indicators', () => {
      // This is a comprehensive test that checks all indicators together
      const dataPath = path.join(process.cwd(), 'src/data/model_b_features_slim.json');
      const dataContent = fs.readFileSync(dataPath, 'utf-8');
      const jsonData = JSON.parse(dataContent);
      const data = jsonData.data || jsonData; // Handle both array and object with data property
      
      const lastEntry = data[data.length - 1];
      const lastDate = new Date(lastEntry.date);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check all indicators
      const indicators = {
        dataFreshness: daysDiff <= 7,
        phase2Populated: lastEntry.crisis_similarity_composite !== null, // Only check crisis_similarity_composite for recent dates
        logExists: fs.existsSync('/tmp/fragility_update.log'),
        cronConfigured: false
      };
      
      try {
        const cronOutput = execSync('crontab -l 2>/dev/null || echo "No crontab"', { encoding: 'utf-8' });
        indicators.cronConfigured = cronOutput.includes('fetch_live.py');
      } catch (error) {
        // Cron not configured
      }
      
      console.log('Data freshness indicators:', indicators);
      
      // Expected: All indicators should be true
      // This will FAIL on unfixed code (multiple indicators will be false)
      expect(indicators.dataFreshness).toBe(true);
      expect(indicators.phase2Populated).toBe(true);
      expect(indicators.logExists).toBe(true);
      expect(indicators.cronConfigured).toBe(true);
    });
  });
});
