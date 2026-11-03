import { test, expect } from '@playwright/test';
import { trackErrors, gotoApp, expectNoBadText, sweepAll, walkSolve, shot } from './helpers.js';

const VIEWS = ['one', 'series', 'parallel', 'combination', 'bulbs', 'kirchhoff', 'solve'];

test.describe('M1 Circuits', () => {
  test('every view loads, every slider sweeps, no bad text, no console errors', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/circuits');
    for (const v of VIEWS) {
      await page.locator(`.tab[data-view="${v}"]`).click();
      await expect(page.locator(`.view-${v}`)).toBeVisible();
      await page.waitForTimeout(250);
      await expectNoBadText(page, v);
      await sweepAll(page, page.locator(`.view-${v}`), v);
      await page.waitForTimeout(300);
      await shot(page, 'phase3', `circuits-${v}`, testInfo);
    }
    expect(errors).toEqual([]);
  });

  test('parallel compare: predict, then reveal', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/circuits/parallel');
    await expect(page.locator('.compare')).toBeVisible();
    const card = page.locator('.predict');
    await card.locator('.predict-opt', { hasText: 'The same' }).click();
    await expect(card.locator('.predict-why')).toBeVisible({ timeout: 5000 });
    await expect(card.locator('.predict-why')).toContainText('second lane');
    await expect(page.locator('.readouts')).toContainText('6.00');
    await expect(page.locator('.readouts')).toContainText('2.00');
    await expect(page.locator('.junction-box')).toContainText('in 6.00');
    await page.waitForTimeout(500);
    await shot(page, 'phase3', 'circuits-parallel-revealed', testInfo);
    // Ask again resets
    await card.locator('.predict-again').click();
    await expect(card.locator('.predict-opt').first()).toBeEnabled();
    // Single mode
    await page.locator('.seg', { hasText: 'Parallel only' }).click();
    await expect(page.locator('.compare')).toHaveCount(0);
    await expectNoBadText(page, 'parallel single');
    expect(errors).toEqual([]);
  });

  test('series compare and bulbs predictions', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/circuits/series');
    await page.locator('.seg', { hasText: 'Compare A and B' }).click();
    await page.locator('.predict .predict-opt', { hasText: 'Smaller' }).click();
    await expect(page.locator('.predict-why')).toContainText('1.33');
    await gotoApp(page, '#/circuits/bulbs');
    const cards = page.locator('.predict');
    await cards.nth(0).locator('.predict-opt', { hasText: 'Brighter' }).click();
    await expect(cards.nth(0).locator('.predict-why')).toContainText('not used up');
    await cards.nth(1).locator('.predict-opt', { hasText: 'Brighter' }).click();
    await expect(cards.nth(1).locator('.predict-why')).toContainText('4 times');
    await expect(page.locator('.bulb-part').nth(1).locator('.readouts')).toContainText('4.00×');
    await page.waitForTimeout(500);
    await shot(page, 'phase3', 'circuits-bulbs-revealed', testInfo);
    expect(errors).toEqual([]);
  });

  test('combination: reduce step by step and expand back', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/circuits/combination');
    const next = page.locator('.reduce-next');
    const text = page.locator('.reduce-text');
    await next.click();
    await expect(text).toContainText('12.0');
    await page.waitForTimeout(1600);
    await next.click();
    await expect(text).toContainText('2.00');
    await page.waitForTimeout(1600);
    await next.click();
    await expect(text).toContainText('14.0');
    await page.waitForTimeout(1600);
    await shot(page, 'phase3', 'circuits-combination-reduced', testInfo);
    await next.click();
    await expect(text).toContainText('3.00');
    await next.click();
    await page.waitForTimeout(900);
    await next.click();
    await expect(text).toContainText('1.00');
    await expect(text).toContainText('2.00');
    await expect(next).toBeDisabled();
    await page.waitForTimeout(900);
    await expectNoBadText(page, 'combination end');
    await page.locator('.reduce-back').click();
    await page.locator('.reduce-reset').click();
    await expect(page.locator('.reduce-count')).toHaveText('Step 0 of 6');
    expect(errors).toEqual([]);
  });

  test('walk the loop: every loop sums to zero', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/circuits/kirchhoff');
    for (const loop of ['Left loop', 'Right loop', 'Outer loop']) {
      await page.locator('.seg', { hasText: loop }).click();
      for (let i = 0; i < 12; i++) await page.locator('.walk-step').click();
      await expect(page.locator('.walk-sum')).toContainText('Sum = 0.00');
      await expect(page.locator('.walk-terms li').first()).toBeVisible();
    }
    await expect(page.locator('.kcl-note')).toContainText('negative');
    await page.locator('.seg', { hasText: 'Down' }).click();
    await expect(page.locator('.kcl-note')).toContainText('positive');
    await page.locator('.walk-play').click();
    await page.waitForTimeout(1500);
    await shot(page, 'phase3', 'circuits-kirchhoff-walking', testInfo);
    await page.locator('.seg', { hasText: 'One loop' }).click();
    for (let i = 0; i < 8; i++) await page.locator('.walk-step').click();
    await expect(page.locator('.walk-sum')).toContainText('Sum = 0.00');
    expect(errors).toEqual([]);
  });

  test('solve: each problem walks to the end; variations accept right and reject wrong', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/circuits/solve');
    const n = await page.locator('.mode-row .seg').count();
    expect(n).toBe(3);
    for (let i = 0; i < n; i++) {
      await page.locator('.mode-row .seg').nth(i).click();
      await walkSolve(page, page.locator('.solve'));
      await page.waitForTimeout(200);
      await shot(page, 'phase3', `circuits-solve-${i + 1}`, testInfo);
    }
    expect(errors).toEqual([]);
  });
});
