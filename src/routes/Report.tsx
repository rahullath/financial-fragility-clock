import React from 'react';
import { Link } from 'react-router-dom';

import ReportTab from '../components/tabs/ReportTab';
import { usePageTitle } from '../hooks/usePageTitle';
import './Report.css';

const Report: React.FC = () => {
  usePageTitle('Assignment Report');

  return (
    <div className="report-route">
      <header className="report-header">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
        <h1>Assignment Report</h1>
        <p>Structured answers for the Group 5 stock market analytics brief</p>
      </header>

      <main className="report-content">
        <ReportTab />
      </main>
    </div>
  );
};

export default Report;
