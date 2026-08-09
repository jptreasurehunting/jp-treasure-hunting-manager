import React from 'react';
import ReactDOM from 'react-dom/client';
import { ShipmentReadinessCard } from './components/ShipmentReadiness/ShipmentReadinessCard';

const rootElement = document.getElementById('shipment-readiness-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ShipmentReadinessCard />
    </React.StrictMode>
  );
}
