/**
 * Example usage of TutorialContext
 * 
 * This file demonstrates how to use the TutorialContext in components.
 * 
 * Requirements: 3.1, 3.6
 */

import React from 'react';
import { useTutorialContext } from './TutorialContext';

/**
 * Example component showing how to start the tutorial
 */
export const TutorialStartButton: React.FC = () => {
  const { startTutorial, isCompleted } = useTutorialContext();

  return (
    <button onClick={startTutorial}>
      {isCompleted ? 'Restart Tutorial' : 'Start Tutorial'}
    </button>
  );
};

/**
 * Example component showing tutorial navigation controls
 */
export const TutorialNavigationControls: React.FC = () => {
  const {
    isActive,
    currentStep,
    totalSteps,
    nextStep,
    previousStep,
    closeTutorial,
    completeTutorial,
  } = useTutorialContext();

  if (!isActive) {
    return null;
  }

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="tutorial-controls">
      <p>
        Step {currentStep + 1} of {totalSteps}
      </p>
      <div className="tutorial-buttons">
        <button onClick={previousStep} disabled={isFirstStep}>
          Previous
        </button>
        {isLastStep ? (
          <button onClick={completeTutorial}>Complete Tutorial</button>
        ) : (
          <button onClick={nextStep}>Next</button>
        )}
        <button onClick={closeTutorial}>Skip Tutorial</button>
      </div>
    </div>
  );
};

/**
 * Example component showing tutorial progress indicator
 */
export const TutorialProgressIndicator: React.FC = () => {
  const { isActive, currentStep, totalSteps } = useTutorialContext();

  if (!isActive) {
    return null;
  }

  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="tutorial-progress">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        />
      </div>
      <span className="progress-text">
        {currentStep + 1} / {totalSteps}
      </span>
    </div>
  );
};

/**
 * Example component showing how to jump to a specific step
 */
export const TutorialStepSelector: React.FC = () => {
  const { isActive, currentStep, totalSteps, goToStep } = useTutorialContext();

  if (!isActive) {
    return null;
  }

  return (
    <div className="tutorial-step-selector">
      <label htmlFor="step-select">Jump to step:</label>
      <select
        id="step-select"
        value={currentStep}
        onChange={(e) => goToStep(Number(e.target.value))}
      >
        {Array.from({ length: totalSteps }, (_, i) => (
          <option key={i} value={i}>
            Step {i + 1}
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * Example component showing tutorial completion status
 */
export const TutorialCompletionBadge: React.FC = () => {
  const { isCompleted, resetTutorial } = useTutorialContext();

  if (!isCompleted) {
    return null;
  }

  return (
    <div className="tutorial-completion-badge">
      <span>✓ Tutorial Completed</span>
      <button onClick={resetTutorial}>Reset</button>
    </div>
  );
};

/**
 * Example component showing conditional rendering based on tutorial state
 */
export const TutorialAwareComponent: React.FC = () => {
  const { isActive, currentStep } = useTutorialContext();

  return (
    <div className="dashboard-component">
      <h2>Dashboard Component</h2>
      {isActive && currentStep === 3 && (
        <div className="tutorial-highlight">
          This component is currently being explained in the tutorial!
        </div>
      )}
      <p>Component content goes here...</p>
    </div>
  );
};

/**
 * Example of a complete tutorial integration in a layout component
 */
export const LayoutWithTutorial: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isActive, isCompleted } = useTutorialContext();

  return (
    <div className={`layout ${isActive ? 'tutorial-active' : ''}`}>
      <header>
        <h1>Financial Fragility Clock</h1>
        <div className="header-controls">
          {!isCompleted && <TutorialStartButton />}
          {isCompleted && <TutorialCompletionBadge />}
        </div>
      </header>

      <main>
        {children}
        {isActive && (
          <div className="tutorial-overlay">
            <TutorialProgressIndicator />
            <TutorialNavigationControls />
          </div>
        )}
      </main>
    </div>
  );
};
