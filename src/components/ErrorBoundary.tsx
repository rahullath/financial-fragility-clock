/**
 * ErrorBoundary — catches React errors and displays fallback UI
 */

import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="panel-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-error, #e74c3c)', marginBottom: '1rem' }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              style={{ width: 48, height: 48, margin: '0 auto' }}
            >
              <circle cx={12} cy={12} r={10} />
              <line x1={12} y1={8} x2={12} y2={12} />
              <line x1={12} y1={16} x2={12.01} y2={16} />
            </svg>
          </div>
          <h3 style={{ marginBottom: '0.5rem' }}>
            {this.props.componentName ? `${this.props.componentName} Error` : 'Component Error'}
          </h3>
          <p style={{ color: 'var(--color-text-secondary, #666)', marginBottom: '1rem' }}>
            Unable to load this component. Please refresh the page.
          </p>
          {this.state.error && (
            <details style={{ textAlign: 'left', fontSize: '0.875rem', color: '#999' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                Error details
              </summary>
              <pre style={{ overflow: 'auto', padding: '0.5rem', background: '#f5f5f5', borderRadius: 4 }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'var(--color-primary, #3498db)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
