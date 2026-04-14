import React from 'react';
import { useModelContext } from '../contexts/ModelContext';
import './ModelToggle.css';

/**
 * ModelToggle Component
 *
 * Displays a toggle button in the header allowing users to switch between
 * Model A (ISE 2009-2011) and Model B (Global 2003-2025).
 * Shows the current model's date range and observation count.
 *
 * Requirements: 36.1
 */
const ModelToggle: React.FC = () => {
  const { selectedModel, setSelectedModel, modelAData, modelBData, currentModelData } =
    useModelContext();

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const [start, end] = currentModelData.info.dateRange;

  return (
    <div className="model-toggle-wrapper">
      {/* Pill toggle */}
      <div className="model-toggle" data-testid="model-toggle" role="group" aria-label="Model selection">
        <button
          id="model-toggle-a"
          className={`model-toggle-btn ${selectedModel === 'A' ? 'active' : ''}`}
          onClick={() => setSelectedModel('A')}
          aria-pressed={selectedModel === 'A'}
          title={modelAData.info.description}
        >
          <span className="toggle-model-label">Model A</span>
          <span className="toggle-model-sub">ISE 2009–2011</span>
        </button>

        <button
          id="model-toggle-b"
          className={`model-toggle-btn ${selectedModel === 'B' ? 'active' : ''}`}
          onClick={() => setSelectedModel('B')}
          aria-pressed={selectedModel === 'B'}
          title={modelBData.info.description}
        >
          <span className="toggle-model-label">Model B</span>
          <span className="toggle-model-sub">Global 2003–2025</span>
        </button>
      </div>

      {/* Active model metadata pill */}
      <div className="model-meta">
        <span className="model-meta-range">
          {formatDate(start)} – {formatDate(end)}
        </span>
        <span className="model-meta-divider">·</span>
        <span className="model-meta-obs">
          {currentModelData.info.observationCount.toLocaleString()} obs
        </span>
      </div>
    </div>
  );
};

export default ModelToggle;
