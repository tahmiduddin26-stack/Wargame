/**
 * Browser smoke test. Walks the menu, briefing and a real mission, then asserts
 * the ragdoll pool actually produces and recycles corpses.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/smoke.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR ?? '.shots';
mkdirSync(OUT, { recursive: true });

const CHROME =
  process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/01-menu.png` });

// Target the brass key by class: its copy is design-owned and moves.
await page.locator('.menu__key').click();
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/02-briefing.png` });
for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(200);
}
await page.screenshot({ path: `${OUT}/03-briefing-mounts.png` });
await page.getByRole('button', { name: 'Next' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Deploy' }).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/04-battle-open.png` });

const peak = { corpses: 0, spawns: 0, bodies: 0, units: 0 };
const timeline = [];
let ended = false;

for (let round = 0; round < 44; round++) {
  // Index into .unit rather than using :nth-child, which silently matched
  // nothing and made an earlier run look like the ragdoll pool was broken.
  for (const n of [0, 1, 2]) {
    const card = page.locator('.unit').nth(n);
    if (await card.count()) await card.click({ force: true }).catch(() => {});
  }
  const dial = page.locator('.dial--ready');
  if (await dial.count()) await dial.click({ force: true }).catch(() => {});

  await page.waitForTimeout(700);

  const q = await page.evaluate(() => {
    const a = window.__aow;
    // Absent, or present but pointing at a torn-down scene, once the match ends.
    if (!a || !a.live()) return null;
    return {
      corpses: a.corpses(),
      spawns: a.ragdollSpawns(),
      bodies: a.matterBodies(),
      units: a.units(),
      kills: a.kills(),
      elapsed: Math.round(a.elapsed()),
      ages: a.ages(),
      gates: a.gates().map((g) => Math.round(g)),
      clock: document.querySelector('.hud__clock .num')?.textContent ?? '',
      over: !!document.querySelector('.db__verdict'),
    };
  });
  if (!q) {
    ended = !!(await page.locator('.db__verdict').count());
    break;
  }

  peak.corpses = Math.max(peak.corpses, q.corpses);
  peak.spawns = Math.max(peak.spawns, q.spawns);
  peak.bodies = Math.max(peak.bodies, q.bodies);
  peak.units = Math.max(peak.units, q.units);

  if (round % 6 === 0) {
    timeline.push(
      `t=${String(q.elapsed).padStart(3)}s clock=${q.clock} units=${String(q.units).padStart(2)} ` +
        `corpses=${String(q.corpses).padStart(2)} spawned=${String(q.spawns).padStart(3)} ` +
        `bodies=${String(q.bodies).padStart(3)} kills=${q.kills} gates=${q.gates}`,
    );
  }
  if (round === 8) await page.screenshot({ path: `${OUT}/05-battle-melee.png` });
  if (round === 22) await page.screenshot({ path: `${OUT}/06-battle-push.png` });
  if (q.over) {
    ended = true;
    timeline.push(`match ended at t=${q.elapsed}s`);
    break;
  }
}

await page.screenshot({ path: `${OUT}/07-battle-late.png` });

const pause = page.locator('.hud__pause');
if ((await pause.count()) && !ended) {
  await pause.click().catch(() => {});
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/08-pause.png` });
  const resume = page.getByRole('button', { name: 'Resume' });
  if (await resume.count()) await resume.click().catch(() => {});
}

// Roster screen, checked because it is the densest table in the UI.
if (ended) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/09-debrief.png` });
  const campaign = page.getByRole('button', { name: 'Campaign' });
  if (await campaign.count()) {
    await campaign.click().catch(() => {});
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/10-missions.png` });
  }
}

console.log(timeline.join('\n'));
console.log('\npeak:', JSON.stringify(peak));

const problems = [];
if (peak.spawns === 0) problems.push('no ragdolls were ever spawned');
if (peak.corpses > 22) problems.push(`corpse cap exceeded: ${peak.corpses}`);
if (peak.bodies === 0) problems.push('matter world is empty');
if (peak.units === 0) problems.push('no units ever reached the field');

console.log('ERRORS:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
console.log('CHECKS:', problems.length ? problems.join('; ') : 'all passed');

await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
