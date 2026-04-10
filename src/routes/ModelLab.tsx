/**
 * ModelLab — /model
 * ML outputs: SHAP feature importance, model performance, crash probability.
 */

import React from 'react';
import SHAPChart from '../components/SHAPChart';
import ModelPerformanceTable from '../components/ModelPerformanceTable';

const PageHeader: React.FC = () => (
  <div className="page-header">
    <div className="page-header-title">
      <h1>ML Lab</h1>
      <p>SHAP feature importances · Model performance · Crash probability classifier</p>
    </div>
  </div>
);

const ModelLab: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <PageHeader />

    <div className="dash-row dash-row--bottom">
      <div className="dash-cell"><SHAPChart /></div>
      <div className="dash-cell"><ModelPerformanceTable /></div>
    </div>
  </div>
);

export default ModelLab;
