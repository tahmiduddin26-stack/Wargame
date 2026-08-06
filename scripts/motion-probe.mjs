/**
 * Verifies the motion actually moves, which a screenshot cannot show.
 *
 * Checks that lane blips interpolate on the compositor rather than snapping,
 * that no HUD element animates a layout-driving property, and that the evolve
 * focal sequence fires. Mission 1 is age-capped, so the evolve check runs on a
 * later mission unlocked through localStorage.
 *
 *   npx vite preview --port 4173 &
 *   node scripts/motion-probe.mjs
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

// Unlock through mission 5, which is the first with the age cap lifted.
await page.evaluate(() => {
  const key = 'aow.progress.v1';
  const raw = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":0}');
  const records = {};
  for (let i = 1; i <= 4; i++) {
    records[i] = { cleared: true, bestTime: 120, bestAge: 1, clearedTiers: ['normal'] };
  }
  raw.state = { ...raw.state, records, onboardingDone: true, credits: 400 };
  localStorage.setItem(key, JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

await page.getByRole('button', { name: 'Missions' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Deploy' }).click();
await page.waitForTimeout(2500);

const problems = [];

// --- 1. Lane blips interpolate, and do so with transform ------------------
await page.locator('.unit').nth(0).click({ force: true }).catch(() => {});
await page.locator('.unit').nth(1).click({ force: true }).catch(() => {});
await page.waitForTimeout(2500);

const sampleBlips = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.lane__blip')].slice(0, 6).map((el) => {
      const cs = getComputedStyle(el);
      return { transform: cs.transform, transition: cs.transitionProperty, left: cs.left };
    }),
  );

// Sampled across several frames: a single short gap can fall entirely inside an
// already-settled transition and report a false negative.
const frames = [];
for (let i = 0; i < 8; i++) {
  frames.push(await sampleBlips());
  await page.waitForTimeout(28);
}
const first = frames[0];

if (!first.length) {
  problems.push('no lane blips on screen to sample');
} else {
  if (!first[0].transition.includes('transform')) {
    problems.push(`blips do not transition transform: ${first[0].transition}`);
  }
  if (first[0].left !== '0px') {
    problems.push(`blips still positioned with left: ${first[0].left}`);
  }
  const distinct = new Set(frames.map((f) => f[0]?.transform ?? '')).size;
  // A blip interpolating over 90ms should show several intermediate values
  // across an 8-frame, ~220ms window rather than two snapshot positions.
  if (distinct < 3) {
    problems.push(`blip transform took only ${distinct} distinct values: not interpolating`);
  }
  console.log(
    `blips: ${first.length} sampled, transition="${first[0].transition}", distinct positions=${distinct}`,
  );
}

// --- 2. Nothing in the HUD transitions a layout property ------------------
const layoutAnimated = await page.evaluate(() => {
  const banned = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding'];
  const out = [];
  for (const el of document.querySelectorAll('.hud *')) {
    const props = getComputedStyle(el).transitionProperty.split(',').map((p) => p.trim());
    const bad = props.filter((p) => banned.includes(p));
    if (bad.length) out.push(`${el.className}: ${bad.join('/')}`);
  }
  return [...new Set(out)].slice(0, 6);
});
if (layoutAnimated.length) {
  problems.push(`layout properties transitioned: ${layoutAnimated.join(' | ')}`);
}
console.log('layout-animated elements:', layoutAnimated.length ? layoutAnimated : 'none');

// --- 3. The evolve focal sequence fires -----------------------------------
let sweepSeen = false;
let plateSeen = false;
let staggerSeen = false;

for (let i = 0; i < 90 && !sweepSeen; i++) {
  for (const n of [0, 1, 2]) {
    await page.locator('.unit').nth(n).click({ force: true }).catch(() => {});
  }
  const evolve = page.locator('.evolve--ready');
  if (await evolve.count()) {
    await page.screenshot({ path: `${OUT}/40-evolve-ready.png` });
    await evolve.click({ force: true }).catch(() => {});
    // Sample fast: the sweep lives for 640ms.
    for (let k = 0; k < 8; k++) {
      const seen = await page.evaluate(() => ({
        sweep: !!document.querySelector('.era-sweep'),
        plate: !!document.querySelector('.hud__yours--changed'),
        stagger: !!document.querySelector('.units--changed'),
      }));
      sweepSeen ||= seen.sweep;
      plateSeen ||= seen.plate;
      staggerSeen ||= seen.stagger;
      if (k === 1) await page.screenshot({ path: `${OUT}/41-evolve-sweep.png` });
      await page.waitForTimeout(70);
    }
    break;
  }
  await page.waitForTimeout(600);
}

console.log(`evolve sequence: sweep=${sweepSeen} plate=${plateSeen} stagger=${staggerSeen}`);
if (!sweepSeen) problems.push('era sweep never rendered');
if (!plateSeen) problems.push('age plate never flagged as changed');
if (!staggerSeen) problems.push('roster never restacked');

// --- 4. Reduced motion disables it ----------------------------------------
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.waitForTimeout(200);
const reducedOk = await page.evaluate(() => {
  const el = document.querySelector('.lane__blip');
  if (!el) return true;
  return getComputedStyle(el).transitionProperty.includes('none');
});
if (!reducedOk) problems.push('reduced motion still transitions blips');
console.log('reduced motion honoured:', reducedOk);

console.log('ERRORS:', errors.length ? errors.slice(0, 6).join('\n') : 'none');
console.log('CHECKS:', problems.length ? problems.join('; ') : 'all passed');

await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
