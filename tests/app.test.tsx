import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../src/app/ThemeProvider';
import { routes } from '../src/app/router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.palette;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('app shell', () => {
  it('renders the landing page with a start link and the estimate note', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /estimate of how you reason/i,
    );
    const starts = screen.getAllByRole('link', { name: /start the test/i });
    expect(starts[0]).toHaveAttribute('href', '/setup');
    expect(screen.getByText(/an estimate, not a diagnosis/i)).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/couldn’t find/i);
  });

  it('switches mode and palette from the appearance menu and remembers them', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /appearance/i }));
    act(() => {
      fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
      fireEvent.click(screen.getByRole('radio', { name: 'Plum' }));
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.palette).toBe('plum');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('palette')).toBe('plum');

    act(() => {
      fireEvent.click(screen.getByRole('radio', { name: 'Auto' }));
    });
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('theme')).toBeNull();
  });
});
