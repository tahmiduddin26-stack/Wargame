/**
 * Headless balance harness. Runs whole missions with a scripted player so the
 * sim can be checked without a browser: does contact happen, do units die, does
 * a base actually fall, and how long does each mission take.
 *
 *   npx tsx scripts/sim-harness.ts
 *   npx tsx scripts/sim-harness.ts 4      # one mission, verbose timeline
 */
import { LEVELS, levelById } from '../src/data/levels';
import type { DifficultyId } from '../src/data/difficulty';
import { fmt, run, runSurvival, type Result, type Strategy } from './harness-core';

const only = process.argv[2] ? Number(process.argv[2]) : null;
const targets = only ? [levelById(only)] : LEVELS;
const strategies: Strategy[] = ['greedy', 'swarm', 'mixed'];
const tier = (process.env.TIER as DifficultyId) ?? 'normal';
console.log(`tier: ${tier}`);

for (const strategy of strategies) {
  const rows: Result[] = [];
  for (const level of targets) rows.push(run(level.id, strategy, tier, !!only));

  console.log(`\n== ${strategy.toUpperCase()} ==`);
  console.log(
    'OP  WINNER   TIME   CONTACT  KILLS  LOST  AGE  FIELD  C/MIN  FRONT  THEIRGATE  MYGATE  IDLEGOLD  BY',
  );
  for (const r of rows) {
    console.log(
      [
        String(r.level).padStart(2, '0'),
        r.winner.padEnd(8),
        fmt(r.seconds).padEnd(6),
        (r.firstContact != null ? fmt(r.firstContact) : '--').padEnd(8),
        String(r.kills).padStart(5),
        String(r.losses).padStart(5),
        String(r.peakAge + 1).padStart(4),
        String(r.maxOnField).padStart(6),
        r.ragdollsPerMinute.toFixed(0).padStart(6),
        r.meanFront.toFixed(2).padStart(6),
        (r.theirGatePct.toFixed(0) + '%').padStart(10),
        (r.myGatePct.toFixed(0) + '%').padStart(7),
        r.meanIdleGold.toFixed(0).padStart(9),
        r.decidedBy.padStart(10),
      ].join(' '),
    );
  }
  const wins = rows.filter((r) => r.winner === 'player').length;
  console.log(`${strategy}: player wins ${wins}/${rows.length}`);
}


console.log('\n== SURVIVAL ==');
for (const strategy of strategies) {
  const r = runSurvival(strategy);
  console.log(`${strategy.padEnd(7)} held ${String(r.waves).padStart(3)} waves in ${fmt(r.seconds)}`);
}
