/**
 * Colour-vision check for the pairs the game asks players to tell apart.
 *
 * Friend and foe identification is the entire read of a lane war: which blips on
 * the strip are yours, whose gate meter is whose, which units in the melee to
 * count. If that rests on a hue pair that collapses under common colour
 * blindness, the game is unplayable for roughly one man in twelve and there is
 * no in-game way to discover why.
 *
 * Simulates protanopia, deuteranopia and tritanopia (Viénot, Brettel & Mollon
 * 1999 LMS method) and reports CIE76 dE between each pair under each condition.
 *
 *   node scripts/colour-check.mjs
 */
import { readFileSync } from 'node:fs';

/** dE76 below this is a fail: the two colours read as the same. */
const MIN_DE = 20;

// ---------------------------------------------------------------- colour maths

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Viénot 1999 dichromat simulation, done in linear RGB via LMS. */
const RGB_TO_LMS = [
  [0.31399022, 0.63951294, 0.04649755],
  [0.15537241, 0.75789446, 0.08670142],
  [0.01775239, 0.10944209, 0.87256922],
];
const LMS_TO_RGB = [
  [5.47221206, -4.6419601, 0.16963708],
  [-1.1252419, 2.29317094, -0.1678952],
  [0.02980165, -0.19318073, 1.16364789],
];
const SIM = {
  normal: null,
  protanopia: [
    [0, 1.05118294, -0.05116099],
    [0, 1, 0],
    [0, 0, 1],
  ],
  deuteranopia: [
    [1, 0, 0],
    [0.9513092, 0, 0.04866992],
    [0, 0, 1],
  ],
  tritanopia: [
    [1, 0, 0],
    [0, 1, 0],
    [-0.86744736, 1.86727089, 0],
  ],
};

const apply = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

function simulate(hex, kind) {
  const lin = hexToRgb(hex).map(srgbToLinear);
  if (!SIM[kind]) return lin;
  const lms = apply(RGB_TO_LMS, lin);
  return apply(LMS_TO_RGB, apply(SIM[kind], lms));
}

/** Linear RGB -> CIELAB (D65). */
function toLab(lin) {
  const [r, g, b] = lin.map((c) => Math.min(1, Math.max(0, c)));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(hexA, hexB, kind) {
  const a = toLab(simulate(hexA, kind));
  const b = toLab(simulate(hexB, kind));
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const asHex = (lin) =>
  '#' +
  lin
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

// ------------------------------------------------------------------- the pairs

const css = readFileSync('src/styles/global.css', 'utf8');
function token(name) {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(css);
  if (!m) throw new Error(`token --${name} not found in global.css`);
  return m[1];
}

const PAIRS = [
  {
    a: 'player',
    b: 'enemy',
    why: 'friend vs foe: lane blips, gate meters, every unit on the field',
    critical: true,
  },
  {
    a: 'player',
    b: 'oxide',
    why: 'your colour vs the danger colour: an unaffordable cost sits beside gold',
    critical: true,
  },
  {
    a: 'enemy',
    b: 'oxide',
    why: 'enemy vs danger: both appear on the lane strip at once',
    critical: false,
  },
  {
    a: 'ochre',
    b: 'bone-faint',
    why: 'counter table: strong multiplier vs weak',
    critical: true,
  },
  { a: 'player', b: 'moss', why: 'gold meter vs experience meter', critical: false },
];

const KINDS = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];

console.log('Colour separation, CIE76 dE (fail under ' + MIN_DE + ')\n');
const header = ['pair'.padEnd(18), ...KINDS.map((k) => k.slice(0, 6).padStart(8))].join(' ');
console.log(header);
console.log('-'.repeat(header.length));

const failures = [];
for (const pair of PAIRS) {
  const hexA = token(pair.a);
  const hexB = token(pair.b);
  const cells = KINDS.map((kind) => {
    const d = deltaE(hexA, hexB, kind);
    if (pair.critical && d < MIN_DE) {
      failures.push(`${pair.a}/${pair.b} under ${kind}: dE ${d.toFixed(1)} (${pair.why})`);
    }
    return (d < MIN_DE ? '!' : ' ') + d.toFixed(1).padStart(7);
  });
  console.log([`${pair.a}/${pair.b}`.padEnd(18), ...cells].join(' '));
}

console.log('\nHow the faction pair actually looks to each type:');
for (const name of ['player', 'enemy']) {
  const hex = token(name);
  const seen = KINDS.map((k) => `${k.slice(0, 5)} ${asHex(simulate(hex, k))}`).join('   ');
  console.log(`  ${name.padEnd(7)} ${hex}   ${seen}`);
}

if (failures.length) {
  console.log('\nFAIL');
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('\nPASS: every critical pair stays separable under all three conditions.');
