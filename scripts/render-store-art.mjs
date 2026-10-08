/** Export code-native type/layout around the untouched generated illustration. */
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = resolve('assets/store');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ deviceScaleFactor: 1 });
try {
  // Extend the existing authored vector identity. Store masters have no outer mask.
  const icon = readFileSync(`${root}/source/app-icon-v1.svg`, 'utf8');
  mkdirSync(`${root}/icons`, { recursive: true });
  for (const size of [1024, 512, 192]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{width:100%;height:100%;display:block}</style>${icon}`);
    if (size === 512) {
      // Canvas PNG retains a 32-bit RGBA channel as required by Play, with opaque artwork.
      const png = await page.evaluate(async (size) => {
        const svg = document.querySelector('svg').cloneNode(true);
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        const image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML);
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      }, size);
      writeFileSync(`${root}/icons/doodlebook-icon-${size}.png`, Buffer.from(png, 'base64'));
    } else {
      await page.screenshot({ path: `${root}/icons/doodlebook-icon-${size}.png` });
    }
  }
  copyFileSync(`${root}/source/app-icon-v1.svg`, 'public/app-icon-doodlebook.svg');
  for (const size of [192, 512]) copyFileSync(`${root}/icons/doodlebook-icon-${size}.png`, `public/app-icon-doodlebook-${size}.png`);
  mkdirSync(`${root}/art`, { recursive: true });
  for (const [name, width, height] of [['thumbnail', 1920, 1080], ['feature', 1024, 500]]) {
    await page.setViewportSize({ width, height });
    await page.goto(pathToFileURL(`${root}/source/marketing-layout.html`).href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode()));
    });
    assert.equal(await page.locator('.title').innerText(), 'Doodlebook\nBattles');
    await page.screenshot({ path: `${root}/art/doodlebook-${name}-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(pathToFileURL(`${root}/index.html`).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${root}/art/launch-pack-preview.png`, fullPage: true });
  for (const file of ['doodlebook-thumbnail-1920x1080.png', 'doodlebook-feature-1024x500.png', 'launch-pack-preview.png']) {
    assert(statSync(`${root}/art/${file}`).size > 1000);
    console.log(`Exported art/${file}`);
  }
} finally {
  await browser.close();
}
