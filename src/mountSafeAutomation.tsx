import React from 'react';
import ReactDOM from 'react-dom/client';
import { SafeAutomationPolicyCard } from './components/SafeAutomation/SafeAutomationPolicyCard';

const rootElement = document.getElementById('safe-automation-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <SafeAutomationPolicyCard />
    </React.StrictMode>
  );
}
