
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DateProvider } from './contexts/DateContext';
import { ModelProvider } from './contexts/ModelContext';

import Dashboard from './routes/Dashboard';
import PresentationMode from './routes/PresentationMode';
import Methods from './routes/Methods';
import './App.css';

/**
 * Root App — provides model context globally.
 * DateProvider wraps the Dashboard to manage the interactive date scrubbing.
 * PresentationMode manages its own isolated DateProvider for slide snapshots.
 */
function App() {
  return (
    <ModelProvider>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              <DateProvider>
                <Dashboard />
              </DateProvider>
            } 
          />
          <Route path="/present" element={<PresentationMode />} />
          <Route path="/methods" element={<Methods />} />
        </Routes>
      </BrowserRouter>
    </ModelProvider>
  );
}

export default App;
