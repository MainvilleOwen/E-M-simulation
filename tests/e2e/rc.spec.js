import { test, expect } from '@playwright/test';
import { trackErrors, gotoApp, expectNoBadText, sweepAll, walkSolve, shot } from './helpers.js';

test.describe('M2 RC circuits', () => {
  test('charging and discharging labs run, sliders replay with a ghost, no bad text', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    for (const v of ['charging', 'discharging']) {
      await gotoApp(page, `#/rc/${v}`);
      await expect(page.locator('.plot')).toHaveCount(3);
      await expectNoBadText(page, `${v} initial`);
      await page.locator('.tc-play').click();
      await page.waitForTimeout(1500);
      const frac = await page.locator('.readout', { hasText: 'q as %' }).locator('dd').innerText();
      const pct = parseFloat(frac);
      if (v === 'charging') expect(pct).toBeGreaterThan(20); else expect(pct).toBeLessThan(80);
      await page.locator('.seg', { hasText: '4×' }).click();
      await page.waitForTimeout(800);
      await shot(page, 'phase4', `rc-${v}`, testInfo);
      await sweepAll(page, page.locator(`.view-${v}`), v);
      await page.waitForTimeout(600);
      await expect(page.locator('.why-note')).toContainText(/Bigger|Smaller/);
      await expectNoBadText(page, `${v} after sweep`);
      await page.locator('.tc-reset').click();
      await expect(page.locator('.tc-play')).toHaveText('Play');
    }
    expect(errors).toEqual([]);
  });

  test('a run reaches 5τ and stops; the charge is about Cε', async ({ page }) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/rc/charging');
    // Smallest τ: 5 kΩ × 50 µF = 0.25 s, 5τ = 1.25 s
    await page.locator('#view input[type="range"]').nth(0).evaluate((el) => { el.value = el.min; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#view input[type="range"]').nth(1).evaluate((el) => { el.value = el.min; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(2500);
    await expect(page.locator('.tc-play')).toHaveText('Play');
    const pct = parseFloat(await page.locator('.readout', { hasText: 'q as %' }).locator('dd').innerText());
    expect(pct).toBeGreaterThan(99);
    expect(errors).toEqual([]);
  });

  test('solve: both slide examples walk to the end; variations check', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/rc/solve');
    const n = await page.locator('.mode-row .seg').count();
    expect(n).toBe(2);
    for (let i = 0; i < n; i++) {
      await page.locator('.mode-row .seg').nth(i).click();
      const scope = page.locator('.solve');
      // Walk the worked solution with pauses so the sim actions run
      for (let k = 0; k < 10 && await scope.locator('.solve-next').isVisible(); k++) {
        await scope.locator('.solve-next').click();
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(800);
      await shot(page, 'phase4', `rc-solve-${i + 1}`, testInfo);
      await expectNoBadText(page, `rc solve ${i + 1}`);
      await walkSolve(page, scope);
    }
    expect(errors).toEqual([]);
  });
});
