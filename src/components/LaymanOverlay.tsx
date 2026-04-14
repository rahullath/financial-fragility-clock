/**
 * LaymanOverlay Component
 * 
 * Provides contextual, data-driven explanations in plain language.
 * Includes specific numerical values and interpretation of market conditions.
 * Avoids generic chart descriptions.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
 */

import React, { useState } from 'react';
import './LaymanOverlay.css';

interface LaymanOverlayProps {
  /** Function to generate explanation based on current data */
  explanationGenerator: () => string;
  /** Optional label for the trigger button */
  triggerLabel?: string;
  /** Optional CSS class for positioning the trigger */
  triggerClassName?: string;
}

/**
 * LaymanOverlay with integrated trigger button
 * 
 * The overlay generates fresh content each time it's opened, ensuring
 * explanations reflect the current date's data values.
 */
const LaymanOverlay: React.FC<LaymanOverlayProps> = ({ 
  explanationGenerator,
  triggerLabel = '?',
  triggerClassName = 'layman-overlay-trigger'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [explanation, setExplanation] = useState('');

  const handleOpen = () => {
    // Generate fresh explanation when opening
    const newExplanation = explanationGenerator();
    setExplanation(newExplanation);
    setIsVisible(true);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <>
      {/* Trigger button */}
      <button 
        className={triggerClassName}
        onClick={handleOpen}
        aria-label="Show explanation"
        title="Show plain-language explanation"
      >
        {triggerLabel}
      </button>

      {/* Overlay modal */}
      {isVisible && (
        <div 
          className="layman-overlay" 
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="layman-overlay-title"
        >
          <div className="layman-content" onClick={(e) => e.stopPropagation()}>
            <div className="layman-header">
              <h3 id="layman-overlay-title" className="layman-title">
                What does this mean?
              </h3>
              <button 
                className="layman-close" 
                onClick={handleClose} 
                aria-label="Close explanation"
              >
                ×
              </button>
            </div>
            <div className="layman-text">{explanation}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default LaymanOverlay;
