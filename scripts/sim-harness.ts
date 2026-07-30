/**
 * Headless balance harness. Runs whole missions with a scripted player so the
 * sim can be checked without a browser: does contact happen, do units die, does
 * a base actually fall, and how long does each mission take.
 *
 *   npx tsx scripts/sim-harness.ts
 *   npx tsx scripts/sim-harness.ts 4      # one mission, verbose timeline
 */
import { AGES } from '../src/data/ages';
import { LEVELS, levelById } from '../src/data/levels';
import { unitsForAge } from '../src/data/units';
import { turretsForAge } from '../src/data/turrets';
import { SIM } from '../src/game/config';
import { DIFFICULTIES, type DifficultyId } from '../src/data/difficulty';
import { BattleSim } from '../src/game/sim/BattleSim';
import { EnemyCommander } from '../src/game/sim/EnemyCommander';
import { SURVIVAL_LEVEL, SurvivalDirector } from '../src/game/sim/SurvivalDirector';

interface Result {
  level: number;
  winner: 'player' | 'enemy' | 'timeout';
  seconds: number;
  firstContact: number | null;
  firstDeath: number | null;
  kills: number;
  losses: number;
  peakAge: number;
  maxOnField: number;
  ragdollsPerMinute: number;
  /** Where the fighting settled, as a fraction of the lane. 0.5 is a grind. */
  meanFront: number;
  /** How much of each gate was actually chewed off. */
  theirGatePct: number;
  myGatePct: number;
  /** Mean gold sitting unspent. High means the throttle is the gate, not money. */
  meanIdleGold: number;
  /** True when the clock decided it rather than a gate falling. */
  decidedBy: string;
}

type Strategy = 'greedy' | 'swarm' | 'mixed';

/**
 * Scripted players, used to check that the mission is winnable by more than one
 * plan. If every strategy loses, the geometry is too defensive; if only one
 * wins, the roster has a dominant answer and the other three roles are decoration.
 *
 *   greedy  buys the most expensive thing it can afford
 *   swarm   floods the cheapest melee, never banks
 *   mixed   holds with melee, wins the ranged trade, keeps emplacements up
 */
function playerTurn(sim: BattleSim, strategy: Strategy, tick: number): void {
  const c = sim.player;
  if (sim.canEvolve('player')) {
    sim.evolve('player');
    return;
  }

  const age = AGES[c.ageIndex].id;
  const roster = unitsForAge(age);

  if (!sim.level.modifiers.includes('no-turrets')) {
    const empty = c.slots.findIndex((s, i) => i < c.unlockedSlots && s === null);
    if (empty >= 0) {
      const options = [...turretsForAge(age)].sort((a, b) => b.gold - a.gold);
      const pick = options.find((t) => c.gold >= t.gold);
      if (pick) {
        sim.buildTurret('player', empty, pick.id);
        return;
      }
    }
  }

  let near = 0;
  for (const u of sim.units) {
    if (u.faction === 'enemy' && u.x - c.baseX < 620) near++;
  }
  if (near >= 3 && c.specialCd <= 0) {
    sim.fireSpecial('player');
    return;
  }

  const buy = (id: string | undefined) => {
    if (!id) return false;
    return sim.queueUnit('player', id) === 'ok';
  };
  const byRole = (role: string) => roster.find((u) => u.role === role)?.id;

  if (strategy === 'swarm') {
    buy(byRole('melee'));
    return;
  }

  if (strategy === 'mixed') {
    // Three melee to two ranged, with a heavy whenever one is affordable.
    const heavy = roster.find((u) => u.role === 'heavy');
    if (heavy && c.gold >= heavy.gold * 1.4 && buy(heavy.id)) return;
    if (tick % 5 < 3) {
      if (buy(byRole('melee'))) return;
    } else if (buy(byRole('ranged'))) return;
    buy(byRole('melee'));
    return;
  }

  for (const def of [...roster].sort((a, b) => b.gold - a.gold)) {
    if (c.gold >= def.gold && (c.cooldowns[def.id] ?? 0) <= 0) {
      sim.queueUnit('player', def.id);
      return;
    }
  }
}

