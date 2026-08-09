import React from 'react';
import ReactDOM from 'react-dom/client';
import { ShippingRouterCard } from './components/ShippingRouter/ShippingRouterCard';

const rootElement = document.getElementById('shipping-router-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ShippingRouterCard />
    </React.StrictMode>
  );
}
