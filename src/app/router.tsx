import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from './Layout';
import { Landing } from './routes/Landing';
import { NotFound } from './routes/NotFound';
import { Privacy } from './routes/Privacy';
import { ResultsPage } from './routes/ResultsPage';
import { Setup } from './routes/Setup';
import { TestPage } from './routes/TestPage';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'setup', element: <Setup /> },
      { path: 'test/:attemptId', element: <TestPage /> },
      { path: 'results/:attemptId', element: <ResultsPage /> },
      { path: 'privacy', element: <Privacy /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
