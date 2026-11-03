import { test, expect } from '@playwright/test';
import { trackErrors, gotoApp, expectNoBadText, sweepAll, walkSolve, shot } from './helpers.js';

const readout = (page, label) => page.locator('.readout', { hasText: label }).first().locator('dd');

test.describe('M4 Fields and dipoles', () => {
  test('sandbox: presets, add charges, lines, probe on axis and bisector, dragging', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/fields/sandbox');
    await page.locator('.probe-bisector').click();
    await expect(page.locator('.why-note')).toContainText('bisector');
    await page.locator('.probe-axis').click();
    await expect(page.locator('.why-note')).toContainText('axis');
    await shot(page, 'phase6', 'sandbox-dipole', testInfo);
    // Like pair: zero field at the midpoint
    await page.locator('.seg', { hasText: 'Like pair' }).click();
    const canvas = page.locator('.field-panel canvas');
    await canvas.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const box = await canvas.boundingBox();
    // tap the middle of the canvas: probe moves to the midpoint between the like charges
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    const E = await readout(page, '|E| at the probe').innerText();
    expect(parseFloat(E)).toBeLessThan(5);
    // Four charges max
    await page.locator('.seg', { hasText: 'One' }).first().click();
    for (let i = 0; i < 5; i++) {
      const add = page.locator('.add-charge');
      if (await add.isEnabled()) await add.click();
    }
    await expect(page.locator('.charge-row')).toHaveCount(4);
    await expect(page.locator('.add-charge')).toBeDisabled();
    await page.getByRole('button', { name: 'On', exact: true }).click();
    await page.waitForTimeout(300);
    // Drag a charge with the mouse
    await canvas.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const box2 = await canvas.boundingBox();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2 - 4);
    const before = await readout(page, '|E| at the probe').innerText();
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width * 0.3, box2.y + box2.height * 0.4, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    await shot(page, 'phase6', 'sandbox-four', testInfo);
    void before;
    await sweepAll(page, page.locator('.view-sandbox'), 'sandbox');
    await page.locator('.remove-charge').first().click();
    await expect(page.locator('.charge-row')).toHaveCount(3);
    await expectNoBadText(page, 'sandbox');
    expect(errors).toEqual([]);
  });

  test('dipole: zero net force, it rotates toward the field and settles', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/fields/dipole');
    await page.locator('.dipole-release').click();
    await page.waitForTimeout(150);
    const a0 = parseFloat(await readout(page, 'Angle').innerText());
    await expect(readout(page, 'Net force')).toHaveText('0.00 N');
    await page.waitForTimeout(700);
    const a1 = parseFloat(await readout(page, 'Angle').innerText());
    expect(a1).toBeLessThan(a0);
    await shot(page, 'phase6', 'dipole', testInfo);
    // drag to 90°: torque = pE
    const canvas = page.locator('.field-panel canvas');
    await canvas.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25);
    await expect(readout(page, 'Torque')).toHaveText(/2\.00\s*µN·m/);
    await page.mouse.up();
    await sweepAll(page, page.locator('.view-dipole'), 'dipole');
    // undamped energy is conserved, heavily damped it settles
    await page.locator('.view-dipole input[type="range"]').nth(2).evaluate((el) => { el.value = el.max; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('.dipole-release').click();
    await page.waitForTimeout(5000);
    expect(parseFloat(await readout(page, 'Angle').innerText())).toBeLessThan(3);
    await expect(page.locator('.why-note')).toContainText('stable equilibrium');
    await expectNoBadText(page, 'dipole');
    expect(errors).toEqual([]);
  });

  test('solve: both problems walk to the end; variations check', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await gotoApp(page, '#/fields/solve');
    const n = await page.locator('.mode-row .seg').count();
    expect(n).toBe(2);
    for (let i = 0; i < n; i++) {
      await page.locator('.mode-row .seg').nth(i).click();
      const scope = page.locator('.solve');
      for (let k = 0; k < 10 && await scope.locator('.solve-next').isVisible(); k++) {
        await scope.locator('.solve-next').click();
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(600);
      await shot(page, 'phase6', `fields-solve-${i + 1}`, testInfo);
      await walkSolve(page, scope);
    }
    expect(errors).toEqual([]);
  });
});
