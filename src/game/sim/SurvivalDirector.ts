import { AGES } from '@/data/ages';
import { turretsForAge } from '@/data/turrets';
import { UNIT_BY_ID, unitsForAge } from '@/data/units';
import type { LevelDef, UnitRole } from '@/data/types';
import { BattleSim } from './BattleSim';
import { Rng } from './rng';

/**
 * Survival: endless authored waves, as the sequel's own survival mode does.
 *
 * This replaces EnemyCommander rather than tuning it. A wave is a written
 * composition granted in full and sent at once, which is a different threat shape
 * from a commander trickling purchases out of an income curve: waves arrive as
 * spikes you have to survive, with a breather between them to rebuild.
 *
 * The enemy has no economy here. The director grants exactly what a wave costs
 * and then buys it through the sim's ordinary public methods, so nothing about
 * combat resolution is special-cased for this mode.
 */

export interface WavePlan {
  index: number;
  /** Age the wave is drawn from. */
  ageIndex: number;
  /** Role counts in this wave. */
  composition: Partial<Record<UnitRole, number>>;
}

export const SURVIVAL_LEVEL: LevelDef = {
  id: 0,
  name: 'THE LONG WATCH',
  briefing: 'No relief is coming. Hold the gate for as long as you can.',
  baseHp: 2600,
  startGold: 420,
  income: 11,
  maxAge: 4,
  // Survival ends when the gate falls, never on a clock.
  timeLimit: Number.MAX_SAFE_INTEGER,
  enemy: { aggression: 1, economy: 0, warmup: 0 },
  modifiers: [],
  reward: 0,
};

/**
 * Enemy hitpoint and damage multiplier by wave.
 *
 * Flat while the age ladder is still climbing, because a new age is escalation
 * enough, then compounding once there is nothing above Future Age. This is the
 * whole reason a run ends: the field is capped at a dozen units a side, so waves
 * cannot grow their way through a dug-in gate, and a run without it goes past a
 * hundred and forty waves and nineteen minutes.
 */
function veterancy(index: number): number {
  if (index <= 22) return 1 + index * 0.012;
  return 1.264 * Math.pow(1.055, index - 22);
}

/** Seconds between waves. Shrinks as the night goes on, to a floor. */
function waveGap(index: number): number {
  return Math.max(7, 22 - index * 0.6);
}

/**
 * Which age a wave is drawn from. Deliberately slower than the player can
 * evolve, so a prepared commander is always slightly ahead of the wave that is
 * coming, and falling behind on experience is what eventually kills you.
 */
function waveAge(index: number): number {
  if (index < 4) return 0;
  if (index < 9) return 1;
  if (index < 15) return 2;
  if (index < 22) return 3;
  return 4;
}

export function planWave(index: number): WavePlan {
  const ageIndex = waveAge(index);
  // Waves grow within an age, then reset thinner when the age steps up, so an
  // age change reads as a spike in quality rather than one more body.
  const sinceStep = index - [0, 4, 9, 15, 22][ageIndex];
  const size = 2 + Math.floor(sinceStep * 0.7);

  return {
    index,
    ageIndex,
    composition: {
      melee: 1 + Math.ceil(size * 0.5),
      ranged: Math.floor(size * 0.35),
      heavy: index >= 3 ? 1 + Math.floor(sinceStep / 4) : 0,
      artillery: index >= 6 && sinceStep >= 2 ? 1 : 0,
    },
  };
}

export class SurvivalDirector {
  private sim: BattleSim;
  private rng: Rng;
  /** Zero-based index of the next wave to send. */
  private next = 0;
  private timer = 6;
  /**
   * Orders still waiting for room at the gate.
   *
   * A wave cannot simply be dumped into the queue: the sim caps queue depth, so
   * anything past the cap was being silently discarded and every wave past about
   * the eighth arrived the same size. Runs plateaued at sixty-plus waves as a
   * result. Holding the remainder here and feeding it as the queue drains is what
   * makes a late wave actually feel like a late wave.
   */
  private pending: string[] = [];
  /** Waves fully released. This is the score. */
  wavesSent = 0;
  /** Seconds until the next wave lands, for the HUD. */
  get countdown(): number {
    return Math.max(0, this.timer);
  }

  get waveNumber(): number {
    return this.next;
  }

  constructor(sim: BattleSim, seed = 4242) {
    this.sim = sim;
    this.rng = new Rng(seed);
  }

  update(dt: number): void {
    if (this.sim.over) return;

    this.feed();

    this.timer -= dt;
    if (this.timer > 0) return;

    const plan = planWave(this.next);
    this.release(plan);
    this.next += 1;
    // Veterancy: quality escalation, because quantity cannot pass the field cap.
    this.sim.enemy.buff = veterancy(this.next);
    this.wavesSent = this.next;
    this.timer = waveGap(this.next);
  }

  /** Pushes as much of the backlog into the gate queue as it will take. */
  private feed(): void {
    while (this.pending.length) {
      const id = this.pending[0];
      const def = UNIT_BY_ID[id];
      if (!def) {
        this.pending.shift();
        continue;
      }
      this.sim.grantGold('enemy', def.gold);
      this.sim.enemy.cooldowns[id] = 0;
      if (this.sim.queueUnit('enemy', id) !== 'ok') {
        // Queue is full. Take the grant back so gold does not accumulate.
        this.sim.grantGold('enemy', -def.gold);
        return;
      }
      this.pending.shift();
    }
  }

  private release(plan: WavePlan): void {
    const sim = this.sim;

    // Step the enemy's age up to the wave's age. Evolving through the normal
    // path also upgrades its emplacements, which is what makes late waves bite.
    while (sim.enemy.ageIndex < plan.ageIndex) {
      sim.enemy.xp = AGES[sim.enemy.ageIndex + 1].evolveXp;
      if (sim.evolve('enemy') !== 'ok') break;
    }

    const roster = unitsForAge(AGES[sim.enemy.ageIndex].id);
    const orders: string[] = [];
    for (const [role, count] of Object.entries(plan.composition)) {
      const def = roster.find((u) => u.role === (role as UnitRole));
      if (!def || !count) continue;
      for (let i = 0; i < count; i++) orders.push(def.id);
    }

    // Interleave so a wave arrives as a mixed push rather than four blocks.
    for (let i = orders.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [orders[i], orders[j]] = [orders[j], orders[i]];
    }

    // A late wave outgrows the queue, so the remainder waits in `pending` and is
    // fed in as the gate clears. Cooldowns are zeroed because an authored wave
    // should not be throttled by the purchase limiter.
    // Cap the backlog: a wave the player cannot clear should kill them, not
    // accumulate into an unbounded queue that arrives ten waves later.
    this.pending.push(...orders);
    if (this.pending.length > 24) this.pending.length = 24;
    this.feed();

    // From the third wave the gate starts answering back.
    if (plan.index >= 2) {
      const emplacements = turretsForAge(AGES[sim.enemy.ageIndex].id);
      const slot = sim.enemy.slots.findIndex(
        (s, i) => i < sim.enemy.unlockedSlots && s === null,
      );
      if (slot >= 0) {
        const pick = this.rng.pick(emplacements);
        sim.grantGold('enemy', pick.gold);
        sim.buildTurret('enemy', slot, pick.id);
      } else if (sim.enemy.unlockedSlots < sim.enemy.slots.length && plan.index % 4 === 0) {
        sim.grantGold('enemy', 10_000);
        sim.unlockSlot('enemy', sim.enemy.unlockedSlots);
      }
    }
  }
}
