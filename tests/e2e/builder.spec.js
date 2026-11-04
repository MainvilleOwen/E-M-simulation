import { test, expect } from '@playwright/test';
import { trackErrors, gotoApp, expectNoBadText, sweepAll, shot } from './helpers.js';

async function gridPoint(page, c, r) {
  await page.locator('.stage-schematic canvas').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  return page.evaluate(([cc, rr]) => window.__emlab.builderPoint(cc, rr), [c, r]);
}

test('builder: example runs, place parts, select one and see its graphs', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => { try { localStorage.removeItem('emlab.builder.v2'); } catch { /* */ } });
  await gotoApp(page, '#/builder');
  await page.waitForTimeout(800);
  // Select the capacitor (column 7, rows 1–4)
  let p = await gridPoint(page, 7, 2.5);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('.inspector')).toContainText('Capacitor');
  await page.waitForTimeout(1200);
  await expect(page.locator('.builder-plots')).toBeVisible();
  await expect(page.locator('.inspector .readout', { hasText: 'Charge q' })).toBeVisible();
  await sweepAll(page, page.locator('.inspector'), 'inspector');
  await shot(page, 'builder', 'selected-capacitor', testInfo);
  // Switches: the Run card button and tapping the switch both flip it
  await expect(page.locator('.switch-row')).toContainText('closed');
  await page.locator('.switch-toggle').first().click();
  await expect(page.locator('.switch-row')).toContainText('open');
  p = await gridPoint(page, 3, 1);
  await page.locator('.seg', { hasText: 'Select' }).click();
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('.switch-row')).toContainText('closed');
  await expect(page.locator('.inspector-switch')).toHaveText('Open the switch');
  await page.locator('.inspector-switch').click();
  await expect(page.locator('.switch-row')).toContainText('open');
  await page.locator('.inspector-switch').click();
  // Place a resistor by tapping two points
  await page.locator('.seg', { hasText: 'Resistor' }).click();
  p = await gridPoint(page, 1, 5); await page.mouse.click(p.x, p.y);
  p = await gridPoint(page, 4, 5); await page.mouse.click(p.x, p.y);
  await expect(page.locator('.inspector')).toContainText('Resistor');
  // Delete it
  await page.locator('.seg', { hasText: 'Delete' }).click();
  p = await gridPoint(page, 2.5, 5); await page.mouse.click(p.x, p.y);
  await expect(page.locator('.inspector')).toContainText('Choose Select');
  // Clear and rebuild a simple loop with a battery and a bulb
  await page.locator('.builder-clear').click();
  await expect(page.locator('.stage-schematic .stage-problem')).toBeVisible();
  for (const [tool, a, b] of [['Battery', [1, 4], [1, 1]], ['Wire', [1, 1], [5, 1]], ['Bulb', [5, 1], [5, 4]], ['Wire', [5, 4], [1, 4]]]) {
    await page.locator('.seg', { hasText: tool }).first().click();
    p = await gridPoint(page, ...a); await page.mouse.click(p.x, p.y);
    p = await gridPoint(page, ...b); await page.mouse.click(p.x, p.y);
  }
  await page.locator('.seg', { hasText: 'Select' }).click();
  p = await gridPoint(page, 5, 2.5); await page.mouse.click(p.x, p.y);
  await expect(page.locator('.inspector')).toContainText('Bulb');
  await expect(page.locator('.inspector .readout', { hasText: 'Current through' }).locator('dd')).toHaveText(/900\s*mA/);
  await page.waitForTimeout(500);
  await expectNoBadText(page, 'builder');
  expect(errors).toEqual([]);
});
