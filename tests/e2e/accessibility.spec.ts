import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { isDesktop, setUp, takeTest } from './helpers';

const audit = async (page: Page, where: string) => {
  // Measure what people read: wait for entrance animations (not looping ones) to finish.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${where}: ${v.id} (${v.impact}) ×${v.nodes.length} ${v.nodes[0]?.target.join(' ')}`,
  );
  expect(summary).toEqual([]);
};

test('every screen passes an automated WCAG 2.2 AA audit', async ({ page }) => {
  await page.goto('/');
  await audit(page, 'landing');
  await page.getByRole('button', { name: 'Appearance' }).click();
  await audit(page, 'appearance menu');
  await page.keyboard.press('Escape');
  await page.goto('/privacy');
  await audit(page, 'privacy');

  await page.goto('/setup');
  await page.getByLabel('How old are you?').fill('12');
  await audit(page, 'setup');

  await setUp(page, 12);
  await audit(page, 'test');
  await takeTest(page);
  await audit(page, 'results');
});

test('every control on the test screen is at least 44px for touch', async ({ page }) => {
  test.skip(isDesktop(page), 'touch targets are checked at phone width');
  await setUp(page, 30);
  for (let q = 0; q < 26; q++) {
    // Check a question of each kind as the test moves through the sections.
    if (q % 8 === 0 || q % 8 === 4) {
      const controls = page.locator('main button, main a');
      for (let i = 0; i < (await controls.count()); i++) {
        const box = await controls.nth(i).boundingBox();
        if (!box) continue;
        expect
          .soft(Math.min(box.width, box.height), await controls.nth(i).innerText())
          .toBeGreaterThanOrEqual(44);
      }
    }
    await page.getByRole('button', { name: 'Skip' }).tap();
    await expect(page.getByRole('region', { name: `Question ${q + 2} of 32` })).toBeFocused();
  }
});

test('the test can be run with the keyboard alone, and focus follows each new question', async ({
  page,
}) => {
  test.skip(!isDesktop(page), 'keyboard flow is checked on desktop');
  await setUp(page, 30);
  await expect(page.getByText('Question 1 of 32', { exact: true })).toBeVisible();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Question 2 of 32' })).toBeFocused();
});

test('respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const duration = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--duration-slow').trim(),
  );
  expect(duration).toBe('0ms');
});
