import { expect, test } from '@playwright/test';
import { fingerprint, recordApi, setUp, takeTest } from './helpers';

test('takes the whole test and shows a complete result', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setUp(page, 30, { consent: true });
  await expect(page.getByText('Patterns · Section 1 of 4')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText(/^\d+:\d\d$/);
  await takeTest(page);

  await expect(page.getByRole('heading', { name: /Estimated IQ/ })).toBeVisible();
  await expect(page.getByText(/^likely (between \d+ and \d+|around \d+)$/)).toBeVisible();
  // Wording varies at the extremes ("around the lowest 1%"), but always names the age group.
  await expect(page.getByText(/people aged 25–34/).first()).toBeVisible();
  await expect(page.getByText('Calibrating: early estimate')).toBeVisible();
  await expect(page.getByRole('img', { name: /Bell curve of scores/ })).toBeVisible();
  for (const area of ['Patterns', 'Numbers', 'Shapes', 'Words']) {
    await expect(page.getByRole('listitem').filter({ hasText: area })).toContainText(/average/i);
  }
  await expect(page.getByText('An estimate, not a diagnosis')).toBeVisible();

  // Results survive a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: /Estimated IQ/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
  expect(errors).toEqual([]);
});

test('a retake from the same browser shows no repeated question and no answers on the wire', async ({
  page,
}) => {
  const api = recordApi(page);
  await setUp(page, 41);
  await takeTest(page);
  const first = api.contents().map(fingerprint);
  expect(first).toHaveLength(32);

  await setUp(page, 41);
  await expect(page.getByText('You’ve taken this test before')).toHaveCount(0); // shown on setup, not during the test
  await takeTest(page);
  await expect(page.getByText('This was a retake')).toBeVisible();
  const second = api.contents().map(fingerprint).slice(first.length);
  expect(second).toHaveLength(32);
  expect(second.filter((f) => first.includes(f))).toEqual([]);

  for (const body of api.bodies) {
    expect(body).not.toMatch(/answerIndex|"gen:|"bank:|formSeed|itemKey|explanation/);
  }
});

test('setup tells a returning test-taker they have taken the test before', async ({ page }) => {
  await setUp(page, 52);
  await takeTest(page);
  await page.goto('/setup');
  await expect(page.getByText('You’ve taken this test before')).toBeVisible();
  await expect(page.getByText(/You’ll get new questions/)).toBeVisible();
});
