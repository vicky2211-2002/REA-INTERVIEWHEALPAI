import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Surface renderer errors on screen instead of a white screen
window.addEventListener('error', (e) => {
  const el = document.getElementById('root');
  if (el) {
    el.innerHTML = `<div style="padding:24px;font-family:monospace;color:#f87171;background:#1a1a2e;height:100vh;overflow:auto">
      <h2>Renderer Error</h2><pre>${String(e.message)}\n${String(e.error?.stack || '')}</pre></div>`;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const el = document.getElementById('root');
  if (el) {
    el.innerHTML = `<div style="padding:24px;font-family:monospace;color:#f87171;background:#1a1a2e;height:100vh;overflow:auto">
      <h2>Unhandled Promise Rejection</h2><pre>${String(e.reason?.stack || e.reason)}</pre></div>`;
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);