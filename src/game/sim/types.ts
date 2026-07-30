import type { DamageKind, Faction, TurretDef, UnitDef } from '@/data/types';

export interface SimUnit {
  uid: number;
  def: UnitDef;
  faction: Faction;
  /** Lane position, world px. */
  x: number;
  hp: number;
  maxHp: number;
  /** Seconds until the next attack is ready. */
  reload: number;
  /** True while stopped and engaging something. */
  engaging: boolean;
  /** Accumulated walk cycle phase, consumed by the renderer only. */
  phase: number;
  /** Set on the frame the unit dies, then swept. */
  dead: boolean;
  /** Recoil offset applied by knockback, decays each step. */
  shove: number;
}

export interface TurretSlot {
  def: TurretDef;
  reload: number;
}

export interface Commander {
  faction: Faction;
  gold: number;
  /** Lifetime XP. Age gates read against this, so it is never spent. */
  xp: number;
  ageIndex: number;
  baseHp: number;
  baseMaxHp: number;
  baseX: number;
  /** Unit ids waiting at the gate. */
  queue: string[];
  gateTimer: number;
  /** defId -> seconds remaining. */
  cooldowns: Record<string, number>;
  slots: (TurretSlot | null)[];
  unlockedSlots: number;
  specialCd: number;
  /** Gold per second for this side. */
  income: number;
  /**
   * Flat multiplier on this side's unit hitpoints and damage.
   *
   * Survival's only escalation axis once the age ladder tops out. The field is
   * capped at a dozen units a side, so a wave cannot get meaningfully bigger, and
   * without this the mode plateaus: a steady stream of twelve Future Age units is
   * something a dug-in commander holds literally forever. Shown in the HUD as
   * veterancy rather than hidden.
   */
  buff: number;
}

export type ProjectileTarget = { kind: 'unit'; uid: number } | { kind: 'base'; faction: Faction };

export interface SimProjectile {
  pid: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  /** 0..1 progress along the flight path. */
  t: number;
  dur: number;
  /** Peak height of the lob, in world px. Zero for direct fire. */
  arcH: number;
  damage: number;
  blast: number;
  kind: DamageKind;
  /** Faction that takes the damage. */
  hostileTo: Faction;
  target: ProjectileTarget;
  impulse: number;
}

export type SimEvent =
  | { t: 'spawn'; uid: number; faction: Faction; defId: string }
  | {
      t: 'death';
      uid: number;
      defId: string;
      faction: Faction;
      x: number;
      /** -1 or 1: which way the corpse should be thrown. */
      dirX: number;
      /** 0..3ish. Multiplies the ragdoll launch impulse. */
      force: number;
      kind: DamageKind;
    }
  | { t: 'shot'; pid: number; sx: number; sy: number; kind: DamageKind; arc: boolean }
  | { t: 'travelEnd'; pid: number }
  | { t: 'impact'; x: number; y: number; blast: number; kind: DamageKind; heavy: boolean }
  | { t: 'melee'; x: number; y: number; kind: DamageKind; heavy: boolean }
  | { t: 'baseHit'; faction: Faction; amount: number; x: number }
  | { t: 'evolve'; faction: Faction; ageIndex: number }
  | { t: 'special'; faction: Faction; points: number[] }
  | { t: 'over'; winner: Faction };

export type PurchaseResult = 'ok' | 'poor' | 'locked' | 'cooldown' | 'full';
