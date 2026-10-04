/** Browser check for the cosmetic economy and persisted loadout. Run against a preview server. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173/';
const out = process.env.SHOT_DIR ?? '.shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });

try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Armoury' }).click();
  await page.getByRole('tab', { name: 'Army paints' }).click();
  assert.equal(await page.locator('.am__skin').count(), 4);
  assert(await page.getByRole('button', { name: /Unlock.*220/ }).isDisabled());

  await page.evaluate(() => localStorage.setItem('aow.progress.v1', JSON.stringify({
    state: { credits: 1000, onboardingDone: true }, version: 0,
  })));
  await page.reload();
  await page.getByRole('button', { name: 'Armoury' }).click();
  await page.getByRole('tab', { name: 'Army paints' }).click();
  await page.getByRole('button', { name: /Unlock.*220/ }).click();
  assert((await page.locator('.am__skin--equipped').innerText()).includes('Ember March'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('aow.progress.v1')).state.credits), 780);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/army-paints.png` });

  await page.reload();
  await page.getByRole('button', { name: 'Armoury' }).click();
  await page.getByRole('tab', { name: 'Army paints' }).click();
  assert((await page.locator('.am__skin--equipped').innerText()).includes('Ember March'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('aow.progress.v1')).state.credits), 780);
  await page.setViewportSize({ width: 667, height: 375 });
  await page.screenshot({ path: `${out}/army-paints-small.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1024, height: 576 });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.locator('.menu__deploy').click();
  await page.locator('.unit').first().waitFor({ timeout: 15000 });
  await page.locator('.unit').first().click();
  await page.waitForTimeout(850);
  assert((await page.evaluate(() => window.__aow?.units())) > 0);
  await page.screenshot({ path: `${out}/army-paint-battle.png` });
  assert.deepEqual(errors, []);
  console.log('Cosmetic unlock, deduction, equip, reload and battle passed.');
} finally {
  await browser.close();
}
