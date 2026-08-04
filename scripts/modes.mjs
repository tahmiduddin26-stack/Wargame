/**
 * Exercises the modes and screens the main smoke test does not reach:
 * Survival, the Armoury, the difficulty ladder, the roster's counter table and
 * the light panel finish.
 *
 *   npx vite preview --port 4173 &
 *   node scripts/modes.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR ?? '.shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// Give the armoury something to spend, so the buy path is actually exercised.
await page.evaluate(() => {
  const key = 'aow.progress.v1';
  const raw = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":0}');
  raw.state = { ...raw.state, credits: 5000, onboardingDone: true };
  localStorage.setItem(key, JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

await page.getByRole('button', { name: 'Armoury' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/30-armoury.png` });

const buys = page.locator('.am__buy:not([disabled])');
const before = await buys.count();
if (before) {
  await buys.first().click();
  await page.waitForTimeout(250);
}
const fitted = await page.locator('.am__fitted').count();
console.log(`armoury: ${before} affordable, ${fitted} fitted after purchase`);
await page.screenshot({ path: `${OUT}/31-armoury-fitted.png` });
await page.getByRole('button', { name: 'Back' }).click();
await page.waitForTimeout(250);

// Difficulty ladder lives on the mission screen.
await page.getByRole('button', { name: 'Missions' }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/32-missions-tiers.png` });
// The rail's accessible name carries the index and payout too, so match loosely.
await page.getByRole('radio', { name: /Hard/ }).click().catch(() => {});
await page.waitForTimeout(200);
const tierOn = await page.locator('.ms__tier-row .rail__stop--on .rail__name').textContent();
console.log('tier selected:', tierOn);

// Survival.
await page.getByRole('button', { name: 'Stand watch' }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/33-survival-open.png` });

let peakWave = 0;
for (let i = 0; i < 30; i++) {
  for (const n of [0, 1]) {
    const card = page.locator('.unit').nth(n);
    if (await card.count()) await card.click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(700);
  const wave = await page.evaluate(() => {
    const t = document.querySelector('.hud__clock .num')?.textContent ?? '';
    const m = /WAVE (\d+)/.exec(t);
    return m ? Number(m[1]) : null;
  });
  if (wave === null) break;
  peakWave = Math.max(peakWave, wave);
  if (i === 18) await page.screenshot({ path: `${OUT}/34-survival-waves.png` });
}
console.log('survival reached wave', peakWave);

// Roster, for the counter matrix.
await page.evaluate(() => localStorage.removeItem('aow.progress.v1'));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Roster' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/35-roster-counters.png` });

/*
 * Panel finish. The palette itself is checked numerically by colour-check.mjs;
 * what needs a browser is that the switch reaches the document at all — the
 * tokens hang off one attribute on <html>, and the page background lives
 * outside .stage, so a change that only repainted the stage would look right in
 * a screenshot of a screen and wrong in the letterbox bars beside it.
 */
await page.getByRole('button', { name: 'Back' }).click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: 'Settings' }).click();
await page.waitForTimeout(300);

const readFinish = () =>
  page.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    page: getComputedStyle(document.documentElement).backgroundColor,
    stage: getComputedStyle(document.querySelector('.stage')).backgroundColor,
  }));

const night = await readFinish();
await page.getByRole('button', { name: 'Day' }).click();
await page.waitForTimeout(300);
const day = await readFinish();
await page.screenshot({ path: `${OUT}/36-settings-day.png` });

await page.getByRole('button', { name: 'Back' }).click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: 'Roster' }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/37-roster-day.png` });

// Survives a reload, which is the whole point of persisting it.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const reloaded = await readFinish();
console.log(`finish: ${night.attr} page=${night.page} -> ${day.attr} page=${day.page}`);

const problems = [];
if (night.attr !== 'dark') problems.push(`default finish is ${night.attr}, expected dark`);
if (day.attr !== 'light') problems.push('choosing Day did not set data-theme=light');
if (day.page === night.page) problems.push(`page background did not change: ${day.page}`);
if (day.stage === night.stage) problems.push(`stage background did not change: ${day.stage}`);
if (reloaded.attr !== 'light') problems.push(`finish did not persist: ${reloaded.attr}`);
if (!before) problems.push('no affordable armoury perk with 5000 credits');
if (peakWave < 1) problems.push('survival never released a wave');
if (tierOn?.trim() !== 'Hard') problems.push(`tier did not switch: ${tierOn}`);

console.log('ERRORS:', errors.length ? errors.slice(0, 8).join('\n') : 'none');
console.log('CHECKS:', problems.length ? problems.join('; ') : 'all passed');

await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
