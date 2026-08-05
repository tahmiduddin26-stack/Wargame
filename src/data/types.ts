/** Shared vocabulary for the whole game. Keep this file dependency-free. */

export type Faction = 'player' | 'enemy';

export type AgeId = 'stone' | 'medieval' | 'gunpowder' | 'modern' | 'future';

/**
 * Four archetypes, one per role, in every age. Holding the roster shape
 * constant across ages is what makes the evolve moment readable: the player
 * already knows what slot 3 does, they just watched it get better.
 */
export type UnitRole = 'melee' | 'ranged' | 'heavy' | 'artillery';

export type TurretRole = 'rapid' | 'marksman' | 'mortar';

export type DamageKind = 'impact' | 'pierce' | 'blast' | 'energy';

export interface AgeDef {
  id: AgeId;
  index: number;
  /** Shown on the evolve button and the age ribbon. */
  name: string;
  /** Two-word flavour line. No em dashes anywhere in UI copy. */
  tagline: string;
  /** Cumulative XP the commander must bank to unlock this age. */
  evolveXp: number;
  /** Multiplies the level's base HP once this age is reached. */
  baseArmour: number;
  /** Era accent, used for the age ribbon, unit trim and turret glow. */
  accent: string;
  /** Sky/ground pair for the battlefield backdrop. */
  skyline: [string, string];
  ground: string;
}

export interface UnitDef {
  id: string;
  age: AgeId;
  role: UnitRole;
  name: string;
  /** One short declarative line. Tells the player what it is for. */
  brief: string;
  gold: number;
  hp: number;
  damage: number;
  damageKind: DamageKind;
  /** What this unit is wearing. Decides which damage kinds hurt it. */
  armour: ArmourClass;
  /** Splash radius in world px. 0 means single target. */
  blast: number;
  /** Attack reach in world px, measured hitbox edge to hitbox edge. */
  range: number;
  /** Attacks per second. */
  rate: number;
  /** World px per second. */
  speed: number;
  /** XP granted to whoever kills this unit. */
  bounty: number;
  /** Gold refunded to the killer. Modern addition: keeps pushes self-funding. */
  loot: number;
  /** Drives ragdoll limb scale, knockback resistance and footstep weight. */
  mass: number;
  /** Seconds before this unit type can be queued again. */
  cooldown: number;
  /** Body height in world px. Also the ragdoll skeleton scale. */
  height: number;
  /** True for wheeled/tracked/mounted things: they shed a chassis, not limbs. */
  chassis?: boolean;
}

export interface TurretDef {
  id: string;
  age: AgeId;
  role: TurretRole;
  name: string;
  brief: string;
  gold: number;
  damage: number;
  damageKind: DamageKind;
  blast: number;
  range: number;
  rate: number;
}

export interface SpecialDef {
  age: AgeId;
  name: string;
  brief: string;
  /** Seconds to recharge from empty. */
  cooldown: number;
  damage: number;
  /** Number of impacts spread across the lane. */
  strikes: number;
  blast: number;
  /** Extra ragdoll launch force. This is the reason specials feel good. */
  impulse: number;
}

/*
 * Mission modifiers.
 *
 * Two kinds live in this list and it is worth knowing which is which.
 *
 * Some change the sim: 'no-turrets', 'artillery-duel', 'close-quarters',
 * 'no-specials', 'veteran-enemy', 'lean-purse' and 'single-mount' are all read
 * by BattleSim and alter how the match is played.
 *
 * The rest are labels for numbers already stated elsewhere in the LevelDef:
 * 'age-locked' describes a low `maxAge`, 'sudden-death' a low `baseHp`,
 * 'rich-enemy' a high `enemy.economy`, 'fast-enemy' a short `enemy.warmup`.
 * They exist so the mission select and pause sheet can say out loud what the
 * numbers are doing. Setting one without setting the matching number does
 * nothing, which is why each is noted here rather than left to be discovered.
 */
