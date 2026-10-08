/** Render the real fort views and verify HP fills stay inside rounded tracks. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const out = process.env.SHOT_DIR ?? '.shots/health-bars';
mkdirSync(out, {recursive:true});
const bundle = await build({
  stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
    import Phaser from 'phaser';
    import { AGES } from './src/data/ages';
    import { BaseView } from './src/game/render/BaseView';
    import { HealthBar } from './src/game/render/HealthBar';
    class Preview extends Phaser.Scene {
      create() {
        this.cameras.main.setBackgroundColor('#f6ebd3');
        this.add.text(24,18,'Rounded castle HP / all five ages',{fontSize:'24px',fontFamily:'Arial',color:'#2d302e'});
        const bases=[];
        for (const [row,faction] of ['player','enemy'].entries()) {
          for (let age=0;age<AGES.length;age++) {
            const x=100+age*200, start=this.children.list.length;
            const base=new BaseView(this,faction,x,AGES[age]);
            const parts=this.children.list.slice(start);
            const group=this.add.container(0,315+row*280-524,parts);
            base.sync({baseHp:row?120:750,baseMaxHp:1000,slots:[null,null,null,null],unlockedSlots:1},AGES[age]);
            bases.push({base,group,age});
          }
        }
        const samples=[];
        for (const [i,ratio] of [0,0.005,0.02,0.24,0.5,1].entries()) {
          const x=85+i*165, y=690;
          const bar=new HealthBar(this,132,10,0xe39a32).setPosition(x,y);
          bar.setProgress(ratio);
          this.add.text(x,660,Math.round(ratio*10000)/100+'% HP',{fontSize:'14px',fontFamily:'Arial',color:'#2d302e'}).setOrigin(0.5);
          samples.push({bar,x,y,ratio,width:132,height:10});
        }
        // The same helper is used by damaged soldiers at their smaller scale.
        for (const [i,ratio] of [0.005,0.5,1].entries()) {
          const x=200+i*300,y=735;
          const bar=new HealthBar(this,40,4,0xe39a32,0xfff5da,1).setPosition(x,y);
          bar.setProgress(ratio);
          samples.push({bar,x,y,ratio,width:40,height:4});
        }
        window.__healthCheck=()=>{
          const ctx=this.game.canvas.getContext('2d');
          let checked=0;
          for (const s of samples) {
            const left=s.x-s.width/2,top=s.y-s.height/2;
            const pixels=ctx.getImageData(left-2,top-2,s.width+4,s.height+4).data;
            let fills=0;
            for(let y=0;y<s.height+4;y++)for(let x=0;x<s.width+4;x++){
              const p=(y*(s.width+4)+x)*4;
              // Exact fill pixels exclude the ink outline and anti-alias fringe.
              if(pixels[p]===0xe3&&pixels[p+1]===0x9a&&pixels[p+2]===0x32){
                fills++; const px=x-2+0.5,py=y-2+0.5,r=s.height/2;
                const cx=Math.max(r,Math.min(s.width-r,px));
                if(Math.hypot(px-cx,py-r)>r+0.01) throw new Error('Fill escaped rounded track at '+s.ratio);
                if(px>s.width*s.ratio+1) throw new Error('HP remainder is too wide at '+s.ratio);
              }
            }
            if(s.ratio===0&&fills)throw new Error('Zero HP still shows fill');
            if(s.ratio>=0.24&&!fills)throw new Error('Visible HP fill is missing');
            const corner=[...ctx.getImageData(left,top,1,1).data];
            // The curve may lightly antialias this pixel; a square ink corner
            // would be dark rather than mostly paper.
            if(s.height===10&&(corner[0]<200||corner[1]<190||corner[2]<170))throw new Error('Castle track has a square corner: '+corner);
            checked++;
          }
          for(const {base,age} of bases){
            base.sync({baseHp:0,baseMaxHp:1000,slots:[null,null,null,null],unlockedSlots:1},AGES[age]);
            if(base.hpText.text!=='0')throw new Error('Zero castle HP text is incorrect');
            base.sync({baseHp:1500,baseMaxHp:1000,slots:[null,null,null,null],unlockedSlots:1},AGES[age]);
            base.refreshAge(AGES[(age+1)%AGES.length]);
            base.destroy();
          }
          return {forts:bases.length,samples:checked};
        };
        window.__healthReady=true;
      }
    }
    new Phaser.Game({type:Phaser.CANVAS,width:1000,height:780,scene:Preview,audio:{noAudio:true},banner:false});
  `},
  bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',alias:{'@':resolve('src')},
});
const browser=await chromium.launch({args:['--no-sandbox']});
try {
  const page=await browser.newPage({viewport:{width:1000,height:780}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0}canvas{display:block}</style>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.waitForFunction(()=>window.__healthReady);
  await page.waitForTimeout(150);
  await page.screenshot({path:`${out}/rounded-castle-hp.png`});
  const checks=await page.evaluate(()=>window.__healthCheck());
  assert.deepEqual(checks,{forts:10,samples:9});
  assert.deepEqual(errors,[]);
  console.log('Rounded health rendering passed: ten forts, nine HP samples, tiny/empty fills, age changes and cleanup.');
} finally {await browser.close();}
