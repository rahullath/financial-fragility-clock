import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';

/**
 * TutorialContext value interface providing tutorial state management.
 * 
 * Requirements: 3.1, 3.6
 */
export interface TutorialContextValue {
  /** Whether the tutorial is currently active */
  isActive: boolean;
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of tutorial steps */
  totalSteps: number;
  /** Whether the tutorial has been completed */
  isCompleted: boolean;

  /** Start the tutorial from the beginning */
  startTutorial: () => void;
  /** Advance to the next step */
  nextStep: () => void;
  /** Go back to the previous step */
  previousStep: () => void;
  /** Jump to a specific step */
  goToStep: (step: number) => void;
  /** Close the tutorial without completing it */
  closeTutorial: () => void;
  /** Mark the tutorial as completed and close it */
  completeTutorial: () => void;
  /** Reset tutorial completion state */
  resetTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

interface TutorialProviderProps {
  children: ReactNode;
  /** Total number of tutorial steps (default: 8) */
  totalSteps?: number;
}

const TUTORIAL_STORAGE_KEY = 'tutorial_state';

/**
 * Tutorial state stored in localStorage
 */
interface TutorialState {
  isCompleted: boolean;
}

/**
 * Load tutorial state from localStorage with error handling
 */
const loadTutorialState = (): TutorialState => {
  try {
    const stored = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the structure
      if (typeof parsed.isCompleted === 'boolean') {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load tutorial state, resetting:', error);
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  }
  return { isCompleted: false };
};

/**
 * Save tutorial state to localStorage
 */
const saveTutorialState = (state: TutorialState): void => {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save tutorial state:', error);
  }
};

/**
 * TutorialContext Provider
 *
 * Manages tutorial state including active status, current step, and completion.
 * Persists completion state to localStorage for session persistence.
 *
 * Requirements: 3.1, 3.6
 */
export const TutorialProvider: React.FC<TutorialProviderProps> = ({
  children,
  totalSteps = 8,
}) => {
  // Load completion state from localStorage
  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    return loadTutorialState().isCompleted;
  });

  // Runtime state (not persisted)
  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Persist completion state changes to localStorage
  useEffect(() => {
    saveTutorialState({ isCompleted });
  }, [isCompleted]);

  /**
   * Start the tutorial from the beginning
   */
  const startTutorial = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
  }, []);

  /**
   * Advance to the next step
   */
  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1;
      // If we've reached the end, don't advance further
      return next < totalSteps ? next : prev;
    });
  }, [totalSteps]);

  /**
   * Go back to the previous step
   */
  const previousStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev - 1;
      // Don't go below 0
      return next >= 0 ? next : 0;
    });
  }, []);

  /**
   * Jump to a specific step
   */
  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step);
      } else {
        console.warn(
          `Invalid step ${step}. Must be between 0 and ${totalSteps - 1}`
        );
      }
    },
    [totalSteps]
  );

  /**
   * Close the tutorial without completing it
   */
  const closeTutorial = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  /**
   * Mark the tutorial as completed and close it
   */
  const completeTutorial = useCallback(() => {
    setIsCompleted(true);
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  /**
   * Reset tutorial completion state
   */
  const resetTutorial = useCallback(() => {
    setIsCompleted(false);
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  const value: TutorialContextValue = {
    isActive,
    currentStep,
    totalSteps,
    isCompleted,
    startTutorial,
    nextStep,
    previousStep,
    goToStep,
    closeTutorial,
    completeTutorial,
    resetTutorial,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

/**
 * Hook to access TutorialContext.
 * Must be used inside a <TutorialProvider>.
 */
export const useTutorialContext = (): TutorialContextValue => {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorialContext must be used within a TutorialProvider');
  }
  return ctx;
};

export default TutorialContext;
