/**
 * The armoury. Credits earned from clears and Survival runs go here.
 *
 * Rules this list holds itself to, because a meta-progression system is the
 * easiest place in a game to do real damage:
 *
 *   - **Bought once, kept forever.** No levels, no currencies to convert, no
 *     timers, no daily anything. You either own it or you do not.
 *   - **Every perk is one number in the sim.** Nothing here adds a mechanic you
 *     then have to learn separately, and nothing is conditional enough to need a
 *     paragraph of explanation.
 *   - **Small.** The whole board is worth roughly one difficulty tier in total.
 *     A mission has to stay beatable without any of it, because the campaign is
 *     tuned at Normal with an empty armoury.
 *   - **No stat that only matters against the AI's mistakes.** Each one changes
 *     a decision you make: bank or spend, hold or push, evolve now or later.
 */
export type PerkId =
  | 'quartermaster'
  | 'scavengers'
  | 'drill-yard'
  | 'engineers'
  | 'field-hospital'
  | 'forward-scouts'
  | 'shell-crates'
  | 'war-college';

export interface PerkDef {
  id: PerkId;
  name: string;
  /** What it does, in the numbers the player already reads elsewhere. */
  effect: string;
  /** Why you would want it. One line, no hedging. */
  brief: string;
  cost: number;
}

export const PERKS: PerkDef[] = [
  {
    id: 'quartermaster',
    name: 'Quartermaster',
    effect: '+2 gold per second',
    brief: 'A thicker trickle. Matters most in the opening minute.',
    cost: 120,
  },
  {
    id: 'scavengers',
    name: 'Scavengers',
    effect: '+15% loot from kills',
    brief: 'Winning fights funds the next push harder.',
    cost: 180,
  },
  {
    id: 'drill-yard',
    name: 'Drill Yard',
    effect: '-20% unit cooldowns',
    brief: 'Deploy a saved-up push faster than the gate normally allows.',
    cost: 200,
  },
  {
    id: 'engineers',
    name: 'Engineers',
    effect: '-15% emplacement cost',
    brief: 'Cheaper mounts, so the fourth slot is reachable sooner.',
    cost: 220,
  },
  {
    id: 'field-hospital',
    name: 'Field Hospital',
    effect: '+12% gate structure',
    brief: 'Survive one more push than the mission expects you to.',
    cost: 260,
  },
  {
    id: 'forward-scouts',
    name: 'Forward Scouts',
    effect: '+10% experience from kills',
    brief: 'Reach the next age before the opposing commander does.',
    cost: 300,
  },
  {
    id: 'shell-crates',
    name: 'Shell Crates',
    effect: '-15% special cooldown',
    brief: 'One extra barrage in a long mission.',
    cost: 320,
  },
  {
    id: 'war-college',
    name: 'War College',
    effect: 'Start every mission one age unlocked',
    brief: 'Skip the stone age opening. Costs you its cheap chaff.',
    cost: 600,
  },
];

export const PERK_BY_ID: Record<PerkId, PerkDef> = PERKS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<PerkId, PerkDef>,
);

/**
 * Resolved perk effects, handed to the sim as plain multipliers so the sim never
 * needs to know what a perk is.
 */
export interface PerkEffects {
  incomeBonus: number;
  lootScale: number;
  cooldownScale: number;
  turretCostScale: number;
  baseHpScale: number;
  xpScale: number;
  specialCdScale: number;
  startAge: number;
}

export function resolvePerks(owned: readonly PerkId[]): PerkEffects {
  const has = (id: PerkId) => owned.includes(id);
  return {
    incomeBonus: has('quartermaster') ? 2 : 0,
    lootScale: has('scavengers') ? 1.15 : 1,
    cooldownScale: has('drill-yard') ? 0.8 : 1,
    turretCostScale: has('engineers') ? 0.85 : 1,
    baseHpScale: has('field-hospital') ? 1.12 : 1,
    xpScale: has('forward-scouts') ? 1.1 : 1,
    specialCdScale: has('shell-crates') ? 0.85 : 1,
    startAge: has('war-college') ? 1 : 0,
  };
}

export const NO_PERKS: PerkEffects = resolvePerks([]);
