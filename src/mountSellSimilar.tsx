import React from 'react';
import ReactDOM from 'react-dom/client';
import { SellSimilarLauncher } from './components/SellSimilar/SellSimilarLauncher';

const rootElement = document.getElementById('sell-similar-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <SellSimilarLauncher />
    </React.StrictMode>
  );
}
