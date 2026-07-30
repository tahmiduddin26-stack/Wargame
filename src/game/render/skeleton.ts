import type { Faction, UnitDef } from '@/data/types';

/**
 * One skeleton definition drives both the living unit and its corpse, so the
 * ragdoll appears exactly where the limbs were a frame earlier.
 *
 * All offsets and sizes are fractions of the unit's `height`, measured from the
 * feet, with negative Y pointing up. That keeps a Clubman and an Assault Mech
 * on the same rig maths.
 *
 * `texture` is the swap point for real art: today every bone renders a tinted
 * 1px quad, but dropping in a sprite named `knight.torso` and setting it here
 * changes nothing else in the pipeline.
 */

export type TintRole = 'skin' | 'cloth' | 'trim' | 'metal' | 'dark';

export interface BoneSpec {
  name: string;
  shape: 'box' | 'disc';
  /** Centre offset from the feet, in units of body height. */
  x: number;
  y: number;
  /** Size in units of body height. For a disc, `w` is the diameter. */
  w: number;
  h: number;
  /** Draw order. Higher sits in front. */
  z: number;
  tint: TintRole;
  texture?: string;
  /** Relative density. Heads and hulls being heavy makes corpses tumble right. */
  density?: number;
}

export interface JointSpec {
  a: string;
  b: string;
  /** Anchor on body A, in units of body height, relative to A's centre. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  stiffness?: number;
}

export interface SkeletonSpec {
  bones: BoneSpec[];
  joints: JointSpec[];
}

/** Two-arm, two-leg infantry rig. Six bodies, five joints. */
export const HUMANOID: SkeletonSpec = {
  bones: [
    { name: 'legBack', shape: 'box', x: 0.05, y: -0.17, w: 0.11, h: 0.34, z: 0, tint: 'dark' },
    { name: 'armBack', shape: 'box', x: 0.08, y: -0.62, w: 0.09, h: 0.27, z: 1, tint: 'dark' },
    { name: 'legFront', shape: 'box', x: -0.05, y: -0.17, w: 0.11, h: 0.34, z: 2, tint: 'cloth' },
    { name: 'torso', shape: 'box', x: 0, y: -0.55, w: 0.25, h: 0.36, z: 3, tint: 'cloth', density: 0.0014 },
    { name: 'armFront', shape: 'box', x: -0.08, y: -0.62, w: 0.09, h: 0.27, z: 4, tint: 'trim' },
    { name: 'head', shape: 'disc', x: 0, y: -0.85, w: 0.24, h: 0.24, z: 5, tint: 'skin', density: 0.0018 },
  ],
  joints: [
    { a: 'torso', b: 'head', ax: 0, ay: -0.18, bx: 0, by: 0.1, stiffness: 0.9 },
    { a: 'torso', b: 'armFront', ax: -0.08, ay: -0.14, bx: 0, by: -0.11, stiffness: 0.55 },
    { a: 'torso', b: 'armBack', ax: 0.08, ay: -0.14, bx: 0, by: -0.11, stiffness: 0.55 },
    { a: 'torso', b: 'legFront', ax: -0.05, ay: 0.18, bx: 0, by: -0.16, stiffness: 0.7 },
    { a: 'torso', b: 'legBack', ax: 0.05, ay: 0.18, bx: 0, by: -0.16, stiffness: 0.7 },
  ],
};

/**
 * Vehicles and mounts. They shed a chassis rather than limbs: hull, cabin and
 * two wheels that roll away, which reads very differently from a tumbling body
 * and is worth the extra spec.
 */
export const CHASSIS: SkeletonSpec = {
  bones: [
    { name: 'wheelBack', shape: 'disc', x: 0.19, y: -0.15, w: 0.3, h: 0.3, z: 0, tint: 'dark' },
    { name: 'wheelFront', shape: 'disc', x: -0.19, y: -0.15, w: 0.3, h: 0.3, z: 1, tint: 'dark' },
    { name: 'hull', shape: 'box', x: 0, y: -0.38, w: 0.72, h: 0.3, z: 2, tint: 'metal', density: 0.002 },
    { name: 'cabin', shape: 'box', x: -0.1, y: -0.66, w: 0.34, h: 0.26, z: 3, tint: 'trim' },
    { name: 'barrel', shape: 'box', x: 0.24, y: -0.62, w: 0.42, h: 0.08, z: 4, tint: 'dark' },
  ],
  joints: [
    { a: 'hull', b: 'wheelBack', ax: 0.19, ay: 0.22, bx: 0, by: 0, stiffness: 0.6 },
    { a: 'hull', b: 'wheelFront', ax: -0.19, ay: 0.22, bx: 0, by: 0, stiffness: 0.6 },
    { a: 'hull', b: 'cabin', ax: -0.1, ay: -0.28, bx: 0, by: 0.13, stiffness: 0.8 },
    { a: 'hull', b: 'barrel', ax: 0.2, ay: -0.24, bx: -0.1, by: 0, stiffness: 0.7 },
  ],
};

export function skeletonFor(def: UnitDef): SkeletonSpec {
  return def.chassis ? CHASSIS : HUMANOID;
}

/**
 * Placeholder palettes. Player reads as bone and ochre, enemy as ash and
 * oxide red, with the current age's accent as trim so evolving is visible on
 * the battlefield and not just in the HUD.
 */
export function palette(faction: Faction, accent: number): Record<TintRole, number> {
  if (faction === 'player') {
    return { skin: 0xd8bb96, cloth: 0x8d7f6a, trim: accent, metal: 0x9aa0a6, dark: 0x4a4238 };
  }
  return { skin: 0xa9866a, cloth: 0x5c4a4a, trim: 0xb04a3a, metal: 0x7d7370, dark: 0x332a2a };
}
