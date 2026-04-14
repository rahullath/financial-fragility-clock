/**
 * DataUnavailable — fallback UI for components with missing data
 */

import React from 'react';

interface DataUnavailableProps {
  message?: string;
  componentName?: string;
}

const DataUnavailable: React.FC<DataUnavailableProps> = ({
  message = 'Data unavailable',
  componentName,
}) => (
  <div
    className="panel-card"
    style={{
      padding: '2rem',
      textAlign: 'center',
      opacity: 0.6,
    }}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      style={{
        width: 48,
        height: 48,
        margin: '0 auto 1rem',
        color: 'var(--color-text-secondary, #999)',
      }}
    >
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={8} x2={12} y2={12} />
      <line x1={12} y1={16} x2={12.01} y2={16} />
    </svg>
    {componentName && (
      <h4 style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
        {componentName}
      </h4>
    )}
    <p style={{ color: 'var(--color-text-secondary, #666)', margin: 0 }}>
      {message}
    </p>
  </div>
);

export default DataUnavailable;
