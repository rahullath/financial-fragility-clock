/**
 * App.tsx — root routing
 *
 * Provider hierarchy:
 *   ModelProvider → CrisisProvider → BrowserRouter
 *
 * Routes:
 *   /             → ClockLanding    (clock hero + stat strip)
 *   /dashboard    → DataRoom        (heatmaps, MST, correlations)
 *   /model        → ModelLab        (SHAP, performance, predictions)
 *   /history      → HistoryArchive  (annotated crisis timeline)
 *   /methods      → Methods         (theory + methodology)
 *   /present      → PresentationMode (no sidebar, fullscreen)
 *
 * All routes except /present are wrapped in <Layout> which includes
 * the toggleable sidebar and the status bar.
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { ModelProvider } from './contexts/ModelContext';
import { CrisisProvider } from './contexts/CrisisContext';
import { DateProvider } from './contexts/DateContext';

import Layout from './routes/Layout';
import ClockLanding from './routes/ClockLanding';
import DataRoom from './routes/DataRoom';
import ModelLab from './routes/ModelLab';
import HistoryArchive from './routes/HistoryArchive';
import Methods from './routes/Methods';
import PresentationMode from './routes/PresentationMode';

import './App.css';
import './styles/panels.patch.css';
import './styles/pages.css';

const App: React.FC = () => (
  <ModelProvider>
    <CrisisProvider>
      <DateProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Sidebar routes ───────────────────────────── */}
            <Route
              path="/"
              element={<Layout><ClockLanding /></Layout>}
            />
            <Route
              path="/dashboard"
              element={<Layout><DataRoom /></Layout>}
            />
            <Route
              path="/model"
              element={<Layout><ModelLab /></Layout>}
            />
            <Route
              path="/history"
              element={<Layout><HistoryArchive /></Layout>}
            />
            <Route
              path="/methods"
              element={<Layout><Methods /></Layout>}
            />

            {/* ── No sidebar ───────────────────────────────── */}
            <Route path="/present" element={<PresentationMode />} />
          </Routes>
        </BrowserRouter>
      </DateProvider>
    </CrisisProvider>
  </ModelProvider>
);

export default App;
