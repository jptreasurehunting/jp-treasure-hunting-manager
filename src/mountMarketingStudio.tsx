import React from 'react';
import ReactDOM from 'react-dom/client';
import { MarketingStudioCard } from './components/MarketingStudio/MarketingStudioCard';

const rootElement = document.getElementById('marketing-studio-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <MarketingStudioCard />
    </React.StrictMode>
  );
}
