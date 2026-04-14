/**
 * TutorialOverlay - Interactive guided tour component
 * 
 * Provides a semi-transparent overlay with spotlight effect on target components,
 * positioned tooltips with step content, navigation controls, and keyboard support.
 * 
 * Requirements: 3.2, 3.3, 3.5, 3.7
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTutorialContext } from '../contexts/TutorialContext';
import './TutorialOverlay.css';

export interface TutorialStep {
  id: string;
  targetSelector: string; // CSS selector for component to highlight
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
}

/**
 * Calculate tooltip position based on target element and desired position
 */
const calculateTooltipPosition = (
  targetRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  position: 'top' | 'bottom' | 'left' | 'right'
): { top: number; left: number } => {
  const spacing = 20; // Gap between tooltip and target
  
  let top = 0;
  let left = 0;

  switch (position) {
    case 'top':
      top = targetRect.top - tooltipHeight - spacing;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      break;
    case 'bottom':
      top = targetRect.bottom + spacing;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      break;
    case 'left':
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.left - tooltipWidth - spacing;
      break;
    case 'right':
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.right + spacing;
      break;
  }

  // Keep tooltip within viewport bounds
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 10;

  if (left < padding) left = padding;
  if (left + tooltipWidth > viewportWidth - padding) {
    left = viewportWidth - tooltipWidth - padding;
  }
  if (top < padding) top = padding;
  if (top + tooltipHeight > viewportHeight - padding) {
    top = viewportHeight - tooltipHeight - padding;
  }

  return { top, left };
};

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ steps }) => {
  const {
    isActive,
    currentStep,
    nextStep,
    previousStep,
    closeTutorial,
    completeTutorial,
  } = useTutorialContext();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  /**
   * Update spotlight and tooltip position when step changes
   */
  const updatePositions = useCallback(() => {
    if (!currentStepData || !isActive) return;

    const targetElement = document.querySelector(currentStepData.targetSelector);
    if (!targetElement) {
      console.warn(`Tutorial target not found: ${currentStepData.targetSelector}`);
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    setTargetRect(rect);

    // Calculate tooltip position after a brief delay to ensure tooltip is rendered
    setTimeout(() => {
      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const position = calculateTooltipPosition(
          rect,
          tooltipRect.width,
          tooltipRect.height,
          currentStepData.position
        );
        setTooltipPosition(position);
      }
    }, 0);
  }, [currentStepData, isActive]);

  /**
   * Handle keyboard navigation
   * Requirements: 3.5, 3.7
   */
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          if (!isLastStep) nextStep();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          if (!isFirstStep) previousStep();
          break;
        case 'Escape':
          e.preventDefault();
          closeTutorial();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isLastStep, isFirstStep, nextStep, previousStep, closeTutorial]);

  /**
   * Update positions when step changes or window resizes
   */
  useEffect(() => {
    if (!isActive) return;

    updatePositions();

    const handleResize = () => updatePositions();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true); // Capture phase for all scrolls

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isActive, currentStep, updatePositions]);

  /**
   * Handle next button click
   */
  const handleNext = () => {
    if (isLastStep) {
      completeTutorial();
    } else {
      nextStep();
    }
  };

  if (!isActive) return null;

  return (
    <div className="tutorial-overlay" role="dialog" aria-label="Interactive tutorial">
      {/* Semi-transparent backdrop */}
      <div className="tutorial-backdrop" onClick={closeTutorial} />

      {/* Spotlight effect on target component */}
      {targetRect && (
        <div
          className="tutorial-spotlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip with step content */}
      {currentStepData && (
        <div
          ref={tooltipRef}
          className={`tutorial-tooltip tutorial-tooltip--${currentStepData.position}`}
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
          role="article"
          aria-live="polite"
        >
          {/* Header */}
          <div className="tutorial-tooltip-header">
            <h2 className="tutorial-tooltip-title">{currentStepData.title}</h2>
            <button
              className="tutorial-tooltip-close"
              onClick={closeTutorial}
              aria-label="Close tutorial"
              title="Close tutorial (Esc)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1={18} y1={6} x2={6} y2={18} />
                <line x1={6} y1={6} x2={18} y2={18} />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="tutorial-tooltip-content">
            <p>{currentStepData.content}</p>
          </div>

          {/* Footer with navigation */}
          <div className="tutorial-tooltip-footer">
            <div className="tutorial-progress">
              <span className="tutorial-progress-text">
                Step {currentStep + 1} of {steps.length}
              </span>
              <div className="tutorial-progress-dots" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={steps.length}>
                {steps.map((_, index) => (
                  <span
                    key={index}
                    className={`tutorial-progress-dot ${index === currentStep ? 'tutorial-progress-dot--active' : ''} ${index < currentStep ? 'tutorial-progress-dot--completed' : ''}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>

            <div className="tutorial-nav-buttons">
              <button
                className="tutorial-button tutorial-button--secondary"
                onClick={closeTutorial}
                title="Skip tutorial (Esc)"
              >
                Skip Tutorial
              </button>

              {!isFirstStep && (
                <button
                  className="tutorial-button tutorial-button--secondary"
                  onClick={previousStep}
                  title="Previous step (Arrow Left)"
                >
                  Previous
                </button>
              )}

              <button
                className="tutorial-button tutorial-button--primary"
                onClick={handleNext}
                title={isLastStep ? 'Complete tutorial' : 'Next step (Arrow Right)'}
              >
                {isLastStep ? 'Complete' : 'Next'}
              </button>
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="tutorial-keyboard-hints">
            <span className="tutorial-hint">
              <kbd>←</kbd> <kbd>→</kbd> Navigate
            </span>
            <span className="tutorial-hint">
              <kbd>Esc</kbd> Close
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialOverlay;
