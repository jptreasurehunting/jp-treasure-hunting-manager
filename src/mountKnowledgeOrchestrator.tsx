import React from 'react';
import ReactDOM from 'react-dom/client';
import { KnowledgeOrchestratorCard } from './components/KnowledgeOrchestrator/KnowledgeOrchestratorCard';

const rootElement = document.getElementById('knowledge-orchestrator-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <KnowledgeOrchestratorCard />
    </React.StrictMode>
  );
}
