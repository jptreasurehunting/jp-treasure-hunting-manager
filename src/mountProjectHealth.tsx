import React from 'react';
import ReactDOM from 'react-dom/client';
import { ProjectHealthDashboard } from './components/ProjectHealth/ProjectHealthDashboard';

const rootElement = document.getElementById('project-health-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ProjectHealthDashboard />
    </React.StrictMode>
  );
}
