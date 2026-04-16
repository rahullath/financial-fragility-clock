/**
 * App.tsx — Router root.
 * Layout wraps all routes. Old Sidebar component is replaced by Layout.tsx sidebar.
 */
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './routes/Layout';
import ClockLanding   from './routes/ClockLanding';
import Dashboard      from './routes/Dashboard';
import ModelLab       from './routes/ModelLab';
import CrisisLog      from './routes/CrisisLog';
import Methodology    from './routes/Methodology';
import Report         from './routes/Report';

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route index          element={<ClockLanding />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="model"     element={<ModelLab />} />
        <Route path="history"   element={<CrisisLog />} />
        <Route path="methods"   element={<Methodology />} />
        <Route path="report"    element={<Report />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
