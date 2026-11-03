import { test, expect } from '@playwright/test';
import { trackErrors, gotoApp, expectNoBadText } from './helpers.js';

test('app shell loads every route with zero console errors', async ({ page }) => {
  const errors = trackErrors(page);
  await gotoApp(page, '#/');
  await expect(page.locator('.topbar .brand')).toBeVisible();
  for (const route of ['circuits', 'rc', 'capacitors', 'fields', '']) {
    await page.evaluate((r) => { location.hash = '#/' + r; }, route);
    await page.waitForFunction((r) => window.__emlab.stats().route === r, route);
    await expectNoBadText(page, route);
  }
  expect(errors).toEqual([]);
});
