import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

// Mock ResizeObserver for Recharts components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Clean up after each test to prevent memory leaks
afterEach(() => {
  localStorageMock.clear();
  
  // Clear any timers
  if (typeof global.gc === 'function') {
    global.gc();
  }
});
