/** Check actual HUD components at each age and a real battle's Call cooldown. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:8787/';
const out = process.env.SHOT_DIR ?? '.shots/hud-ui';
mkdirSync(out, { recursive: true });
const bundle = await build({
  stdin: { contents: `
    import { createRoot } from 'react-dom/client';
    import { Hud } from './src/ui/battle/Hud';
    import { bridge } from './src/game/bridge';
    import { LEVELS } from './src/data/levels';
    import { AGES } from './src/data/ages';
    import { SPECIALS } from './src/data/specials';
    const root = createRoot(document.querySelector('.stage'));
    window.__commands = () => bridge.drain();
    window.__setHUD = async (age, cd) => {
      const snapshot = {gold:9999, xp:9999, ageIndex:age, xpToNext:0, nextAgeXp:10000,
        canEvolve:age<4, baseHp:1000, baseMaxHp:1000, enemyBaseHp:750, enemyBaseMaxHp:1000,
        enemyAgeIndex:age, specialCd:cd, specialMax:SPECIALS[AGES[age].id].cooldown,
        queue:[], cooldowns:{}, slots:[null,null,null], unlockedSlots:1,
        fieldCount:2, enemyFieldCount:2, maxField:20, blips:[], playerFront:400,
        enemyFront:400, laneLength:2400, cameraX:0, cameraSpan:1280,
        elapsed:60, survival:false, wave:0, waveCountdown:30, veterancy:1,
        timeLeft:240, timeLimit:300, escalation:1, paused:false, over:null,
        decidedBy:'gate', stats:{}};
      root.render(<Hud snapshot={snapshot} level={LEVELS[4]} />);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    };
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic',
  alias: { '@': resolve('src') },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"DEV":false}' },
});
let css = ['global', 'ui', 'hud', 'sketch', 'progression', 'motion']
  .map(name => readFileSync(`src/styles/${name}.css`, 'utf8')).join('\n');
css = css.replace(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g, (_, name) =>
  `url('data:font/${name.endsWith('woff2') ? 'woff2' : 'ttf'};base64,${readFileSync(`src/assets/fonts/${name}`).toString('base64')}')`);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const names = ['Rockslide', 'Arrow Storm', 'Mortar Barrage', 'Air Strike', 'Ion Lance'];

async function layout(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const e = document.querySelector(selector), r = e.getBoundingClientRect();
      return {x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height};
    };
    const dial = document.querySelector('.dial'), name = document.querySelector('.dial__name');
    const range = document.createRange(); range.selectNodeContents(name);
    const text = range.getBoundingClientRect();
    const children = ['.dial__name', '.dial__status', '.dial__ready'].map(rect);
    const stage = rect('.stage'), control = rect('.dial');
    return {stage, control, children, text:{x:text.x, right:text.right, bottom:text.bottom},
      units:rect('.units'), mid:rect('.hud__mid'), name: name.textContent,
      overflow:document.documentElement.scrollWidth > innerWidth,
      insets:['.hud__age','.hud__enemy','.hud__mine'].map(s => getComputedStyle(document.querySelector(s)).boxShadow.includes('inset')),
      colour:getComputedStyle(dial).color, background:getComputedStyle(dial).backgroundColor,
      nameColour:getComputedStyle(name).color, disabled:dial.disabled};
  });
}

try {
  const context = await browser.newContext({ serviceWorkers:'block', viewport:{width:667,height:375} });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.setContent(`<style>${css}</style><div id="root"><div class="stage"></div></div>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  let cases = 0;
  for (const size of [{width:667,height:375}, {width:960,height:540}, {width:1311,height:603}]) {
    await page.setViewportSize(size);
    for (let age = 0; age < 5; age++) {
      for (const cd of [0, 51.2]) {
        await page.evaluate(([age, cd]) => window.__setHUD(age, cd), [age, cd]);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(170); // Let the ready/cooldown colour transition settle.
        const r = await layout(page), label = `${names[age]} / ${size.width}px / cooldown ${cd}`;
        if (r.text.x < r.children[0].x - 1 || r.text.right > r.children[0].right + 1 || r.text.bottom > r.children[0].bottom + 1) {
          await page.screenshot({path:`${out}/name-fit-failure.png`});
          console.log(label, JSON.stringify(r));
        }
        assert.equal(r.name, names[age], label);
        assert.equal(r.disabled, cd > 0, label);
        assert(!r.overflow && r.control.right <= r.stage.right && r.control.bottom <= r.stage.bottom, `Call fits: ${label}`);
        assert(r.control.width >= 44 && r.control.height >= 44, `Touch target: ${label}`);
        assert(r.children[0].bottom <= r.children[1].y && r.children[1].bottom <= r.children[2].y, `Rows cannot overlap: ${label}`);
        assert(r.text.x >= r.children[0].x - 1 && r.text.right <= r.children[0].right + 1 && r.text.bottom <= r.children[0].bottom + 1, `Name fits: ${label}`);
        assert(r.units.right <= r.mid.x && r.mid.right <= r.control.x, `Dock controls cannot overlap: ${label}`);
        assert.deepEqual(r.insets, [false,false,false], `No decorative HUD edge strips: ${label}`);
        assert.equal(r.nameColour, r.colour, `Label keeps button contrast: ${label}`);
        if (!cd) {
          assert.equal(r.background, 'rgb(45, 48, 46)');
          assert.equal(r.colour, 'rgb(255, 250, 240)');
          await page.evaluate(() => window.__commands());
          await page.locator('.dial').focus();
          await page.keyboard.press('Enter');
          assert.deepEqual(await page.evaluate(() => window.__commands()), [{t:'special'}]);
        } else {
          await page.evaluate(() => {window.__commands(); document.querySelector('.dial').click();});
          assert.deepEqual(await page.evaluate(() => window.__commands()), []);
        }
        if (age === 2 && size.width === 667) await page.screenshot({ path:`${out}/phone-call-${cd ? 'cooldown' : 'ready'}.png` });
        cases++;
      }
    }
  }
  await context.close();
  console.log(`${cases} HUD cases passed: five ages, ready/cooldown, three phone layouts, keyboard activation.`);

  // Real simulation: calling the special starts the displayed cooldown.
  const live = await browser.newContext({serviceWorkers:'block', viewport:{width:667,height:375}});
  await live.addInitScript(() => localStorage.setItem('aow.progress.v1', JSON.stringify({state:{onboardingDone:true,
    records:{1:{cleared:true,bestTime:100,bestAge:0,clearedTiers:['normal']}},settings:{sfx:false,music:false}},version:0})));
  const game = await live.newPage();
  game.on('pageerror', e => errors.push(e.message));
  await game.goto(base);
  await game.locator('.menu__deploy').click();
  await game.getByRole('button', {name:'Call Rockslide',exact:true}).waitFor();
  await game.evaluate(() => document.fonts.ready);
  await game.screenshot({path:`${out}/live-call-ready.png`});
  await game.getByRole('button', {name:'Call Rockslide',exact:true}).click();
  await game.waitForFunction(() => document.querySelector('.dial')?.disabled);
  const seconds = Number(await game.locator('.dial__count').textContent());
  assert(seconds >= 43 && seconds <= 45, 'Real Rockslide cooldown is 45 seconds');
  assert.equal(await game.locator('.dial__ready').textContent(), 'Recharging');
  await game.screenshot({path:`${out}/live-call-cooldown.png`});
  const r = await layout(game);
  assert(r.children[0].bottom <= r.children[1].y && r.children[1].bottom <= r.children[2].y);
  await game.getByRole('button', {name:'Pause',exact:true}).click();
  await live.close();
  const screens = await browser.newContext({serviceWorkers:'block', viewport:{width:667,height:375}});
  const ui = await screens.newPage();
  ui.on('pageerror', e => errors.push(e.message));
  await ui.goto(base);
  await ui.getByRole('button', {name:'Settings',exact:true}).click();
  await ui.locator('.st__choice').nth(1).click();
  await ui.waitForTimeout(170);
  assert.equal(await ui.locator('.st__choice--on').innerText(), '1.5×');
  // Keyboard navigation makes :focus-visible apply after the pointer click.
  await ui.keyboard.press('Tab');
  await ui.keyboard.press('Shift+Tab');
  const choice = await ui.locator('.st__choice--on').evaluate(el => {
    const c = getComputedStyle(el), num = getComputedStyle(el.querySelector('.num'));
    return {bg:c.backgroundColor, text:num.color, focus:c.outlineColor};
  });
  assert.deepEqual(choice, {bg:'rgb(45, 48, 46)', text:'rgb(255, 250, 240)', focus:'rgb(45, 48, 46)'});
  await ui.screenshot({path:`${out}/phone-settings.png`});
  await ui.getByRole('button', {name:'Back',exact:true}).click();
  await ui.getByRole('button', {name:'Missions',exact:true}).click();
  await ui.waitForTimeout(350);
  const selection = await ui.locator('.rail__stop--on').evaluate(el => ({
    bg:getComputedStyle(el).backgroundColor, text:getComputedStyle(el.querySelector('.rail__name')).color}));
  assert.deepEqual(selection, {bg:'rgb(45, 48, 46)',text:'rgb(255, 250, 240)'});
  await ui.screenshot({path:`${out}/phone-campaign.png`});
  await screens.close();
  assert.deepEqual(errors, []);
  console.log('Real battle Call starts cooldown; settings/campaign selections retain contrast; no runtime errors.');
} finally {
  await browser.close();
}
