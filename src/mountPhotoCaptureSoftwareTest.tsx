import React from 'react';
import ReactDOM from 'react-dom/client';
import { PhotoCaptureSoftwareTestPanel } from './components/PhotoCapture/PhotoCaptureSoftwareTestPanel';

const rootElement = document.getElementById('photo-capture-self-test-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <PhotoCaptureSoftwareTestPanel />
    </React.StrictMode>
  );
}
