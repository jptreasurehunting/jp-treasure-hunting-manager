import React from 'react';
import ReactDOM from 'react-dom/client';
import { InventorySalesWorkbenchCard } from './components/InventorySales/InventorySalesWorkbenchCard';

const rootElement = document.getElementById('inventory-sales-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <InventorySalesWorkbenchCard />
    </React.StrictMode>
  );
}
