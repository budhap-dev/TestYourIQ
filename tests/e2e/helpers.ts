import { expect, type Page } from '@playwright/test';

export const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1000;

/** The question a person sees, ignoring option order (mirrors the server's fingerprint). */
export function fingerprint(content: {
  kind: string;
  format?: string;
  options: unknown[];
}): string {
  const { options, ...stem } = content;
  return content.kind === 'verbal' && content.format === 'odd-one-out'
    ? JSON.stringify({ ...stem, words: [...(options as string[])].sort() })
    : JSON.stringify(stem);
}

/** Records every /api JSON response body on the page. */
export function recordApi(page: Page): {
  bodies: string[];
  contents: () => { kind: string; options: unknown[] }[];
} {
  const bodies: string[] = [];
  page.on('response', async (res) => {
    if (!res.url().includes('/api/')) return;
    try {
      bodies.push(await res.text());
    } catch {
      // Navigation can discard a body; nothing to record.
    }
  });
  return {
    bodies,
    contents: () =>
      bodies.flatMap((b) => {
        const data = JSON.parse(b) as {
          next?: { item: { content: { kind: string; options: unknown[] } } };
        };
        return data.next ? [data.next.item.content] : [];
      }),
  };
}

/** Activate a control by keyboard on desktop, by tap on mobile. */
async function press(page: Page, name: string | RegExp) {
  const exact = typeof name === 'string';
  const control = page
    .getByRole('button', { name, exact })
    .or(page.getByRole('link', { name, exact }))
    .first();
  if (isDesktop(page)) {
    await control.focus();
    await page.keyboard.press('Enter');
  } else {
    await control.tap();
  }
}

/** Choose an option: number key + Enter on desktop, tap + Confirm/Check on mobile. */
async function choose(page: Page, n: number, confirmName: string) {
  if (isDesktop(page)) {
    await page.keyboard.press(String(n));
    await page.keyboard.press('Enter');
  } else {
    await page.getByRole('button', { name: new RegExp(`^Option ${n}:`) }).tap();
    await page.getByRole('button', { name: confirmName }).tap();
  }
}

export async function setUp(page: Page, age: number, { consent = false } = {}) {
  await page.goto('/');
  await press(page, 'Start the test');
  await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
  await page.getByLabel('How old are you?').fill(String(age));
  if (consent) await page.getByRole('checkbox').check();
  await press(page, 'Continue');

  await expect(page.getByText('Practice question 1 of 2')).toBeVisible();
  await choose(page, 2, 'Check answer');
  await expect(page.getByText('That’s right.')).toBeVisible();
  await press(page, 'Next practice question');
  await choose(page, 1, 'Check answer');
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await press(page, 'I’m ready');
  await press(page, 'Start the test');
}

/** Answer all 32 questions, skipping every seventh. */
export async function takeTest(page: Page) {
  for (let q = 1; q <= 32; q++) {
    await expect(page.getByText(`Question ${q} of 32`, { exact: true })).toBeVisible();
    // Focus moves to each new question once it renders; act after that, as a person would.
    if (q > 1)
      await expect(page.getByRole('region', { name: `Question ${q} of 32` })).toBeFocused();
    if (q % 7 === 0) {
      await press(page, 'Skip');
      continue;
    }
    const count = await page.getByRole('button', { name: /^Option \d+:/ }).count();
    await choose(page, 1 + (q % count), 'Confirm');
  }
  await expect(page.getByText('Estimated IQ')).toBeVisible({ timeout: 15_000 });
}
