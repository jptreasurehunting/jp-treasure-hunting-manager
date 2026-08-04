import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrandAssetManagerCard } from './components/BrandAsset/BrandAssetManagerCard';

const rootElement = document.getElementById('brand-asset-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrandAssetManagerCard />
    </React.StrictMode>
  );
}
