/**
 * One-shot rebalance pass over src/data/units.ts. Kept in the repo so the
 * numbers below are reviewable next to the reasoning in units.ts, rather than
 * appearing in a diff with no explanation.
 *
 *   node scripts/retune-units.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const TUNING = {
  clubman: { hp: 44, damage: 24, rate: 0.85, range: 30, speed: 46, bounty: 17, loot: 10, cooldown: 0.5 },
  slinger: { hp: 26, damage: 24, rate: 0.7, range: 150, speed: 40, bounty: 33, loot: 21, cooldown: 0.9 },
  'dino-rider': { hp: 140, damage: 64, rate: 0.7, range: 34, speed: 58, bounty: 120, loot: 75, cooldown: 3 },
  'boulder-hurler': { hp: 48, damage: 70, rate: 0.35, blast: 55, range: 250, speed: 26, bounty: 210, loot: 130, cooldown: 4.5 },

  spearman: { hp: 120, damage: 61, rate: 0.9, range: 38, speed: 48, bounty: 66, loot: 39, cooldown: 0.6 },
  longbowman: { hp: 66, damage: 62, rate: 0.75, range: 200, speed: 42, bounty: 126, loot: 75, cooldown: 0.9 },
  knight: { hp: 385, damage: 172, rate: 0.7, range: 38, speed: 56, bounty: 550, loot: 325, cooldown: 4 },
  trebuchet: { hp: 132, damage: 250, rate: 0.28, blast: 70, range: 320, speed: 22, bounty: 700, loot: 415, cooldown: 6 },

  musketeer: { hp: 240, damage: 198, rate: 0.55, range: 120, speed: 46, bounty: 210, loot: 124, cooldown: 0.8 },
  grenadier: { hp: 200, damage: 185, rate: 0.5, blast: 45, range: 160, speed: 44, bounty: 363, loot: 215, cooldown: 1.5 },
  cuirassier: { hp: 780, damage: 320, rate: 0.75, range: 40, speed: 64, bounty: 1200, loot: 715, cooldown: 5 },
  'field-cannon': { hp: 300, damage: 620, rate: 0.25, blast: 80, range: 360, speed: 20, bounty: 1650, loot: 975, cooldown: 7 },

  rifleman: { hp: 500, damage: 206, rate: 1.1, range: 170, speed: 50, bounty: 470, loot: 280, cooldown: 0.7 },
  'machine-gunner': { hp: 620, damage: 60, rate: 3.2, range: 200, speed: 42, bounty: 860, loot: 507, cooldown: 1.6 },
  'battle-tank': { hp: 2350, damage: 1000, rate: 0.5, blast: 32, range: 215, speed: 58, bounty: 2950, loot: 1755, cooldown: 7 },
  'rocket-truck': { hp: 700, damage: 1800, rate: 0.2, blast: 100, range: 420, speed: 32, bounty: 3500, loot: 2080, cooldown: 9 },

  'exo-trooper': { hp: 1250, damage: 473, rate: 1.2, range: 155, speed: 54, bounty: 1050, loot: 618, cooldown: 0.8 },
  railgunner: { hp: 1000, damage: 805, rate: 0.6, range: 275, speed: 46, bounty: 1980, loot: 1170, cooldown: 1.9 },
  'assault-mech': { hp: 6000, damage: 2080, rate: 0.6, blast: 45, range: 230, speed: 52, bounty: 6800, loot: 4030, cooldown: 10 },
  'ion-battery': { hp: 1600, damage: 5000, rate: 0.18, blast: 130, range: 480, speed: 26, bounty: 8250, loot: 4875, cooldown: 12 },
};

const TURRETS = {
  // Reach, not damage, was what pinned the front line to the centre of the map:
  // four invulnerable emplacements covering half the lane made any push
  // impossible. So dps is back to roughly one same-age melee unit, and the reach
  // only covers the gate approach. Gold scaled to suit.
  'rock-chucker': { gold: 80, damage: 15, rate: 1.4, range: 150 },
  'spear-post': { gold: 140, damage: 34, rate: 0.6, range: 240 },
  'log-drop': { gold: 190, damage: 51, rate: 0.4, blast: 60, range: 190 },

  'arrow-slit': { gold: 280, damage: 34, rate: 1.6, range: 170 },
  ballista: { gold: 480, damage: 100, rate: 0.55, range: 270 },
  'pitch-catapult': { gold: 600, damage: 152, rate: 0.36, blast: 75, range: 215 },

  'swivel-gun': { gold: 850, damage: 60, rate: 1.8, range: 185 },
  'long-nine': { gold: 1400, damage: 218, rate: 0.5, range: 300 },
  'howitzer-pit': { gold: 1750, damage: 340, rate: 0.32, blast: 90, range: 245 },

  'auto-cannon': { gold: 2300, damage: 87, rate: 2.6, range: 200 },
  'atgm-nest': { gold: 3400, damage: 566, rate: 0.4, blast: 28, range: 320 },
  'mortar-battery': { gold: 3850, damage: 755, rate: 0.3, blast: 110, range: 265 },

  'pulse-array': { gold: 5400, damage: 189, rate: 3, range: 215 },
  'rail-turret': { gold: 8100, damage: 1620, rate: 0.35, range: 350 },
  'graviton-well': { gold: 9300, damage: 2027, rate: 0.28, blast: 145, range: 290 },
};

function apply(file, table) {
  let src = readFileSync(file, 'utf8');
  for (const [id, fields] of Object.entries(table)) {
    for (const [key, value] of Object.entries(fields)) {
      const re = new RegExp(`(id: '${id}',[\\s\\S]{0,700}?\\n    ${key}: )[0-9.]+`);
      // Check the pattern, not whether the text changed: a value that is
      // already correct produces an identical string and is not a failure.
      if (!re.test(src)) throw new Error(`no match for ${id}.${key}`);
      src = src.replace(re, `$1${value}`);
    }
  }
  writeFileSync(file, src);
  console.log(`${file}: ${Object.keys(table).length} entries retuned`);
}

apply('src/data/units.ts', TUNING);
apply('src/data/turrets.ts', TURRETS);
