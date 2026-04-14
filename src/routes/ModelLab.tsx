/**
 * ModelLab — /model
 * ML outputs: SHAP feature importance, model performance, crash probability.
 */

import React from 'react';
import SHAPChart from '../components/SHAPChart';
import ModelPerformanceTable from '../components/ModelPerformanceTable';
import FeatureImportanceTimeSeries from '../components/FeatureImportanceTimeSeries';
import LeadTimeAnalysis from '../components/LeadTimeAnalysis';
import MLModelComparison from '../components/MLModelComparison';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { usePageTitle } from '../hooks/usePageTitle';

const PageHeader: React.FC = () => (
  <div className="page-header">
    <div className="page-header-title">
      <h1>ML Lab</h1>
      <p>SHAP feature importances · Model performance · Crash probability classifier</p>
    </div>
  </div>
);

const ModelLab: React.FC = () => {
  usePageTitle('ML Lab');
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader />

      <ResponsiveContainer priority="high" mobileLayout="stack">
        <div className="dash-row dash-row--bottom">
          <div className="dash-cell"><SHAPChart /></div>
          <div className="dash-cell"><ModelPerformanceTable /></div>
        </div>
      </ResponsiveContainer>

      {/* Feature Importance Time Series */}
      <ResponsiveContainer priority="medium" mobileLayout="stack">
        <div className="dash-row dash-row--full">
          <FeatureImportanceTimeSeries />
        </div>
      </ResponsiveContainer>

      {/* ML Model Comparison */}
      <ResponsiveContainer priority="medium" mobileLayout="stack">
        <div className="dash-row dash-row--full">
          <MLModelComparison />
        </div>
      </ResponsiveContainer>

      {/* Lead Time Analysis */}
      <ResponsiveContainer priority="low" mobileLayout="collapse">
        <div className="dash-row dash-row--full">
          <LeadTimeAnalysis />
        </div>
      </ResponsiveContainer>
    </div>
  );
};

export default ModelLab;
