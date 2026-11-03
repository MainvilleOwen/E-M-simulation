import { test, expect } from '@playwright/test';
import { trackErrors, gotoApp, expectNoBadText, sweepAll, walkSolve, shot } from './helpers.js';

test('kitchen sink: every component works with zero console errors', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await gotoApp(page, '#/kitchen-sink');
  await expect(page.locator('.circuit-view').first()).toBeVisible();
  await page.waitForTimeout(400);
  await expectNoBadText(page, 'initial');

  const n = await sweepAll(page, page.locator('#view'), 'kitchen sink');
  expect(n).toBeGreaterThanOrEqual(3);

  // Toggle and equation reveal
  await page.locator('.seg', { hasText: 'Off' }).click();
  await page.locator('.eq-btn').first().click();
  await expect(page.locator('.equation').first()).toBeVisible();
  await page.locator('.equation .sym').first().click();
  await expect(page.locator('.sym-hi').first()).toBeVisible();

  // Predict, then reveal
  const card = page.locator('.predict').first();
  await card.locator('.predict-opt', { hasText: 'Down' }).click();
  await expect(card.locator('.predict-why')).toBeVisible();
  await expect(card.locator('.predict-opt.correct')).toHaveText(/Up/);
  await expect(card.locator('.predict-status')).toContainText('The sim shows');

  // Solve runner
  await walkSolve(page, page.locator('.solve').first());

  // One frame loop for the whole page
  const stats = await page.evaluate(() => window.__emlab.stats());
  expect(stats.callbacks).toBeLessThanOrEqual(2);
  await page.waitForTimeout(800);
  await shot(page, 'phase2', 'kitchen-sink', testInfo);
  expect(errors).toEqual([]);
});