export type LevelModifier =
  | 'no-turrets'
  | 'age-locked'
  | 'sudden-death'
  | 'rich-enemy'
  | 'fast-enemy'
  | 'artillery-duel'
  | 'close-quarters'
  | 'no-specials'
  | 'veteran-enemy'
  | 'lean-purse'
  | 'single-mount';

export interface LevelDef {
  id: number;
  /** Mission callsign. Shows up as OP. <NAME> on the select screen. */
  name: string;
  /** Briefing copy, two sentences max. */
  briefing: string;
  /** Both bases start here. */
  baseHp: number;
  /** Gold in the war chest at deploy. */
  startGold: number;
  /** Gold per second, before the level multiplier. */
  income: number;
  /** Highest age either side may reach. Caps the tutorial levels. */
  maxAge: number;
  /**
   * Seconds on the mission clock.
   *
   * A lane war between two competent commanders is a stable equilibrium, so a
   * match with no clock can genuinely run forever with both gates untouched.
   * At zero the mission is decided on gate integrity: whoever has more structure
   * left holds the valley, and an exact tie goes to the defender. That makes chip
   * damage worth something all match and guarantees a result.
   */
  timeLimit: number;
  enemy: {
    /** 0..1. Scales enemy spend rate, reaction time and push size. */
    aggression: number;
    /** Multiplies enemy income. Above 1 means the player is outspent. */
    economy: number;
    /**
     * Seconds before the enemy commander wakes up.
     *
     * This is really a control on WHERE the first fight happens. Set it too high
     * and the player's opening wave walks unopposed into the enemy gate, which is
     * the worst ground on the map: emplacements cover it and the defender's
     * reinforcements arrive there with no walk at all. Short warmups keep first
     * contact near the midpoint. Mission 1 is the deliberate exception.
     */
    warmup: number;
  };
  modifiers: LevelModifier[];
  /** Awarded on first clear. Spent in the armoury between missions. */
  reward: number;
}

/**
 * Armour class. Decides how each damage kind lands.
 *
 *   flesh  unarmoured bodies: infantry, and the odd artillery crew
 *   plate  armour and mounts: knights, cavalry, powered suits
 *   hull   vehicles, tracks and walkers
 */
export type ArmourClass = 'flesh' | 'plate' | 'hull';

/**
 * The counter table. Four damage kinds against three armour classes.
 *
 * The original's sequel documents real counters ("Dino Riders are weak to
 * Slingers", anti-armour troops answering heavies), and this reproduces that
 * relationship rather than inventing one. Before it existed, `damageKind` was
 * decorative: four flavours of damage that all resolved identically, which made
 * the four roles cost tiers rather than answers to each other.
 *
 * Assignment is by role and holds across all five ages, so it is learned once:
 *   melee impact / ranged pierce / artillery blast, and armour follows the body.
 */
export const ARMOUR_TABLE: Record<DamageKind, Record<ArmourClass, number>> = {
  // Clubs, hooves and small arms. Brutal on bodies, useless on a tank.
  impact: { flesh: 1.1, plate: 0.6, hull: 0.5 },
  // Arrows, bullets, bayonets, shaped charges. Punches armour, wasted on chaff.
  pierce: { flesh: 0.85, plate: 1.35, hull: 1.15 },
  // High explosive. Clears a packed rank; a shell does little to a hull.
  blast: { flesh: 1.15, plate: 0.9, hull: 0.7 },
  // Rail, ion, plasma. The late-age answer to everything solid.
  energy: { flesh: 1.0, plate: 1.2, hull: 1.45 },
};

/*
 * The vs-flesh column averages ~1.0 on purpose. Most units in the game are
 * unarmoured, so a table whose flesh column averaged 1.11 quietly inflated all
 * damage rather than redistributing it: time to kill dropped everywhere and the
 * campaign got measurably easier across every strategy. The spread is what
 * matters, not the level.
 */

export function armourMultiplier(kind: DamageKind, armour: ArmourClass): number {
  return ARMOUR_TABLE[kind][armour];
}

export const ARMOUR_LABEL: Record<ArmourClass, string> = {
  flesh: 'UNARMOURED',
  plate: 'PLATED',
  hull: 'HULL',
};
