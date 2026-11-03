import { test, expect } from '@playwright/test';
import { trackErrors, gotoApp, expectNoBadText, shot } from './helpers.js';

test('first visit shows the intro once; it can be reopened', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await gotoApp(page, '#/', { introSeen: false });
  const dialog = page.locator('.intro-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Height = voltage');
  await shot(page, 'phase7', 'intro', testInfo);
  await page.locator('.intro-next').click();
  await expect(dialog).toContainText('Dots = current');
  await page.locator('.intro-next').click();
  await expect(dialog).toContainText('Push arrows');
  await page.locator('.intro-next').click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('emlab.introSeen'))).toBe('1');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#view > .module'));
  await page.waitForTimeout(300);
  await expect(page.locator('.intro-dialog')).toHaveCount(0);
  await page.locator('#help-btn').click();
  await expect(page.locator('.intro-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.intro-dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('home cards open each module', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await gotoApp(page, '#/');
  await expect(page.locator('.home-card')).toHaveCount(4);
  await shot(page, 'phase7', 'home', testInfo);
  for (const r of ['circuits', 'rc', 'capacitors', 'fields']) {
    await page.locator(`.home-card[data-route="${r}"]`).click();
    await page.waitForFunction((x) => window.__emlab.stats().route === x, r);
    await expect(page.locator('.module-head h1')).toBeVisible();
    await expectNoBadText(page, r);
    await page.locator('.brand').click();
    await page.waitForFunction(() => window.__emlab.stats().route === '');
  }
  expect(errors).toEqual([]);
});

test('an unexpected error shows a calm banner; tapping it reloads the module', async ({ page }) => {
  await gotoApp(page, '#/circuits');
  await page.evaluate(() => { setTimeout(() => { throw new Error('test error'); }, 0); });
  await expect(page.locator('#error-banner')).toBeVisible();
  await expect(page.locator('#error-banner')).toContainText('Something went wrong. Tap to reload this module.');
  await page.locator('#error-reload').click();
  await expect(page.locator('#error-banner')).toBeHidden();
  await expect(page.locator('.module-circuits')).toBeVisible();
});
