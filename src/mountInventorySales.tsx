import React from 'react';
import ReactDOM from 'react-dom/client';
import { InventorySalesWorkbenchCard } from './components/InventorySales/InventorySalesWorkbenchCard';
import { EbaySandboxBackendConnectionPanel } from './components/InventorySales/EbaySandboxBackendConnectionPanel';
import { EbaySandboxMutationGatePanel } from './components/InventorySales/EbaySandboxMutationGatePanel';

const rootElement = document.getElementById('inventory-sales-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <InventorySalesWorkbenchCard />
      <div style={{ color: '#e2e8f0', padding: '0 20px 20px', maxWidth: 1380, margin: '0 auto' }}>
        <EbaySandboxBackendConnectionPanel />
        <EbaySandboxMutationGatePanel />
      </div>
    </React.StrictMode>
  );
}
