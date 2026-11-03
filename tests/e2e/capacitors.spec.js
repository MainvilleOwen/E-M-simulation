import { test, expect } from '@playwright/test';
import { trackErrors, gotoApp, expectNoBadText, sweepAll, walkSolve, shot } from './helpers.js';

const readout = (page, label) => page.locator('.readout', { hasText: label }).first().locator('dd');

test.describe('M3 Capacitors', () => {
  test('plate lab: connected locks V, disconnected locks Q and the work counter equals ΔU', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/capacitors/plates');
    await expect(readout(page, 'Capacitance')).toHaveText('3.54 nF');
    await expect(readout(page, 'Charge')).toHaveText('35.4 µC');
    await expect(readout(page, 'Field')).toHaveText('2.00 MV/m');
    const gap = page.locator('.view-plates input[type="range"]').nth(1);
    // Connected: widen the gap → V stays 10.0 kV, Q drops
    await gap.evaluate((el) => { el.value = '0.008'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(readout(page, 'Voltage')).toHaveText('10.0 kV');
    await expect(readout(page, 'Charge')).toHaveText('22.1 µC');
    await expect(page.locator('.why-note')).toContainText('flows back into the battery');
    await page.waitForTimeout(300);
    await shot(page, 'phase5', 'plates-connected', testInfo);
    // Disconnected: Q locked; widen → V grows, E constant
    await page.locator('.seg', { hasText: 'Disconnected' }).click();
    const E0 = await readout(page, 'Field').innerText();
    await gap.evaluate((el) => { el.value = '0.01'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(readout(page, 'Charge')).toHaveText('22.1 µC');
    await expect(readout(page, 'Field')).toHaveText(E0);
    await expect(readout(page, 'Voltage')).toHaveText('12.5 kV');
    const W = await readout(page, 'Work you did').innerText();
    const dU = await readout(page, 'Change in stored energy').innerText();
    expect(W).toBe(dU);
    await sweepAll(page, page.locator('.view-plates'), 'plates');
    await expectNoBadText(page, 'plates');
    expect(errors).toEqual([]);
  });

  test('plate lab clicker: C doubles with Q fixed, so V halves', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/capacitors/plates');
    await page.locator('.predict-opt', { hasText: 'It stays the same' }).click();
    await expect(page.locator('.predict-why')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('.predict-opt.correct')).toHaveText(/halves/);
    await expect(page.locator('.predict-why')).toContainText('10.0 kV → 5.00 kV');
    await shot(page, 'phase5', 'plates-clicker', testInfo);
    expect(errors).toEqual([]);
  });

  test('series and parallel charge to the slide answers (6 µF and 3 µF on 18 V)', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/capacitors/combos');
    await page.locator('.tc-play').click();
    await expect(readout(page, 'Q1')).toHaveText('36.0 µC', { timeout: 15000 });
    await expect(readout(page, 'Q2')).toHaveText('36.0 µC');
    await expect(readout(page, 'V1')).toHaveText('6.00 V');
    await expect(readout(page, 'V2')).toHaveText('12.0 V');
    await expect(readout(page, 'Island')).toHaveText('0.00 C');
    await expect(page.locator('.why-note')).toContainText('island');
    await shot(page, 'phase5', 'combos-series', testInfo);
    await page.locator('.seg', { hasText: 'Parallel' }).click();
    await page.locator('.tc-play').click();
    await expect(readout(page, 'Q1')).toHaveText('108 µC', { timeout: 15000 });
    await expect(readout(page, 'Q2')).toHaveText('54.0 µC');
    await expect(readout(page, 'C')).toHaveText('9.00 µF');
    await shot(page, 'phase5', 'combos-parallel', testInfo);
    await sweepAll(page, page.locator('.view-combos'), 'combos');
    await expectNoBadText(page, 'combos');
    expect(errors).toEqual([]);
  });

  test('charge sharing: 80 V, 38.4 mJ stored, the rest is heat', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/capacitors/sharing');
    await expect(readout(page, 'Energy before')).toHaveText('57.6 mJ');
    await page.locator('.tc-play').click();
    await expect(readout(page, 'V1')).toHaveText('80.0 V', { timeout: 20000 });
    await expect(readout(page, 'Energy stored now')).toHaveText('38.4 mJ');
    await expect(readout(page, 'Heat in the wire')).toHaveText(/19\.[12]\s*mJ/);
    await expect(page.locator('.why-note')).toContainText('dissipated in the connecting wire');
    await shot(page, 'phase5', 'sharing', testInfo);
    await sweepAll(page, page.locator('.view-sharing'), 'sharing');
    await expectNoBadText(page, 'sharing');
    expect(errors).toEqual([]);
  });

  test('solve: three problems walk to the end; variations check', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/capacitors/solve');
    const n = await page.locator('.mode-row .seg').count();
    expect(n).toBe(3);
    for (let i = 0; i < n; i++) {
      await page.locator('.mode-row .seg').nth(i).click();
      const scope = page.locator('.solve');
      for (let k = 0; k < 10 && await scope.locator('.solve-next').isVisible(); k++) {
        await scope.locator('.solve-next').click();
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(1200);
      await shot(page, 'phase5', `cap-solve-${i + 1}`, testInfo);
      await walkSolve(page, scope);
    }
    expect(errors).toEqual([]);
  });
});
