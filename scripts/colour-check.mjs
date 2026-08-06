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
 * Both panel finishes are checked. A light palette is not the dark one with the
 * lightness flipped — its accents are hand-darkened to survive on board — so it
 * is a second set of hues that has to clear the same bar, and the contrast pass
 * at the end is where a light theme actually tends to fail.
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

/** Pulls one declaration block out by its selector. */
function block(selector) {
  const at = css.indexOf(selector + ' {');
  if (at < 0) throw new Error(`selector ${selector} not found in global.css`);
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
}

/**
 * Raw declarations: a hex, or an alias to another token. Aliases are how the
 * palette states that two roles are deliberately the same colour, so they are
 * kept rather than flattened at parse time.
 */
function rawTokens(selector) {
  const body = block(selector);
  const map = new Map();
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6}|var\(--[\w-]+\))/g)) {
    map.set(m[1], m[2]);
  }
  return map;
}

/*
 * Resolve AFTER merging, never before.
 *
 * Day restates only what it changes, so `--steel-900: var(--tent)` is declared
 * once in the dark block and has to pick up day's `--tent` when it is read in
 * day. Flattening each block on its own quietly measured day's ink against
 * night's page and reported two failures that did not exist.
 */
function resolve(raw) {
  const out = new Map();
  for (const name of raw.keys()) {
    let value = raw.get(name);
    for (let hop = 0; hop < 8; hop++) {
      const alias = /^var\(--([\w-]+)\)$/.exec(value);
      if (!alias) break;
      value = raw.get(alias[1]);
      if (!value) break;
    }
    if (value && value.startsWith('#')) out.set(name, value);
  }
  return out;
}

const darkRaw = rawTokens(':root');
const dark = resolve(darkRaw);
const light = resolve(new Map([...darkRaw, ...rawTokens(":root[data-theme='light']")]));

const THEMES = [
  { name: 'night', tokens: dark },
  { name: 'day', tokens: light },
];

function token(theme, name) {
  const hex = theme.tokens.get(name);
  if (!hex) throw new Error(`token --${name} not found for ${theme.name}`);
  return hex;
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
    a: 'mult-strong',
    b: 'bone-faint',
    why: 'counter table: strong multiplier vs weak',
    critical: true,
  },
  { a: 'player', b: 'moss', why: 'gold meter vs experience meter', critical: false },
];

const KINDS = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];

/*
 * Contrast. Ink has to clear 4.5:1 on its own page, and an accent drawn as a
 * bare mark — a gate bar, a meter fill, a cleared-tier pip — has to clear 3:1,
 * because nothing else distinguishes it from the surface it sits on.
 */
const ON_PAGE = [
  { token: 'bone', min: 4.5, what: 'body ink' },
  { token: 'bone-dim', min: 4.5, what: 'secondary ink' },
  { token: 'bone-faint', min: 4.5, what: 'labels and readout captions' },
  { token: 'ochre-ink', min: 4.5, what: 'gold figures, ready edges' },
  { token: 'mult-strong', min: 4.5, what: 'counter table strong multiplier' },
  { token: 'oxide-ink', min: 4.5, what: 'denied costs, loss verdict' },
  { token: 'moss-ink', min: 4.5, what: 'cleared and fitted marks' },
  { token: 'player', min: 3, what: 'your gate bar and blips' },
  { token: 'enemy', min: 3, what: 'enemy gate bar and blips' },
  { token: 'ochre', min: 3, what: 'meter fills, primary button plate' },
  { token: 'moss', min: 3, what: 'tier pips' },
];

/** What sits on top of an --ochre fill, which is the other half of the button. */
const ON_ACCENT = [{ ink: 'on-accent', fill: 'ochre', min: 4.5, what: 'primary button label' }];

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

function contrast(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const failures = [];

for (const theme of THEMES) {
  console.log(`\n== ${theme.name.toUpperCase()} ==`);
  console.log('\nColour separation, CIE76 dE (fail under ' + MIN_DE + ')\n');
  const header = ['pair'.padEnd(18), ...KINDS.map((k) => k.slice(0, 6).padStart(8))].join(' ');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const pair of PAIRS) {
    const hexA = token(theme, pair.a);
    const hexB = token(theme, pair.b);
    const cells = KINDS.map((kind) => {
      const d = deltaE(hexA, hexB, kind);
      if (pair.critical && d < MIN_DE) {
        failures.push(
          `[${theme.name}] ${pair.a}/${pair.b} under ${kind}: dE ${d.toFixed(1)} (${pair.why})`,
        );
      }
      return (d < MIN_DE ? '!' : ' ') + d.toFixed(1).padStart(7);
    });
    console.log([`${pair.a}/${pair.b}`.padEnd(18), ...cells].join(' '));
  }

  const page = token(theme, 'steel-900');
  console.log(`\nContrast on the page (${page})\n`);
  for (const check of [...ON_PAGE]) {
    const hex = token(theme, check.token);
    const ratio = contrast(hex, page);
    const bad = ratio < check.min;
    if (bad) {
      failures.push(
        `[${theme.name}] --${check.token} on --steel-900: ${ratio.toFixed(2)}:1, ` +
          `needs ${check.min}:1 (${check.what})`,
      );
    }
    console.log(
      `  ${bad ? '!' : ' '} ${check.token.padEnd(12)} ${hex}  ` +
        `${ratio.toFixed(2).padStart(6)}:1  min ${check.min}   ${check.what}`,
    );
  }

  for (const check of ON_ACCENT) {
    const ink = token(theme, check.ink);
    const fill = token(theme, check.fill);
    const ratio = contrast(ink, fill);
    const bad = ratio < check.min;
    if (bad) {
      failures.push(
        `[${theme.name}] --${check.ink} on --${check.fill}: ${ratio.toFixed(2)}:1, ` +
          `needs ${check.min}:1 (${check.what})`,
      );
    }
    console.log(
      `  ${bad ? '!' : ' '} ${check.ink.padEnd(12)} ${ink}  ` +
        `${ratio.toFixed(2).padStart(6)}:1  min ${check.min}   ${check.what} (on --${check.fill})`,
    );
  }

  console.log('\nHow the faction pair actually looks to each type:');
  for (const name of ['player', 'enemy']) {
    const hex = token(theme, name);
    const seen = KINDS.map((k) => `${k.slice(0, 5)} ${asHex(simulate(hex, k))}`).join('   ');
    console.log(`  ${name.padEnd(7)} ${hex}   ${seen}`);
  }
}

if (failures.length) {
  console.log('\nFAIL');
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('\nPASS: both finishes stay separable and legible under all three conditions.');
