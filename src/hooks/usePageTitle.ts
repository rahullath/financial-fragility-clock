/**
 * usePageTitle — sets document title for the current page
 */

import { useEffect } from 'react';

const BASE_TITLE = 'Financial Fragility Clock';

export const usePageTitle = (pageTitle?: string) => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = pageTitle ? `${pageTitle} | ${BASE_TITLE}` : BASE_TITLE;
    
    return () => {
      document.title = prevTitle;
    };
  }, [pageTitle]);
};
