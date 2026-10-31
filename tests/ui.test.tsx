import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../src/app/ThemeProvider';
import { routes } from '../src/app/router';
import { BLUEPRINTS } from '../src/engine/assembly';
import { ageFromDateOfBirth } from '../src/features/test/age';
import { PRACTICE } from '../src/features/test/practice';
import { SECTION_SUMMARY } from '../src/features/test/sections';
import { AREA_LABELS } from '../src/shared/api';
import { peopleAged, percentileText, rangeText } from '../src/features/results/wording';

describe('age from date of birth', () => {
  const today = new Date(2026, 9, 31); // 31 Oct 2026
  it.each([
    ['2000-10-31', 26],
    ['2000-11-01', 25],
    ['2018-10-30', 8],
    ['2026-10-31', 0],
  ])('%s → %i', (dob, age) => expect(ageFromDateOfBirth(dob, today)).toBe(age));

  it('rejects impossible or future dates', () => {
    expect(ageFromDateOfBirth('2001-02-30', today)).toBeNull();
    expect(ageFromDateOfBirth('2030-01-01', today)).toBeNull();
    expect(ageFromDateOfBirth('31/10/2000', today)).toBeNull();
  });
});

describe('result wording', () => {
  it('describes the age group and range', () => {
    expect(peopleAged('25–34')).toBe('people aged 25–34');
    expect(peopleAged('age 10')).toBe('people aged 10');
    expect(rangeText({ low: 104, high: 120 })).toBe('likely between 104 and 120');
    expect(rangeText({ low: 145, high: 145 })).toBe('likely around 145');
  });

  it('phrases percentiles, including the extremes', () => {
    expect(percentileText({ percentile: 79.3 }, '25–34')).toBe(
      'Higher than about 79% of people aged 25–34.',
    );
    expect(percentileText({ percentile: 99.7 }, 'age 12')).toBe(
      'Higher than more than 99% of people aged 12.',
    );
    expect(percentileText({ percentile: 0.2 }, '75 and over')).toContain('lowest 1%');
  });
});

describe('setup screen', () => {
  it('lists the same sections and timings as the server blueprint', () => {
    for (const track of ['adult', 'junior'] as const) {
      expect(SECTION_SUMMARY[track].map(([, min]) => min)).toEqual(
        BLUEPRINTS[track].map((s) => s.seconds / 60),
      );
      expect(SECTION_SUMMARY[track].map(([name]) => name)).toEqual(
        BLUEPRINTS[track].map((s) => AREA_LABELS[s.area]),
      );
    }
  });

  it('has practice answers that point at real options', () => {
    for (const p of PRACTICE) expect(p.answer).toBeLessThan(p.content.options.length);
  });

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ takerToken: null, completedBefore: 0, previous: null }), {
        status: 200,
      }),
    );
  });

  const renderSetup = () =>
    render(
      <ThemeProvider>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/setup'] })} />
      </ThemeProvider>,
    );

  it('checks the age, names the track and leaves consent off by default', async () => {
    renderSetup();
    const consent = screen.getByRole('checkbox');
    expect(consent).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your age');

    const age = screen.getByLabelText('How old are you?');
    fireEvent.change(age, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ages 8 and over');

    fireEvent.change(age, { target: { value: '12' } });
    expect(screen.getByText(/Junior version/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/Practice question 1 of 2/)).toBeInTheDocument();
  });

  it('accepts a date of birth instead of an age', () => {
    renderSetup();
    fireEvent.click(screen.getByRole('button', { name: /date of birth instead/ }));
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute('type', 'date');
  });
});
