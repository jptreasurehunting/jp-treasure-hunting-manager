import React from 'react';
import ReactDOM from 'react-dom/client';
import { ZonosCustomsMainContainer } from './components/ZonosCustomsMainContainer';

const rootElement = document.getElementById('zonos-customs-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ZonosCustomsMainContainer />
    </React.StrictMode>
  );
}
