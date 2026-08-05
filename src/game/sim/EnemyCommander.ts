import { AGES } from '@/data/ages';
import { SLOT_UNLOCK_COST } from '@/data/turrets';
import { turretsForAge } from '@/data/turrets';
import { unitsForAge } from '@/data/units';
import type { ArmourClass, TurretRole, UnitRole } from '@/data/types';
import { ARMOUR_TABLE } from '@/data/types';
import { BattleSim } from './BattleSim';
import { Rng } from './rng';

/**
 * Heuristic opponent. It drives the sim through exactly the same public methods
 * the player's HUD calls, so there is no hidden cheating: if it out-spends you
 * it is because the level gave it more income.
 *
 * Doctrine, in priority order:
 *   1. survive  a push at the gate outranks everything else
 *   2. evolve   but never while something is chewing on the gate
 *   3. defend   keep emplacements filled, matched to what the player fields
 *   4. spend    maintain a composition rather than spamming one unit
 */
export class EnemyCommander {
  private sim: BattleSim;
  private rng: Rng;
  private thinkTimer = 0;
  /** Rolling composition counter, reset every six purchases. */
  private bought: Record<UnitRole, number> = { melee: 0, ranged: 0, heavy: 0, artillery: 0 };
  private boughtTotal = 0;

  constructor(sim: BattleSim, seed = 20260730) {
    this.sim = sim;
    this.rng = new Rng(seed);
  }

  update(dt: number): void {
    const sim = this.sim;
    if (sim.over) return;
    if (sim.elapsed < sim.enemyPlan.warmup) return;

    this.thinkTimer -= dt;
    if (this.thinkTimer > 0) return;

    const aggression = sim.enemyPlan.aggression;
    // Aggressive commanders act roughly twice as often.
    this.thinkTimer = this.rng.range(0.55, 1.5) * (1.7 - aggression);

    const threat = this.assessThreat();

    if (this.considerSpecial(threat)) return;
    if (this.considerEvolve(threat)) return;
    if (this.considerDefence(threat)) return;
    this.considerUnits(threat, aggression);
  }

  /**
   * How much player pressure is inside the enemy half, and what it is made of.
   * The armour breakdown is what lets the commander answer a push with the right
   * counter instead of buying whatever is most expensive.
   */
  private assessThreat(): {
    units: number;
    hp: number;
    nearest: number;
    hasArty: boolean;
    /** Armour class holding the most enemy hitpoints in range. */
    dominantArmour: ArmourClass;
  } {
    const sim = this.sim;
    const gate = sim.enemy.baseX;
    let units = 0;
    let hp = 0;
    let nearest = Infinity;
    let hasArty = false;
    const byArmour: Record<ArmourClass, number> = { flesh: 0, plate: 0, hull: 0 };

    for (const u of sim.units) {
      if (u.faction !== 'player') continue;
      const d = gate - u.x;
      if (d < 620) {
        units++;
        hp += u.hp;
        byArmour[u.def.armour] += u.hp;
        if (d < nearest) nearest = d;
        if (u.def.role === 'artillery') hasArty = true;
      }
    }

    let dominantArmour: ArmourClass = 'flesh';
    for (const cls of ['plate', 'hull'] as ArmourClass[]) {
      if (byArmour[cls] > byArmour[dominantArmour]) dominantArmour = cls;
    }
    return { units, hp, nearest, hasArty, dominantArmour };
  }

  private considerSpecial(threat: { units: number; nearest: number }): boolean {
    const c = this.sim.enemy;
    if (!this.sim.specialsAllowed) return false;
    if (c.specialCd > 0) return false;
    // Worth spending on three or more bodies, or anything at the gate.
    const worthIt = threat.units >= 3 || (threat.units >= 1 && threat.nearest < 240);
    if (!worthIt) return false;
    this.sim.fireSpecial('enemy');
    return true;
  }

  private considerEvolve(threat: { nearest: number; hp: number }): boolean {
    const sim = this.sim;
    if (!sim.canEvolve('enemy')) return false;
    // Evolving wipes the emplacements, so not while under the gun.
    const underPressure = threat.nearest < 320 && threat.hp > sim.enemy.baseMaxHp * 0.04;
    if (underPressure) return false;
    sim.evolve('enemy');
    return true;
  }

