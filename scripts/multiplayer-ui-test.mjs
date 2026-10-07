import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.MULTIPLAYER_HTTP ?? 'http://127.0.0.1:8788/';
const out = process.env.SHOT_DIR ?? '.shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];

async function setup(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text()); });
  await page.goto(base);
  await page.getByRole('button', { name: 'Multiplayer' }).waitFor();
  return { context, page };
}

try {
  const a = await setup({ width: 1024, height: 576 });
  await a.page.screenshot({ path: `${out}/progress-menu.png` });
  await a.page.getByRole('button', { name: 'Missions' }).click();
  await a.page.waitForTimeout(350);
  await a.page.screenshot({ path: `${out}/progress-missions.png` });
  await a.page.locator('.ms__deploy').click();
  await a.page.locator('.unit').first().waitFor({ timeout: 15000 });
  await a.page.locator('.unit').first().click();
  await a.page.waitForTimeout(1000);
  assert((await a.page.evaluate(() => window.__aow?.units())) > 0);
  await a.page.getByRole('button', { name: 'Pause' }).click();
  await a.page.getByRole('button', { name: 'Abandon' }).click();
  await a.page.getByRole('button', { name: 'Back', exact: true }).click();
  await a.page.getByRole('button', { name: 'Roster' }).click();
  await a.page.waitForTimeout(350);
  await a.page.screenshot({ path: `${out}/progress-roster.png` });
  await a.page.getByRole('button', { name: 'Back', exact: true }).click();
  await a.page.getByRole('button', { name: 'Armoury' }).click();
  await a.page.waitForTimeout(350);
  await a.page.screenshot({ path: `${out}/progress-skills.png` });
  assert(await a.page.getByText('Commander rank').isVisible());
  assert.equal(await a.page.locator('.am__row').evaluateAll((rows) => rows.filter((row) => row.scrollWidth > row.clientWidth + 1).length), 0);
  await a.page.getByRole('button', { name: 'Back', exact: true }).click();
  await a.page.getByRole('button', { name: 'Settings' }).click();
  await a.page.waitForTimeout(350);
  await a.page.screenshot({ path: `${out}/progress-settings.png` });
  await a.page.getByRole('button', { name: 'Back', exact: true }).click();
  await a.page.getByRole('button', { name: 'Multiplayer' }).click();
  await a.page.getByText('Friend code').waitFor();
  assert(await a.page.getByText('Bronze', { exact: true }).first().isVisible());
  await a.page.waitForTimeout(350);
  await a.page.screenshot({ path: `${out}/progress-online.png` });

  const progression = await browser.newContext({ viewport: { width: 1024, height: 576 } });
  await progression.addInitScript(() => {
    if (sessionStorage.getItem('progression-seeded')) return;
    localStorage.setItem('aow.progress.v1', JSON.stringify({
      state: { careerXp: 220, credits: 500, perks: ['quartermaster'], records: {} }, version: 0,
    }));
    sessionStorage.setItem('progression-seeded', '1');
  });
  const progressPage = await progression.newPage();
  await progressPage.goto(base);
  await progressPage.getByRole('button', { name: 'Armoury' }).click();
  const scavengers = progressPage.locator('.am__row').filter({ hasText: 'Scavengers' });
  await scavengers.getByRole('button', { name: '180' }).click();
  assert(await scavengers.getByText('Fitted').isVisible());
  await progressPage.reload();
  await progressPage.getByRole('button', { name: 'Armoury' }).click();
  assert(await progressPage.locator('.am__row').filter({ hasText: 'Scavengers' }).getByText('Fitted').isVisible());
  assert.equal((await progressPage.locator('.st__head .num').textContent())?.trim(), '320');
  await progression.close();

  const b = await setup({ width: 844, height: 390 });
  await b.page.getByRole('button', { name: 'Multiplayer' }).click();
  await b.page.getByText('Friend code').waitFor();
  await b.page.waitForTimeout(350);
  await b.page.screenshot({ path: `${out}/progress-online-phone.png` });

  await a.page.getByRole('button', { name: 'Casual battle' }).click();
  await b.page.getByRole('button', { name: 'Casual battle' }).click();
  await a.page.locator('.hud__clock').waitFor({ timeout: 15000 });
  await b.page.locator('.hud__clock').waitFor({ timeout: 15000 });
  await a.page.screenshot({ path: `${out}/progress-online-battle.png` });
  assert(await a.page.locator('.stage__canvas canvas').count());
  await a.page.locator('.unit').first().click();
  await a.page.waitForTimeout(1200);
  const unitCounts = await Promise.all([a.page, b.page].map((page) => page.evaluate(() => window.__aow?.units())));
  assert(unitCounts.every((count) => count > 0), `Both clients must render the server unit: ${unitCounts}`);
  const tokenBefore = await b.page.evaluate(() => localStorage.getItem('aow.online.token.v1'));
  const timeBefore = await b.page.evaluate(() => window.__aow.elapsed());
  await b.page.reload();
  await b.page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
  await b.page.locator('.hud__versus').waitFor({ timeout: 10000 });
  assert.equal(await b.page.evaluate(() => localStorage.getItem('aow.online.token.v1')), tokenBefore);
  await b.page.waitForFunction((time) => window.__aow?.elapsed() >= time && window.__aow.units() > 0, timeBefore);
  await b.page.screenshot({ path: `${out}/online-rejoined-phone.png` });
  await a.page.getByRole('button', { name: 'Leave battle' }).click();
  await a.page.getByRole('button', { name: 'Forfeit' }).click();
  await a.page.getByText('Defeat').waitFor({ timeout: 8000 });
  await b.page.getByText('Victory').waitFor({ timeout: 8000 });
  assert(await a.page.getByText('Rank and rating unchanged.').isVisible());
  await a.page.getByRole('button', { name: 'Close result' }).click();
  await b.page.getByRole('button', { name: 'Close result' }).click();
  await a.page.getByRole('button', { name: 'Ranked battle' }).click();
  await b.page.getByRole('button', { name: 'Ranked battle' }).click();
  await a.page.locator('.hud__versus').waitFor({ timeout: 15000 });
  await b.page.locator('.hud__versus').waitFor({ timeout: 15000 });
  assert.match(await a.page.locator('.hud__versus').textContent(), /Ranked vs .*Bronze/);
  await a.page.screenshot({ path: `${out}/progress-ranked-battle.png` });
  await b.page.getByRole('button', { name: 'Leave battle' }).click();
  await b.page.getByRole('button', { name: 'Forfeit' }).click();
  await a.page.getByText('Victory').waitFor({ timeout: 8000 });
  await b.page.getByText('Defeat').waitFor({ timeout: 8000 });
  assert(await a.page.getByText('1016 rating (+16)').isVisible());
  assert(await b.page.getByText('984 rating (-16)').isVisible());
  await a.page.getByRole('button', { name: 'Close result' }).click();
  await b.page.getByRole('button', { name: 'Close result' }).click();
  await a.page.getByRole('button', { name: 'Casual battle' }).click();
  await a.page.getByRole('button', { name: 'Cancel search' }).waitFor();
  await a.page.getByRole('button', { name: 'Back', exact: true }).click();
  await a.page.getByRole('button', { name: 'Missions', exact: true }).waitFor();
  await b.page.getByRole('button', { name: 'Casual battle' }).click();
  await b.page.waitForTimeout(500);
  assert.equal(await b.page.locator('.hud').count(), 0, 'leaving the lobby must stop the old search');
  await b.page.getByRole('button', { name: 'Cancel search' }).click();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('Multiplayer UI passed: progression, casual/ranked duels, reload rejoin, lobby-exit cancellation and two-client rendering.');
} finally {
  await browser.close();
}
