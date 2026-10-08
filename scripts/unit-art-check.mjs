/** Render the actual UnitView roster and check artwork, mirrored poses and corpse recycling. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const out = process.env.SHOT_DIR ?? '.shots/unit-art';
mkdirSync(out, { recursive: true });
mkdirSync('assets/store/art', { recursive: true });
const bundle = await build({
  stdin: { contents: `
    import Phaser from 'phaser';
    import { UNITS } from './src/data/units';
    import { AGES } from './src/data/ages';
    import { UnitView } from './src/game/render/UnitView';
    import { RagdollPool } from './src/game/render/RagdollPool';
    class Roster extends Phaser.Scene {
      create() {
        this.cameras.main.setBackgroundColor('#f7ecd6');
        this.add.text(38, 26, 'DOODLEBOOK BATTLES', {fontFamily: 'Trebuchet MS', fontSize: '34px', fontStyle:'bold', color:'#30332f'});
        this.add.text(40, 72, 'Actual game characters  /  orange vs blue  /  all five ages', {fontFamily:'Trebuchet MS', fontSize:'19px', color:'#766657'});
        const layer = this.add.layer().setDepth(10);
        const views = [];
        for (let i = 0; i < UNITS.length; i++) {
          const def = UNITS[i], row = Math.floor(i / 4), column = i % 4;
          const x = 32 + column * 392, y = 120 + row * 225;
          this.add.rectangle(x, y, 380, 212, 0xfff8e7).setOrigin(0).setStrokeStyle(1, 0xd9c8a7);
          this.add.text(x + 18, y + 12, def.name, {fontFamily:'Trebuchet MS', fontSize:'20px', fontStyle:'bold', color:'#30332f'});
          this.add.text(x + 18, y + 40, AGES[row].name + ' / ' + def.role, {fontFamily:'Trebuchet MS', fontSize:'13px', color:'#796b58'});
          this.add.rectangle(x + 190, y + 186, 340, 2, 0xb5a383);
          for (const faction of ['player', 'enemy']) {
            const view = new UnitView(this, layer, def, faction, 0xd9784e);
            view.sync({def, faction, x: x + (faction === 'player' ? 98 : 282), hp: def.hp, maxHp: def.hp,
              reload: 0, engaging: false, phase: -0.95}, 1 / 60);
            view.container.y = y + 181;
            view.container.setScale(faction === 'player' ? 1.18 : -1.18, 1.18);
            views.push(view);
          }
        }
        this.add.text(40, 1260, 'Hand-authored ink paths. The same painted limbs are used for walking, attacking and physics corpses.',
          {fontFamily:'Trebuchet MS', fontSize:'17px', color:'#796b58'});
        window.__rosterReady = true;
        window.__checkArt = () => {
          const checks = {units: views.length, bones: 0, paints: 4, mirrored: 0, recycled: false};
          const corpseLayer = this.add.layer();
          const pool = new RagdollPool(this, corpseLayer, 4);
          this.matter.add.rectangle(800, 543, 1600, 30, {isStatic:true});
          for (let i = 0; i < UNITS.length; i++) {
            const def = UNITS[i];
            for (const skin of ['field','ember','goldleaf','iron']) {
              const v = new UnitView(this, layer, def, 'player', 0xd9784e, skin);
              for (const image of v.container.list.filter(obj => obj.type === 'Image')) {
                if (image.texture.key === '__MISSING') throw new Error('Missing artwork ' + def.id);
                checks.bones++;
              }
              v.destroy();
            }
          }
          for (const faction of ['player', 'enemy']) {
            const facing = faction === 'player' ? 1 : -1;
            const def = UNITS[0];
            const v = new UnitView(this, layer, def, faction, 0xd9784e);
            v.sync({def, faction, x:400, hp:def.hp, maxHp:def.hp, reload:1, engaging:true, phase:1.9}, 1 / 60);
            if (v.phase !== 1.9) throw new Error('Walk phase lost');
            const pose = v.pose;
            pool.spawn({x:400, def, faction, dirX:facing, force:1, kind:'impact', accent:0xd9784e, phase:v.phase, pose});
            const corpse = pool.corpses.at(-1);
            for (const limb of corpse.limbs) {
              const expected = pose[limb.spec.name];
              if (Math.abs(limb.body.position.x - (400 + expected.x * facing)) > 0.001 ||
                Math.abs(limb.body.position.y - (524 + expected.y)) > 0.001 ||
                Math.abs(limb.img.rotation - expected.rotation * facing) > 0.001 ||
                limb.img.flipX !== (facing < 0)) throw new Error('Death pose/facing lost ' + limb.spec.name);
            }
            checks.mirrored++; v.destroy();
          }
          for (let i = 0; i < 30; i++) {
            const def = UNITS[i % UNITS.length];
            pool.spawn({x:500+i*5, def, faction:i%2?'enemy':'player', dirX:1, force:1,
              kind:'blast', accent:0xd9784e, phase:0.95});
            if (pool.count > 4 || this.matter.world.localWorld.bodies.length > 25) throw new Error('Corpse budget exceeded');
          }
          pool.update(8);
          if (pool.count || this.matter.world.localWorld.bodies.length !== 1) throw new Error('Corpses did not recycle');
          checks.recycled = true;
          // Transparent borders catch equipment clipped against its atlas tile.
          for (const key of this.textures.getTextureKeys().filter(k => k.startsWith('doodle-army-'))) {
            const t = this.textures.get(key), ctx = t.context;
            for (const name of t.getFrameNames()) {
              const f = t.get(name), a = ctx.getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
              for (let n = 1; n < 127; n++) {
                if ([128+n, 126*128+n, n*128+1, n*128+126].some(pixel => a[pixel*4+3] > 0))
                  throw new Error('Artwork clipped: ' + name);
              }
            }
          }
          checks.atlases = this.textures.getTextureKeys().filter(k => k.startsWith('doodle-army-')).length;
          return checks;
        };
      }
    }
    // Canvas makes a tall contact sheet independent of headless GPU framebuffer limits.
    // The mission smoke test covers the game's AUTO renderer at its normal resolution.
    new Phaser.Game({type:Phaser.CANVAS, width:1600, height:1310, scene:Roster, audio:{noAudio:true},
      powerPreference:'high-performance', antialias:true,
      physics:{default:'matter', matter:{gravity:{y:1}, enableSleeping:true}}, banner:false});
  `, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022',
  alias: { '@': resolve('src') },
});
const browser = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
try {
  const page = await browser.newPage({viewport:{width:1600,height:1310}});
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
  await page.setContent('<style>html,body{margin:0}canvas{display:block}</style>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.waitForFunction(() => window.__rosterReady).catch(error => {
    throw new Error(`Roster failed to render: ${errors.join('; ') || error.message}`);
  });
  await page.waitForTimeout(300);
  await page.screenshot({path:'assets/store/art/unit-roster-preview.png'});
  const checks = await page.evaluate(() => window.__checkArt());
  assert.equal(checks.units, 40);
  assert.equal(checks.atlases, 5);
  assert.equal(checks.mirrored, 2);
  assert(checks.recycled);
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/checks.json`, JSON.stringify(checks, null, 2));
  console.log('Unit artwork checks passed:', checks);
} finally { await browser.close(); }
