import React from 'react';
import ReactDOM from 'react-dom/client';
import { ZonosCustomsValidator } from './components/ZonosCustoms/ZonosCustomsValidator';

const rootElement = document.getElementById('zonos-customs-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ZonosCustomsValidator />
    </React.StrictMode>
  );
}
