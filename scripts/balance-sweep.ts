/**
 * Multi-seed balance sweep. One seed per mission is a weak instrument: a lane
 * war is chaotic enough that a single changed purchase flips the result, so the
 * single-seed harness could not even tell Easy from Normal. This runs every
 * mission over several seeds, at every tier, and reports the player's win rate.
 *
 *   npx tsx scripts/balance-sweep.ts            # 8 seeds, all tiers
 *   SEEDS=20 npx tsx scripts/balance-sweep.ts   # tighter numbers
 *   TIERS=normal,hard npx tsx scripts/balance-sweep.ts
 *   CHECK=1 npx tsx scripts/balance-sweep.ts    # exit 1 if tiers stop ordering
 *
 * Still scripted players, not people. Use it to keep the tiers ordered and to
 * find missions that one plan cannot win at all, not to chase a target rate.
 */
import { LEVELS } from '../src/data/levels';
import type { DifficultyId } from '../src/data/difficulty';
import { run, type Strategy } from './harness-core';

const SEEDS = Number(process.env.SEEDS ?? 8);
const TIERS = (process.env.TIERS ?? 'easy,normal,hard,insane').split(',') as DifficultyId[];
const STRATEGIES: Strategy[] = ['greedy', 'swarm', 'mixed'];

interface Cell {
  wins: number;
  games: number;
  gateWins: number;
  seconds: number;
}

const table: Record<string, Record<number, Cell>> = {};
const overall: Record<string, Cell> = {};

for (const tier of TIERS) {
  table[tier] = {};
  overall[tier] = { wins: 0, games: 0, gateWins: 0, seconds: 0 };
  for (const level of LEVELS) {
    const cell: Cell = { wins: 0, games: 0, gateWins: 0, seconds: 0 };
    for (const strategy of STRATEGIES) {
      for (let s = 0; s < SEEDS; s++) {
        const r = run(level.id, strategy, tier, false, s);
        cell.games++;
        cell.seconds += r.seconds;
        if (r.winner === 'player') {
          cell.wins++;
          if (r.decidedBy === 'gate') cell.gateWins++;
        }
      }
    }
    table[tier][level.id] = cell;
    const o = overall[tier];
    o.wins += cell.wins;
    o.games += cell.games;
    o.gateWins += cell.gateWins;
    o.seconds += cell.seconds;
  }
}

const pct = (n: number, d: number) => `${Math.round((n / Math.max(1, d)) * 100)}%`.padStart(5);

console.log(`player win rate, ${SEEDS} seeds x ${STRATEGIES.length} plans per cell\n`);
console.log('OP  ' + TIERS.map((t) => t.toUpperCase().padStart(7)).join(''));
for (const level of LEVELS) {
  const row = TIERS.map((t) => {
    const c = table[t][level.id];
    return pct(c.wins, c.games).padStart(7);
  });
  console.log(String(level.id).padStart(2, '0') + '  ' + row.join(''));
}
console.log('ALL ' + TIERS.map((t) => pct(overall[t].wins, overall[t].games).padStart(7)).join(''));
console.log(
  'GATE' + TIERS.map((t) => pct(overall[t].gateWins, overall[t].wins).padStart(7)).join('') +
    '   share of wins that broke the gate',
);
console.log(
  'MIN ' +
    TIERS.map((t) => (overall[t].seconds / overall[t].games / 60).toFixed(1).padStart(7)).join('') +
    '   mean match length, minutes',
);

if (process.env.CHECK) {
  // Each harder tier must be no easier than the one before it, overall.
  let ok = true;
  for (let i = 1; i < TIERS.length; i++) {
    const a = overall[TIERS[i - 1]];
    const b = overall[TIERS[i]];
    if (b.wins / b.games > a.wins / a.games) {
      console.error(`tier order broken: ${TIERS[i]} is easier than ${TIERS[i - 1]}`);
      ok = false;
    }
  }
  process.exit(ok ? 0 : 1);
}
