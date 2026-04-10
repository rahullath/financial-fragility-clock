/**
 * CrisisContext — global crisis selector state.
 *
 * Provides:
 *  - crisisWindows:   hardcoded list of reference crisis periods
 *  - selectedCrises:  set of currently active crisis IDs
 *  - toggleCrisis:    add/remove a crisis from the active set
 *  - activeCrisisWindows: filtered windows for active crises
 *
 * The clock, stat strip, and timeline all consume this context to know
 * which crises are being compared against.  CrisisSelector is just the UI
 * writer — it does not own the state.
 */

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CrisisWindow {
  id: string;
  label: string;
  shortLabel: string;
  start: string; // ISO date
  end: string;   // ISO date
  severity: 'crisis' | 'correction';
  modelRequired: 'A' | 'B' | 'both'; // which model has data for this window
}

export interface CrisisContextValue {
  crisisWindows: CrisisWindow[];
  selectedCrises: Set<string>;
  toggleCrisis: (id: string) => void;
  activeCrisisWindows: CrisisWindow[];
}

// ── Hardcoded crisis window definitions ───────────────────────────────────────

export const CRISIS_WINDOWS: CrisisWindow[] = [
  {
    id: 'gfc_2008',
    label: 'GFC 2008',
    shortLabel: 'GFC',
    start: '2008-09-01',
    end: '2009-03-31',
    severity: 'crisis',
    modelRequired: 'B',
  },
  {
    id: 'dotcom_2000',
    label: 'Dot-com Collapse',
    shortLabel: 'Dot-com',
    start: '2000-03-01',
    end: '2002-10-31',
    severity: 'crisis',
    modelRequired: 'B',
  },
  {
    id: 'covid_2020',
    label: 'COVID Crash 2020',
    shortLabel: 'COVID',
    start: '2020-02-01',
    end: '2020-04-30',
    severity: 'crisis',
    modelRequired: 'B',
  },
  {
    id: 'flash_2010',
    label: 'Flash Crash 2010',
    shortLabel: 'Flash Crash',
    start: '2010-04-01',
    end: '2010-07-31',
    severity: 'correction',
    modelRequired: 'both',
  },
  {
    id: 'eu_debt_2010',
    label: 'European Debt Crisis',
    shortLabel: 'EU Debt',
    start: '2010-04-01',
    end: '2011-12-31',
    severity: 'crisis',
    modelRequired: 'both',
  },
];

// ── Context ───────────────────────────────────────────────────────────────────

const CrisisContext = createContext<CrisisContextValue | null>(null);

interface CrisisProviderProps {
  children: ReactNode;
}

/**
 * CrisisProvider
 *
 * Default selection: GFC 2008 + Flash Crash 2010 (both have strong data
 * in Model B and Model A respectively).
 */
export const CrisisProvider: React.FC<CrisisProviderProps> = ({ children }) => {
  const [selectedCrises, setSelectedCrises] = useState<Set<string>>(
    new Set(['flash_2010', 'gfc_2008'])
  );

  const toggleCrisis = (id: string) => {
    setSelectedCrises((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeCrisisWindows = useMemo(
    () => CRISIS_WINDOWS.filter((w) => selectedCrises.has(w.id)),
    [selectedCrises]
  );

  return (
    <CrisisContext.Provider
      value={{ crisisWindows: CRISIS_WINDOWS, selectedCrises, toggleCrisis, activeCrisisWindows }}
    >
      {children}
    </CrisisContext.Provider>
  );
};

/**
 * Hook to access CrisisContext.
 * Must be used inside <CrisisProvider>.
 */
export const useCrisisContext = (): CrisisContextValue => {
  const ctx = useContext(CrisisContext);
  if (!ctx) throw new Error('useCrisisContext must be used within a CrisisProvider');
  return ctx;
};

export default CrisisContext;
