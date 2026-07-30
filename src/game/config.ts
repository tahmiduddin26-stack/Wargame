/** Tunables. Everything that a designer would want to nudge lives here. */

export const VIEW = {
  /** Design resolution. Phaser scales this to fit any landscape device. */
  width: 1280,
  height: 720,
  /** World Y of the ground line that units walk along. */
  groundY: 524,
  /** Reserved strip at the bottom for the command dock. */
  dockHeight: 150,
} as const;

export const WORLD = {
  /**
   * Distance between the two gates on a standard mission.
   *
   * Kept deliberately short. A long lane means first contact is half a minute
   * of watching men walk, and it parks the fighting outside every turret's
   * reach, which is what turns the match into an unbreakable meat grinder.
   */
  laneLength: 1250,
  /** The 'artillery-duel' modifier stretches the lane by this factor. */
  wideLaneScale: 1.15,
  /** Gate inset from each end of the world. */
  baseInset: 150,
  baseHalfWidth: 62,
  baseHeight: 190,
} as const;

export const SIM = {
  /** Fixed timestep. The sim never sees a variable dt. */
  step: 1 / 60,
  /** Max steps per frame, so a backgrounded tab does not stampede on resume. */
  maxCatchUpSteps: 5,
  /** Gap kept between two friendly units queueing in the lane. */
  spacing: 20,
  /**
   * Units emerge from the gate this far apart, in seconds. This is the real
   * reinforcement throttle: any faster than the time it takes to kill something
   * and the front line can never be cleared by either side.
   */
  gateInterval: 0.5,
  /**
   * Hard cap per side. Deliberately modest: raising it does not help an attacker
   * (both sides sit at the cap) but it does thicken the wall the attacker has to
   * chew through, and it strands gold that could not be spent.
   */
  maxUnitsPerSide: 12,
  /** Queue depth per side. */
  maxQueue: 8,
  /** Projectile travel speed for lobbed shots. */
  arcSpeed: 420,
  /** Projectile travel speed for direct fire. */
  boltSpeed: 900,
  /** How hard a heavy unit shoves what it hits, in world px. */
  knockback: 7,
} as const;

export const ECON = {
  /**
   * Passive trickle so a broke commander is never fully stuck. Kept small on
   * purpose: if income alone can buy a unit per second, both sides can feed the
   * front forever and the match never resolves. Kills are the real economy.
   */
  baseIncome: 2,
  /** Fraction of a killed unit's gold value refunded to the killer. */
  lootScale: 1,
  /** XP awarded for chipping the enemy base, per 100 damage. */
  baseDamageXp: 12,

  /**
   * Escalation. Both sides' income ramps up over the course of a match.
   *
   * Without this a lane war between two competent commanders is a stable
   * equilibrium and simply never ends: reinforcements arrive from each gate as
   * fast as the front line can chew them up, so the fighting parks itself at the
   * midpoint for as long as you let it run. Measured over twelve missions, most
   * were still grinding at the eight minute mark with both gates untouched.
   *
   * Ramping income breaks the deadlock honestly. Pushes get bigger than the
   * front can absorb, someone breaks through, and the match resolves in the
   * two-to-five minutes a mobile mission should take. It is shown in the HUD
   * rather than hidden, because the player should be able to feel the clock.
   */
  escalationStart: 55,
  escalationFull: 235,
  escalationMax: 2.5,
} as const;

/**
 * Ragdoll budget. Corpses are the most expensive thing on screen, so they are
 * pooled and the oldest is recycled once the cap is hit.
 */
export const RAGDOLL = {
  maxActive: 22,
  /** Seconds a corpse lies on the ground before it fades. */
  lifetime: 7,
  fadeTime: 1.2,
  /** Baseline launch impulse applied at the moment of death. */
  deathImpulse: 0.09,
  /** Extra spin, radians per second, randomised per corpse. */
  spin: 6,
  /** Matter gravity scale for corpses. Slightly heavy reads better. */
  gravityScale: 1.15,
  jointStiffness: 0.85,
  /** Corpses stop being simulated once they settle, to save CPU. */
  sleepThreshold: 60,
} as const;

export const CAMERA = {
  /** Camera eases toward the point of contact at this rate. */
  followLerp: 0.06,
  /** Player drag overrides auto-follow for this long. */
  manualHoldTime: 2.5,
  minZoom: 0.62,
  maxZoom: 1.15,
} as const;

export const FEEL = {
  /** Screen shake on a heavy impact. */
  shakeSmall: 0.0022,
  shakeBig: 0.006,
  /** Frames of hit-pause when a base falls. */
  killPause: 420,
} as const;

/** Collision categories for the Matter world. Live units are not simulated. */
export const MATTER_CATEGORY = {
  ground: 0x0001,
  ragdoll: 0x0002,
  debris: 0x0004,
} as const;
