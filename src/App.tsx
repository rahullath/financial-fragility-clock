
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DateProvider } from './contexts/DateContext';
import { ModelProvider } from './contexts/ModelContext';
import { CrisisProvider } from './contexts/CrisisContext';

import Dashboard from './routes/Dashboard';
import PresentationMode from './routes/PresentationMode';
import Methods from './routes/Methods';
import './App.css';
import './styles/panels.patch.css';

/**
 * Root App
 *
 * Provider hierarchy (outermost → innermost):
 *   ModelProvider   — model A/B selection, JSON data
 *   CrisisProvider  — which reference crises are selected (shared by clock,
 *                     stat strip, timeline, and CrisisSelector chip UI)
 *   DateProvider    — selected scrubber date (per-route)
 *   Dashboard / PresentationMode / Methods
 */
function App() {
  return (
    <ModelProvider>
      <CrisisProvider>
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
      </CrisisProvider>
    </ModelProvider>
  );
}

export default App;
