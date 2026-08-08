import React from 'react';
import ReactDOM from 'react-dom/client';
import { RuleFreshnessCard } from './components/RuleFreshness/RuleFreshnessCard';

const rootElement = document.getElementById('rule-freshness-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <RuleFreshnessCard />
    </React.StrictMode>
  );
}
