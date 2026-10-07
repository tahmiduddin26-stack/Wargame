import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

mkdirSync('.shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 667, height: 375 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:8788/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: '2×', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Missions', exact: true }).click();
  await page.getByRole('button', { name: 'Stand watch' }).click();
  // Let the real waves defeat an undefended gate; do not fabricate a result.
  await page.locator('.sd').waitFor({ timeout: 120000 });
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('aow.progress.v1')).state);
  assert(progress.survivalBest > 0);
  assert.equal(progress.credits, progress.survivalBest);
  assert.equal(progress.careerXp, progress.survivalBest * 3);
  assert.equal(progress.serviceStats.survivalRuns, 1);
  assert.equal(progress.battleHistory.length, 1);
  assert.equal(progress.battleHistory[0].waves, progress.survivalBest);
  assert(await page.locator('.db__inner').evaluate((el) => el.scrollWidth <= el.clientWidth));
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.shots/survival-result-phone.png' });
  await page.getByRole('button', { name: 'Service record', exact: true }).click();
  assert.equal(await page.locator('.sr__history li').count(), 1);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.reload();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('aow.progress.v1')).state.serviceStats.survivalRuns), 1);
  assert.deepEqual(errors, []);
  console.log('Real survival defeat, debrief, single rewards, history and reload passed.');
} finally { await browser.close(); }
