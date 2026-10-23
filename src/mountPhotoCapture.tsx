import React from 'react';
import ReactDOM from 'react-dom/client';
import { PhotoCaptureCard } from './components/PhotoCapture/PhotoCaptureCard';

const rootElement = document.getElementById('photo-capture-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <PhotoCaptureCard />
    </React.StrictMode>
  );
}
