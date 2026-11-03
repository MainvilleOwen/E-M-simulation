import { test, expect } from '@playwright/test';
import { trackErrors, gotoApp } from './helpers.js';

test('rapid module switching leaves no errors and no duplicated loops', async ({ page }) => {
  const errors = trackErrors(page);
  await gotoApp(page, '#/');
  const routes = ['circuits', 'rc', 'capacitors', 'fields', 'circuits/parallel', 'circuits/kirchhoff', ''];
  for (let i = 0; i < 10; i++) {
    for (const r of routes) {
      await page.evaluate((h) => { location.hash = '#/' + h; }, r);
      await page.waitForTimeout(30);
    }
  }
  await page.evaluate(() => { location.hash = '#/circuits/parallel'; });
  await page.waitForFunction(() => document.querySelector('.view-parallel'));
  await page.waitForTimeout(500);
  const stats = await page.evaluate(() => window.__emlab.stats());
  expect(stats.callbacks).toBeLessThanOrEqual(2);
  const f0 = stats.frames;
  await page.waitForTimeout(500);
  const f1 = (await page.evaluate(() => window.__emlab.stats())).frames;
  // One shared rAF loop: about 30 frames in 0.5 s, never doubled
  expect(f1 - f0).toBeLessThan(45);
  expect(errors).toEqual([]);
});
