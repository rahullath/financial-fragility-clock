/**
 * ResponsiveContainer.tsx
 * 
 * Wraps components to handle mobile responsive behavior.
 * Detects screen width, applies mobile styles, reorders by priority,
 * and handles orientation changes with debouncing.
 * 
 * Requirements: 10.1, 10.5, 10.6
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import './ResponsiveContainer.css';

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  breakpoint?: number; // px (default: 768)
  mobileLayout?: 'stack' | 'scroll' | 'collapse';
  priority?: 'high' | 'medium' | 'low'; // for mobile view ordering
  className?: string;
  testId?: string;
}

const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  breakpoint = 768,
  mobileLayout = 'stack',
  priority = 'medium',
  className = '',
  testId,
}) => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);

  // Screen width detection
  const checkScreenWidth = useCallback(() => {
    const width = window.innerWidth;
    setIsMobile(width < breakpoint);
  }, [breakpoint]);

  // Debounced resize handler for orientation changes
  const handleResize = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      checkScreenWidth();
    }, 100); // 100ms debounce
  }, [checkScreenWidth]);

  // Initial check and event listeners
  useEffect(() => {
    checkScreenWidth();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [checkScreenWidth, handleResize]);

  // Toggle collapse for collapsible mobile layout
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Build class names
  const containerClasses = [
    'responsive-container',
    isMobile ? 'responsive-container--mobile' : 'responsive-container--desktop',
    `responsive-container--layout-${mobileLayout}`,
    `responsive-container--priority-${priority}`,
    isCollapsed && mobileLayout === 'collapse' ? 'responsive-container--collapsed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div 
      className={containerClasses}
      data-testid={testId || 'responsive-container'}
      data-mobile={isMobile}
      data-priority={priority}
    >
      {mobileLayout === 'collapse' && isMobile && (
        <button
          className="responsive-container__toggle"
          onClick={toggleCollapse}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      )}
      
      <div className="responsive-container__content">
        {children}
      </div>
    </div>
  );
};

export default ResponsiveContainer;
