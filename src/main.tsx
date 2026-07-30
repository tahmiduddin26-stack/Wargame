import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';
import './styles/ui.css';
import './styles/hud.css';
// Last on purpose. The reduced-motion block overrides transitions declared in
// hud.css and ui.css at equal specificity, so it has to win on order.
import './styles/motion.css';

const host = document.getElementById('root');
if (!host) throw new Error('Missing #root');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
