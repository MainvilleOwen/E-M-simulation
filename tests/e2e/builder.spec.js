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
  // Changing a value does not restart the clock
  const clock = async () => parseFloat((await page.locator('.tc-clock').innerText()).replace(/[^\d.]/g, ''));
  p = await gridPoint(page, 7, 2.5);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('.inspector')).toContainText('Capacitor');
  await page.waitForTimeout(600);
  const t1 = await clock();
  await page.locator('.inspector input[type="range"]').first().evaluate((el) => { el.value = String(Number(el.max) / 2); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(400);
  expect(await clock()).toBeGreaterThan(t1);
  // Drag the bulb (column 4) one column right: it moves
  await page.locator('.seg', { hasText: 'Select' }).click();
  let a = await gridPoint(page, 4, 2.5);
  let b = await gridPoint(page, 6, 2.5);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, a.y, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
  await expect(page.locator('.inspector')).toContainText('Bulb');
  // Delete it with the Delete selected button
  await page.locator('.builder-delete').click();
  await expect(page.locator('.inspector')).toContainText('Choose Select');
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

test('builder: edits keep a paused circuit paused; pan and zoom work', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => { try { localStorage.removeItem('emlab.builder.v2'); } catch { /* */ } });
  await gotoApp(page, '#/builder');
  await page.waitForTimeout(600);
  const clock = async () => (await page.locator('.tc-clock').innerText());
  await page.locator('.tc-play').click(); // pause
  await expect(page.locator('.tc-play')).toHaveText('Play');
  const t0 = await clock();
  // Place a resistor and change a value while paused
  await page.locator('.seg', { hasText: 'Resistor' }).click();
  let p = await gridPoint(page, 1, 5); await page.mouse.click(p.x, p.y);
  p = await gridPoint(page, 4, 5); await page.mouse.click(p.x, p.y);
  await page.locator('.inspector input[type="range"]').first().evaluate((el) => { el.value = String(Number(el.max) / 3); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(500);
  await expect(page.locator('.tc-play')).toHaveText('Play');
  expect(await clock()).toBe(t0);
  await page.locator('.tc-play').click(); // play
  await page.waitForTimeout(500);
  expect(await clock()).not.toBe(t0);
  // Zoom in with the button: grid points spread apart, taps still select the right part
  const a = await gridPoint(page, 0, 0); const b = await gridPoint(page, 1, 0);
  await page.locator('.zoom-in').click();
  const a2 = await gridPoint(page, 0, 0); const b2 = await gridPoint(page, 1, 0);
  expect(b2.x - a2.x).toBeGreaterThan((b.x - a.x) * 1.3);
  await page.locator('.seg', { hasText: 'Select' }).click();
  p = await gridPoint(page, 7, 2.5); await page.mouse.click(p.x, p.y);
  await expect(page.locator('.inspector')).toContainText('Capacitor');
  // Pan by dragging empty space, then Fit resets
  const e = await gridPoint(page, 2, 3);
  await page.mouse.move(e.x, e.y); await page.mouse.down(); await page.mouse.move(e.x + 40, e.y + 20, { steps: 5 }); await page.mouse.up();
  const e2 = await gridPoint(page, 2, 3);
  expect(Math.round(e2.x - e.x)).toBe(40);
  await page.locator('.zoom-fit').click();
  const a3 = await gridPoint(page, 0, 0);
  expect(Math.abs(a3.x - a.x)).toBeLessThan(1);
  expect(errors).toEqual([]);
});