  private considerDefence(threat: {
    units: number;
    hasArty: boolean;
    dominantArmour: ArmourClass;
  }): boolean {
    const sim = this.sim;
    const c = sim.enemy;
    if (sim.slotBudget === 0) return false;

    const empty = c.slots.findIndex((s, i) => i < c.unlockedSlots && s === null);
    const age = AGES[c.ageIndex].id;
    const options = turretsForAge(age);

    if (empty >= 0) {
      // Match the emplacement to what is actually coming down the lane: armoured
      // pushes want the armour-piercing mount, crowds want splash.
      let want: TurretRole = 'rapid';
      if (threat.dominantArmour !== 'flesh') want = 'marksman';
      else if (threat.hasArty) want = 'marksman';
      else if (threat.units >= 4) want = 'mortar';
      const pick = options.find((t) => t.role === want) ?? options[0];
      if (c.gold >= pick.gold) {
        sim.buildTurret('enemy', empty, pick.id);
        return true;
      }
      // Fall back to something it can afford right now.
      const cheap = [...options].sort((a, b) => a.gold - b.gold)[0];
      if (c.gold >= cheap.gold) {
        sim.buildTurret('enemy', empty, cheap.id);
        return true;
      }
      return false;
    }

    // All open slots filled. Buy another slot when gold is comfortable.
    if (c.unlockedSlots < sim.slotBudget) {
      const cost = SLOT_UNLOCK_COST[c.unlockedSlots];
      if (c.gold > cost * 2.5) {
        sim.unlockSlot('enemy', c.unlockedSlots);
        return true;
      }
    }
    return false;
  }

  private considerUnits(
    threat: { units: number; dominantArmour: ArmourClass },
    aggression: number,
  ): void {
    const sim = this.sim;
    const c = sim.enemy;
    const age = AGES[c.ageIndex].id;
    const roster = unitsForAge(age).filter((u) => (c.cooldowns[u.id] ?? 0) <= 0);
    if (!roster.length) return;

    if (this.boughtTotal >= 6) {
      this.bought = { melee: 0, ranged: 0, heavy: 0, artillery: 0 };
      this.boughtTotal = 0;
    }

    // Target mix per six purchases. Aggressive commanders skew to heavies.
    const target: Record<UnitRole, number> = {
      melee: 3,
      ranged: 2,
      heavy: aggression > 0.7 ? 2 : 1,
      artillery: aggression > 0.55 ? 1 : 0,
    };

    // Under pressure, throw bodies in the way regardless of the plan.
    if (threat.units >= 3) {
      const melee = roster.find((u) => u.role === 'melee');
      if (melee && c.gold >= melee.gold) {
        sim.queueUnit('enemy', melee.id);
        this.bought.melee++;
        this.boughtTotal++;
        return;
      }
    }

    /*
     * Score = cost weighted by how well the damage kind lands on what the player
     * is actually fielding.
     *
     * Cost has to stay the dominant term. Only the front couple of ranks can
     * reach each other, so quality per slot beats quantity, and sorting by the
     * counter multiplier alone made the commander pour gold into fragile
     * artillery whenever the player fielded infantry: it picked the best matchup
     * rather than the best unit, and measurably lost more matches for it.
     */
    const score = (u: (typeof roster)[number]) =>
      u.gold * ARMOUR_TABLE[u.damageKind][threat.dominantArmour];
    const wanted = roster
      .filter((u) => this.bought[u.role] < target[u.role])
      .sort((a, b) => score(b) - score(a));

    for (const def of wanted) {
      if (c.gold < def.gold) continue;
      // Hold gold for an evolve rather than dumping it into the current age.
      const next = AGES[c.ageIndex + 1];
      const savingToEvolve =
        !!next && c.xp >= next.evolveXp * 0.85 && def.role === 'heavy' && aggression < 0.6;
      if (savingToEvolve) continue;

      sim.queueUnit('enemy', def.id);
      this.bought[def.role]++;
      this.boughtTotal++;
      return;
    }

    // Composition satisfied but gold is piling up: buy the best thing available.
    const affordable = roster.filter((u) => c.gold >= u.gold).sort((a, b) => b.gold - a.gold);
    if (affordable.length && c.gold > affordable[0].gold * 1.6) {
      sim.queueUnit('enemy', affordable[0].id);
      this.bought[affordable[0].role]++;
      this.boughtTotal++;
    }
  }
}

export type { BattleSim };
