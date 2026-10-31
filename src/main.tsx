import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ThemeProvider } from './app/ThemeProvider';
import { createRouter } from './app/router';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={createRouter()} />
    </ThemeProvider>
  </StrictMode>,
);
