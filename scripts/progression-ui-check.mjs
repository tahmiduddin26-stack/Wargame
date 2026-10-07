import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

mkdirSync('.shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 667, height: 375 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'Service record' }).click();
  assert.equal(await page.locator('.sr__medal').count(), 12);
  assert.equal(await page.locator('.sr__medal--earned').count(), 0);
  assert(await page.locator('.sr__body').evaluate((el) => el.scrollWidth <= el.clientWidth));
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.shots/service-record-small.png' });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Missions', exact: true }).click();
  await page.getByRole('button', { name: 'Stand watch' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  await page.locator('.unit').first().click();
  await page.waitForTimeout(850);
  assert(await page.evaluate(() => window.__aow.units() > 0));
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.hud') && !document.querySelector('.pause') && window.__aow?.units() === 0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  assert((await page.locator('.pause__head').innerText()).includes('THE LONG WATCH'));
  await page.getByRole('button', { name: 'Abandon', exact: true }).click();
  await page.getByRole('button', { name: 'Deploy', exact: true }).click();
  await page.locator('.unit').first().click();
  await page.waitForTimeout(850);
  assert(await page.evaluate(() => window.__aow.units() > 0));
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.hud') && !document.querySelector('.pause') && window.__aow?.units() === 0);
  assert.deepEqual(errors, []);
  console.log('Service record phone layout, survival restart and campaign restart passed.');
} finally {
  await browser.close();
}
