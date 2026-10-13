import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
// Canvas signage is baked once. Load its bundled type before constructing the
// scene, with a short fallback deadline so a font failure never hides the app.
let fontDeadline: ReturnType<typeof setTimeout>;
void Promise.race([
  document.fonts.load('16px "Kalam"').catch(() => []),
  new Promise(resolve => { fontDeadline = setTimeout(resolve, 500); }),
]).finally(() => {
  clearTimeout(fontDeadline);
  createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
});