function run(
  levelId: number,
  strategy: Strategy,
  tier: DifficultyId = 'normal',
  verbose = false,
): Result {
  const level = levelById(levelId);
  const sim = new BattleSim(level, 1337 + levelId * 977, tier);
  const ai = new EnemyCommander(sim, (1337 + levelId * 977) ^ 0x5f3a);

  let think = 0;
  let ticks = 0;
  let firstContact: number | null = null;
  let firstDeath: number | null = null;
  let deaths = 0;
  let maxOnField = 0;
  let samples = 0;
  let frontSum = 0;
  let goldSum = 0;
  const limit = 60 * 10; // the sim has its own clock now; this is just a guard

  while (!sim.over && sim.elapsed < limit) {
    sim.advance(SIM.step);
    ai.update(SIM.step);

    think -= SIM.step;
    if (think <= 0) {
      think = 0.4;
      playerTurn(sim, strategy, ticks++);
    }

    for (const ev of sim.events) {
      if (ev.t === 'death') {
        deaths++;
        if (firstDeath === null) {
          firstDeath = sim.elapsed;
          if (verbose) console.log(`  ${fmt(sim.elapsed)} first kill`);
        }
      }
      if (ev.t === 'evolve' && verbose) {
        console.log(`  ${fmt(sim.elapsed)} ${ev.faction} -> ${AGES[ev.ageIndex].name}`);
      }
    }
    sim.clearEvents();

    if (firstContact === null) {
      for (const u of sim.units) {
        if (!u.engaging) continue;
        firstContact = sim.elapsed;
        if (verbose) console.log(`  ${fmt(sim.elapsed)} first contact at ${Math.round(u.x)}m`);
        break;
      }
    }

    maxOnField = Math.max(maxOnField, sim.units.length);

    samples++;
    frontSum += (sim.frontLine('player') + sim.frontLine('enemy')) / 2 / sim.laneLength;
    goldSum += sim.player.gold;
  }

  return {
    meanFront: frontSum / Math.max(1, samples),
    theirGatePct: (1 - sim.enemy.baseHp / sim.enemy.baseMaxHp) * 100,
    myGatePct: (1 - sim.player.baseHp / sim.player.baseMaxHp) * 100,
    meanIdleGold: goldSum / Math.max(1, samples),
    decidedBy: sim.decidedBy,
    level: levelId,
    winner: sim.over ?? 'timeout',
    seconds: sim.elapsed,
    firstContact,
    firstDeath,
    kills: sim.stats.player.kills,
    losses: sim.stats.player.losses,
    peakAge: sim.player.ageIndex,
    maxOnField,
    ragdollsPerMinute: deaths / (sim.elapsed / 60),
  };
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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


/*
 * Survival probe. Waves are authored, so the interesting number is how many a
 * given plan holds before the gate goes down, and whether it ends at all.
 */
function runSurvival(strategy: Strategy): { waves: number; seconds: number } {
  const sim = new BattleSim(SURVIVAL_LEVEL, 909, 'normal');
  const waves = new SurvivalDirector(sim, 0x77a1);
  let think = 0;
  let ticks = 0;
  const limit = 60 * 25;

  while (!sim.over && sim.elapsed < limit) {
    sim.advance(SIM.step);
    waves.update(SIM.step);
    think -= SIM.step;
    if (think <= 0) {
      think = 0.4;
      playerTurn(sim, strategy, ticks++);
    }
    sim.clearEvents();
  }
  return { waves: waves.wavesSent, seconds: sim.elapsed };
}

console.log('\n== SURVIVAL ==');
for (const strategy of strategies) {
  const r = runSurvival(strategy);
  console.log(`${strategy.padEnd(7)} held ${String(r.waves).padStart(3)} waves in ${fmt(r.seconds)}`);
}
