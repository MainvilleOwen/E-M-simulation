// Shared e2e helpers.
import { expect } from '@playwright/test';

export function trackErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    errors.push(`requestfailed: ${req.url()} ${req.failure() ? req.failure().errorText : ''}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return errors;
}

export async function gotoApp(page, hash = '#/', { introSeen = true } = {}) {
  if (introSeen) {
    await page.addInitScript(() => {
      try { localStorage.setItem('emlab.introSeen', '1'); } catch { /* ignore */ }
    });
  }
  await page.goto('/' + hash);
  await page.waitForFunction(() => window.__emlab && document.querySelector('#view > .module'));
}

export async function expectNoBadText(page, where = '') {
  const text = await page.evaluate(() => document.body.innerText);
  const bad = text.match(/\b(NaN|Infinity|undefined)\b/);
  expect(bad, `found "${bad && bad[0]}" in page text ${where}`).toBeNull();
}

export async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

/** Drive a range input to min, mid and max, scanning for bad text after each. */
export async function sweepRange(page, locator, label = '') {
  const { min, max, step } = await locator.evaluate((el) => ({
    min: parseFloat(el.min), max: parseFloat(el.max), step: parseFloat(el.step) || 1,
  }));
  const mid = Math.round(((min + max) / 2) / step) * step;
  for (const v of [min, mid, max]) {
    await setRange(locator, v);
    await page.waitForTimeout(60);
    await expectNoBadText(page, `${label} = ${v}`);
  }
}

export async function shot(page, phase, name, testInfo) {
  const project = testInfo.project.name;
  await page.screenshot({ path: `checks/${phase}/${name}-${project}.png`, fullPage: true });
}
