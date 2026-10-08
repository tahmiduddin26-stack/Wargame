/** Real browser captures, using legal progression fixtures. Native recapture remains a release gate. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:8787/';
const root = resolve('assets/store');
const browsers = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const captures = [];
const allPerks = ['quartermaster', 'scavengers', 'drill-yard', 'engineers', 'field-hospital', 'forward-scouts', 'shell-crates', 'war-college'];
const records = Object.fromEntries([1, 2, 3, 4].map((id) => [id, { cleared: true, bestTime: 150, bestAge: 0, clearedTiers: ['normal'] }]));
const fixture = { credits: 1000, careerXp: 3350, onboardingDone: true, records,
  ownedSkins: ['field', 'ember'], equippedSkin: 'field', settings: { sfx: false, music: false } };

async function open(device, state) {
  const context = await browsers.newContext({ viewport: device.viewport, deviceScaleFactor: device.scale, serviceWorkers: 'block' });
  await context.addInitScript((state) => {
    if (sessionStorage.getItem('store-capture-seeded')) return;
    localStorage.setItem('aow.progress.v1', JSON.stringify({ state, version: 0 }));
    sessionStorage.setItem('store-capture-seeded', '1');
  }, state);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Missions', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { page, context };
}

async function shot(page, device, name, note) {
  await page.mouse.move(2, 2);
  await page.waitForTimeout(350);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow: ${name}`);
  if (await page.locator('.hud').count()) {
    assert(await page.locator('.hud__gold').evaluate((el) => Number(el.textContent.replace(/,/g, '')) >= 0), 'Gold display must stay non-negative');
    assert.equal(await page.locator('.unit__name').evaluateAll((names) => names.filter((el) => el.scrollWidth > el.clientWidth + 1).length), 0, 'Unit names must fit their cards');
    assert.equal(await page.locator('.unit__name--compact').evaluateAll((names) => names.filter((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects().length > 1;
    }).length), 0, 'Long single-word unit names should fit without a dangling last letter');
  }
  const directory = `${root}/screenshots/${device.name}`;
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}.png`, animations: 'disabled' });
  captures.push({ file: `screenshots/${device.name}/${name}.png`, width: device.viewport.width * device.scale,
    height: device.viewport.height * device.scale, source: 'actual production browser UI', note });
  console.log(`Captured ${device.name}/${name}`);
}

async function fight(page, seconds = 25) {
  await page.locator('.unit').first().waitFor({ timeout: 20000 });
  await page.evaluate(() => {
    window.__storeGoldMinimum = Infinity;
    const sample = () => {
      const el = document.querySelector('.hud__gold');
      if (!el) return;
      window.__storeGoldMinimum = Math.min(window.__storeGoldMinimum, Number(el.textContent.replace(/,/g, '')));
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    for (const i of [0, 1, 0, 2]) {
      const card = page.locator('.unit').nth(i);
      if (await card.count() && await card.isEnabled()) await card.click();
    }
    await page.waitForTimeout(800);
  }
  assert(await page.evaluate(() => window.__aow?.units() > 0), 'Capture needs live units');
  assert(await page.evaluate(() => window.__storeGoldMinimum >= 0), 'No negative gold display during repeated unit purchases');
}

try {
  const devices = [
    { name: 'android', viewport: { width: 960, height: 540 }, scale: 2 },
    { name: 'iphone', viewport: { width: 1311, height: 603 }, scale: 2 },
  ];
  // Sequential contexts ensure background visibility does not pause the offline battle.
  for (const device of devices) {
    let { page, context } = await open(device, fixture);
    await shot(page, device, '01-cover', 'Approved working title; fixture commander save.');
    await page.getByRole('button', { name: 'Missions', exact: true }).click();
    await shot(page, device, '05-campaign', 'Existing 16-operation campaign; first four marked cleared in fixture.');
    await page.locator('.ms__row-go').first().click();
    await fight(page);
    await shot(page, device, '02-stone-battle', 'Actual operation 1 replay; units bought through normal controls.');
    await context.close();

    ({ page, context } = await open(device, { ...fixture, perks: allPerks }));
    await page.getByRole('button', { name: 'Missions', exact: true }).click();
    await page.locator('.ms__deploy').click();
    await fight(page, 23);
    assert.equal(await page.evaluate(() => window.__aow.ages()[0]), 1, 'War College starts in Medieval');
    await shot(page, device, '03-medieval-battle', 'Actual operation 5; earned War College skill starts at Medieval. All eight skills fitted in fixture.');
    await context.close();

    ({ page, context } = await open(device, fixture));
    await page.getByRole('button', { name: 'Missions', exact: true }).click();
    await page.getByRole('button', { name: 'Stand watch', exact: true }).click();
    await fight(page, 23);
    await shot(page, device, '04-survival', 'Actual Long Watch survival; normal controls and simulation.');
    await context.close();

    ({ page, context } = await open(device, { ...fixture, perks: ['quartermaster', 'scavengers'] }));
    await page.getByRole('button', { name: 'Armoury', exact: true }).click();
    await shot(page, device, '06-skills', 'Actual three-branch skill UI; rank 10 and two skills fitted in fixture.');
    await page.getByRole('tab', { name: 'Army paints' }).click();
    await shot(page, device, '07-paints', 'Existing earned paints. No paid checkout.');
    await context.close();
  }

  // Verify the longer title at the smallest supported phone layout.
  const phone = { name: 'qa', viewport: { width: 667, height: 375 }, scale: 1 };
  const { page, context } = await open(phone, fixture);
  const heading = await page.locator('.menu__title').boundingBox();
  const actions = await page.locator('.menu__actions').boundingBox();
  assert(heading.x + heading.width <= actions.x, 'Brand must not overlap menu actions');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  mkdirSync('.shots', { recursive: true });
  await page.screenshot({ path: '.shots/store-brand-phone.png' });
  await context.close();
  assert.deepEqual(errors, []);
  writeFileSync(`${root}/capture-manifest.json`, JSON.stringify({ capturedAt: new Date().toISOString(), base,
    status: 'Browser drafts. Recapture and verify inside signed Android/iOS builds before submission.',
    fixtures: { ordinary: fixture, medieval: { ...fixture, perks: allPerks } }, captures }, null, 2) + '\n');
  console.log(`${captures.length} actual UI screenshots exported. No runtime errors; small-phone brand fits.`);
} finally {
  await browsers.close();
}
