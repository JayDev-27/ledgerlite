import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Liquid-glass refraction needs SVG filters inside backdrop-filter (Chromium).
// Other engines keep the frosted material without the lens distortion.
try {
  const isChromium = Boolean((navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
    .userAgentData?.brands?.some((b) => b.brand === 'Chromium'));
  if (isChromium && CSS.supports('backdrop-filter', 'url(#lg-refract)')) {
    document.documentElement.classList.add('lg-refract');
  }
} catch {
  /* feature detection is best-effort */
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found in DOM');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
