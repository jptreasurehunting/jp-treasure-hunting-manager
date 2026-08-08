import React from 'react';
import ReactDOM from 'react-dom/client';
import { OperationalKnowledgeCard } from './components/KnowledgeEngine/OperationalKnowledgeCard';

const rootElement = document.getElementById('operational-knowledge-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <OperationalKnowledgeCard />
    </React.StrictMode>
  );
}
