import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { useModelContext } from './ModelContext';
import { toNum } from '../utils/dataUtils';

/** A key financial event annotation. */
export interface KeyEvent {
  date: Date;
  label: string;
  description: string;
  severity: 'crisis' | 'correction' | 'note';
}

/** DateContext value interface providing global date state. */
export interface DateContextValue {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  dateRange: [Date, Date];
  keyEvents: KeyEvent[];
}

const DateContext = createContext<DateContextValue | null>(null);

interface DateProviderProps {
  children: ReactNode;
}

/**
 * DateContext Provider
 *
 * Derives its date range from the currently-selected model (via ModelContext).
 * When the model switches, selectedDate is clamped to the new model's range.
 *
 * Requirements: 12.5, 26.4
 */
export const DateProvider: React.FC<DateProviderProps> = ({ children }) => {
  const { currentModelData } = useModelContext();

  // Derive actual date range from the data itself, not just metadata
  // This ensures we include all dates, including 2026 live data
  const dateRange: [Date, Date] = useMemo(() => {
    const rows = currentModelData.featuresData.data;
    if (rows.length === 0) {
      // Fallback to metadata if no data
      const [start, end] = currentModelData.info.dateRange;
      return [new Date(start), new Date(end)];
    }
    
    // Find actual min and max dates from the data
    let minDate = new Date(rows[0].date as string);
    let maxDate = new Date(rows[0].date as string);
    
    for (const row of rows) {
      const date = new Date(row.date as string);
      if (date < minDate) minDate = date;
      if (date > maxDate) maxDate = date;
    }
    
    return [minDate, maxDate];
  }, [currentModelData]);

  // Initialise to the first valid date with a non-null fragility_score
  const firstValidDate = (() => {
    const row = currentModelData.featuresData.data.find(
      (r) => toNum(r.fragility_score) != null
    );
    return row ? new Date(row.date as string) : dateRange[0];
  })();

  const defaultDate = (() => {
    const target = new Date('2022-12-03');
    const [min, max] = dateRange;
    if (target >= min && target <= max) return target;
    return firstValidDate;
  })();

  const [selectedDate, setSelectedDateInternal] =
    useState<Date>(defaultDate);

  // When the model changes, clamp selectedDate to the new range
  useEffect(() => {
    const [min, max] = dateRange;
    if (selectedDate < min) {
      setSelectedDateInternal(firstValidDate);
    } else if (selectedDate > max) {
      setSelectedDateInternal(max);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModelData.info.id]);

  /**
   * Set selected date with validation and clamping to the current model's
   * date range. Logs a warning when an out-of-range date is provided.
   */
  const setSelectedDate = (date: Date) => {
    const [minDate, maxDate] = dateRange;

    if (date < minDate) {
      console.warn(
        `Date ${date.toISOString()} is before range start ` +
          `${minDate.toISOString()}. Clamping.`
      );
      setSelectedDateInternal(minDate);
      return;
    }

    if (date > maxDate) {
      console.warn(
        `Date ${date.toISOString()} is after range end ` +
          `${maxDate.toISOString()}. Clamping.`
      );
      setSelectedDateInternal(maxDate);
      return;
    }

    setSelectedDateInternal(date);
  };

  // Key events come from the active model
  const keyEvents: KeyEvent[] = currentModelData.keyEvents.map((e) => ({
    date: new Date(e.date),
    label: e.label,
    description: e.description,
    severity: e.severity,
  }));

  const value: DateContextValue = {
    selectedDate,
    setSelectedDate,
    dateRange,
    keyEvents,
  };

  return <DateContext.Provider value={value}>{children}</DateContext.Provider>;
};

/**
 * Hook to access DateContext.
 * Must be used inside a <DateProvider>.
 */
export const useDateContext = (): DateContextValue => {
  const ctx = useContext(DateContext);
  if (!ctx) {
    throw new Error('useDateContext must be used within a DateProvider');
  }
  return ctx;
};

export default DateContext;
