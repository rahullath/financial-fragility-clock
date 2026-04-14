import React, { useCallback, useRef } from 'react';
import { useDateContext } from '../contexts/DateContext';
import './DateScrubber.css';

function formatDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * DateScrubber
 *
 * A horizontal range slider spanning the active model's date range.
 * Updates DateContext.selectedDate with 100 ms debounce to prevent excessive
 * re-renders during drag.  Key event tick marks are overlaid on the track.
 *
 * Requirements: 13.1–13.6, 36.2
 */
const DateScrubber: React.FC = () => {
  const { selectedDate, setSelectedDate, dateRange, keyEvents } =
    useDateContext();

  const [minDate, maxDate] = dateRange;
  const minMs = minDate.getTime();
  const maxMs = maxDate.getTime();
  const totalMs = maxMs - minMs;

  const currentMs = selectedDate.getTime();
  const value = ((currentMs - minMs) / totalMs) * 1000;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      const ms = minMs + (v / 1000) * totalMs;
      const d = new Date(ms);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSelectedDate(d);
      }, 100);
    },
    [minMs, totalMs, setSelectedDate]
  );

  return (
    <div className="date-scrubber" data-testid="date-scrubber" aria-label="Date scrubber">
      <div className="scrubber-label">
        <span className="scrubber-date">{formatDisplay(selectedDate)}</span>
        <span className="scrubber-range">
          {minDate.getFullYear()} – {maxDate.getFullYear()}
        </span>
      </div>

      <div className="scrubber-track-wrapper">
        {/* Key event tick marks */}
        {keyEvents.map((event, i) => {
          const evMs = event.date.getTime();
          if (evMs < minMs || evMs > maxMs) return null;
          const pct = ((evMs - minMs) / totalMs) * 100;
          return (
            <div
              key={i}
              className="scrubber-tick"
              style={{ left: `${pct}%` }}
              title={event.label}
            />
          );
        })}

        <input
          id="date-scrubber-input"
          type="range"
          min={0}
          max={1000}
          step={1}
          value={value}
          onChange={handleChange}
          className="scrubber-input"
          aria-label={`Select date: ${formatDisplay(selectedDate)}`}
          aria-valuemin={0}
          aria-valuemax={1000}
          aria-valuenow={value}
          aria-valuetext={formatDisplay(selectedDate)}
        />
      </div>
    </div>
  );
};

export default DateScrubber;
