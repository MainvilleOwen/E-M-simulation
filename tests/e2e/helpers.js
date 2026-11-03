// Shared e2e helpers.
import { expect } from '@playwright/test';

export function trackErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    // The app reports caught failures as warnings (and shows a calm banner); those are bugs too.
    if (msg.type() === 'warning' && /failed to (mount|load)|Frame callback failed|Unhandled (error|rejection)|setup failed|step action failed/.test(msg.text())) {
      errors.push(`console.warn: ${msg.text()}`);
    }
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
  await page.addInitScript((seen) => {
    window.__emlabAlwaysDraw = true;
    if (seen) {
      try { localStorage.setItem('emlab.introSeen', '1'); } catch { /* ignore */ }
    }
  }, introSeen);
  await page.goto('./' + hash);
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

/** Walk a solve problem to its end, then check a variation accepts the right answer and rejects a wrong one. */
export async function walkSolve(page, scope) {
  const next = scope.locator('.solve-next');
  for (let i = 0; i < 20 && await next.isVisible(); i++) {
    await next.click();
  }
  await expect(scope.locator('.solve-variation')).toBeVisible();
  const steps = await scope.locator('.step').count();
  expect(steps).toBeGreaterThan(1);
  await expectNoBadText(page, 'after solve steps');
  await scope.locator('.solve-variation').click();
  const ans = await page.evaluate(() => window.__emlab.lastAnswer);
  expect(Number.isFinite(ans.value)).toBe(true);
  const input = scope.locator('.answer-input');
  await input.fill(String(ans.value * 1.01));
  await scope.locator('.answer-check').click();
  await expect(scope.locator('.feedback')).toHaveClass(/good/);
  await input.fill(String(ans.value * 1.5 + (ans.value === 0 ? 1 : 0)));
  await scope.locator('.answer-check').click();
  await expect(scope.locator('.feedback')).toHaveClass(/off/);
  await expect(scope.locator('.feedback')).toContainText('Revisit step');
  await expectNoBadText(page, 'after variation');
}

/** Sweep every range input inside a scope to min, mid and max. */
export async function sweepAll(page, scope, label = '') {
  const ranges = scope.locator('input[type="range"]');
  const n = await ranges.count();
  for (let i = 0; i < n; i++) {
    const r = ranges.nth(i);
    if (!(await r.isEnabled())) continue;
    await sweepRange(page, r, `${label} slider ${i}`);
  }
  return n;
}
