/** Verify upload file formats and dimensions, without changing any artwork. */
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

function png(file, width, height, colourType) {
  const path = `assets/store/${file}`;
  const data = readFileSync(path);
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file}: PNG signature`);
  assert.equal(data.readUInt32BE(16), width, `${file}: width`);
  assert.equal(data.readUInt32BE(20), height, `${file}: height`);
  assert.equal(data[24], 8, `${file}: eight bits per channel`);
  assert.equal(data[25], colourType, `${file}: colour channels`);
}
png('icons/doodlebook-icon-1024.png', 1024, 1024, 2); // RGB, no alpha for Apple source
png('icons/doodlebook-icon-512.png', 512, 512, 6); // RGBA for Play
png('icons/doodlebook-icon-192.png', 192, 192, 2);
assert(statSync('assets/store/icons/doodlebook-icon-512.png').size <= 1024 * 1024);
png('art/doodlebook-feature-1024x500.png', 1024, 500, 2);
png('art/doodlebook-thumbnail-1920x1080.png', 1920, 1080, 2);
const manifest = JSON.parse(readFileSync('assets/store/capture-manifest.json', 'utf8'));
assert.equal(manifest.captures.length, 14);
for (const capture of manifest.captures) png(capture.file, capture.width, capture.height, 2);
console.log('Verified PNG formats, opaque screenshots/feature graphic, Play RGBA icon and all 14 screenshot dimensions. Native recapture still required.');
