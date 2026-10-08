import type { Faction, UnitDef } from '@/data/types';
import { armySkin, type ArmySkinId } from '@/data/cosmetics';

/**
 * One skeleton definition drives both the living unit and its corpse, so the
 * ragdoll appears exactly where the limbs were a frame earlier.
 *
 * All offsets and sizes are fractions of the unit's `height`, measured from the
 * feet, with negative Y pointing up. That keeps a Clubman and an Assault Mech
 * on the same rig maths.
 *
 * Artwork is painted into shared atlases by UnitArt. These dimensions describe
 * the body underneath it, so equipment needs no extra physics bodies.
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

/** Local limb transforms, captured before converting a soldier to physics. */
export type UnitPose = Record<string, { x: number; y: number; rotation: number }>;

/** Two-arm, two-leg infantry rig. Six bodies, five joints. */
export const HUMANOID: SkeletonSpec = {
  bones: [
    { name: 'legBack', shape: 'box', x: -0.085, y: -0.15, w: 0.14, h: 0.3, z: 0, tint: 'dark' },
    { name: 'armBack', shape: 'box', x: -0.14, y: -0.53, w: 0.13, h: 0.29, z: 1, tint: 'skin' },
    { name: 'legFront', shape: 'box', x: 0.085, y: -0.15, w: 0.14, h: 0.3, z: 2, tint: 'dark' },
    { name: 'torso', shape: 'box', x: 0, y: -0.48, w: 0.35, h: 0.37, z: 3, tint: 'cloth', density: 0.0014 },
    { name: 'armFront', shape: 'box', x: 0.17, y: -0.53, w: 0.13, h: 0.29, z: 4, tint: 'skin' },
    { name: 'head', shape: 'disc', x: 0.035, y: -0.85, w: 0.42, h: 0.4, z: 5, tint: 'skin', density: 0.0018 },
  ],
  joints: [
    { a: 'torso', b: 'head', ax: 0.035, ay: -0.18, bx: 0, by: 0.18, stiffness: 0.9 },
    { a: 'torso', b: 'armFront', ax: 0.16, ay: -0.12, bx: 0, by: -0.12, stiffness: 0.55 },
    { a: 'torso', b: 'armBack', ax: -0.14, ay: -0.12, bx: 0, by: -0.12, stiffness: 0.55 },
    { a: 'torso', b: 'legFront', ax: 0.085, ay: 0.18, bx: 0, by: -0.14, stiffness: 0.7 },
    { a: 'torso', b: 'legBack', ax: -0.085, ay: 0.18, bx: 0, by: -0.14, stiffness: 0.7 },
  ],
};

/**
 * Vehicles and mounts. They shed a chassis rather than limbs: hull, cabin and
 * two wheels that roll away, which reads very differently from a tumbling body
 * and is worth the extra spec.
 */
export const CHASSIS: SkeletonSpec = {
  bones: [
    { name: 'hull', shape: 'box', x: 0, y: -0.32, w: 0.92, h: 0.27, z: 0, tint: 'cloth', density: 0.002 },
    { name: 'wheelBack', shape: 'disc', x: -0.29, y: -0.15, w: 0.3, h: 0.3, z: 1, tint: 'dark' },
    { name: 'wheelFront', shape: 'disc', x: 0.29, y: -0.15, w: 0.3, h: 0.3, z: 2, tint: 'dark' },
    { name: 'cabin', shape: 'box', x: -0.1, y: -0.58, w: 0.34, h: 0.26, z: 3, tint: 'trim' },
    { name: 'barrel', shape: 'box', x: 0.22, y: -0.6, w: 0.48, h: 0.12, z: 4, tint: 'dark' },
  ],
  joints: [
    { a: 'hull', b: 'wheelBack', ax: -0.29, ay: 0.17, bx: 0, by: 0, stiffness: 0.6 },
    { a: 'hull', b: 'wheelFront', ax: 0.29, ay: 0.17, bx: 0, by: 0, stiffness: 0.6 },
    { a: 'hull', b: 'cabin', ax: -0.1, ay: -0.26, bx: 0, by: 0.13, stiffness: 0.8 },
    { a: 'hull', b: 'barrel', ax: 0.22, ay: -0.28, bx: 0, by: 0, stiffness: 0.7 },
  ],
};

const MOUNT: SkeletonSpec = {
  bones: [
    { name: 'legBack', shape: 'box', x: -0.27, y: -0.17, w: 0.15, h: 0.34, z: 0, tint: 'dark' },
    { name: 'legFront', shape: 'box', x: 0.27, y: -0.17, w: 0.15, h: 0.34, z: 1, tint: 'dark' },
    { name: 'hull', shape: 'box', x: 0, y: -0.46, w: 0.88, h: 0.34, z: 2, tint: 'cloth' },
    { name: 'torso', shape: 'box', x: -0.07, y: -0.76, w: 0.3, h: 0.28, z: 3, tint: 'cloth' },
    { name: 'armFront', shape: 'box', x: 0.1, y: -0.78, w: 0.12, h: 0.23, z: 4, tint: 'skin' },
    { name: 'head', shape: 'disc', x: -0.07, y: -1.04, w: 0.34, h: 0.34, z: 5, tint: 'skin' },
  ],
  joints: [
    { a: 'hull', b: 'legBack', ax: -0.27, ay: 0.17, bx: 0, by: -0.12 },
    { a: 'hull', b: 'legFront', ax: 0.27, ay: 0.17, bx: 0, by: -0.12 },
    { a: 'hull', b: 'torso', ax: -0.07, ay: -0.16, bx: 0, by: 0.14 },
    { a: 'torso', b: 'head', ax: 0, ay: -0.14, bx: 0, by: 0.14 },
    { a: 'torso', b: 'armFront', ax: 0.17, ay: -0.09, bx: 0, by: -0.07 },
  ],
};

const MECH: SkeletonSpec = {
  bones: HUMANOID.bones.map((b) => ({ ...b,
    w: b.name === 'torso' ? 0.52 : b.name.startsWith('arm') ? 0.2 : b.name.startsWith('leg') ? 0.2 : 0.36,
    x: b.name === 'armFront' ? 0.31 : b.name === 'armBack' ? -0.31 : b.x,
    shape: 'box',
  })),
  joints: HUMANOID.joints.map((j) => ({ ...j,
    ax: j.b === 'armFront' ? 0.31 : j.b === 'armBack' ? -0.31 : j.ax,
  })),
};

export function skeletonFor(def: UnitDef): SkeletonSpec {
  if (def.id === 'dino-rider' || def.id === 'cuirassier') return MOUNT;
  if (def.id === 'assault-mech') return MECH;
  if (def.id === 'boulder-hurler') return CHASSIS;
  return def.chassis ? CHASSIS : HUMANOID;
}

/**
 * Paper-cut colours. Warm orange is always the player's army; blue is the
 * opposing army. Age accents pick out trim without replacing faction colour.
 */
export function palette(faction: Faction, accent: number, skinId: ArmySkinId = 'field'): Record<TintRole, number> {
  if (faction === 'player') {
    const paint = armySkin(skinId);
    return { skin: 0xf4c795, cloth: paint.cloth, trim: skinId === 'field' ? accent : paint.trim, metal: paint.metal, dark: paint.dark };
  }
  // Cool trim against the player's warm accent. Amber against steel blue stays
  // separable under every common colour-vision deficiency; the old oxide red
  // did not, and telling your line from theirs is the whole read of the game.
  return { skin: 0xd6a987, cloth: 0x5c9dbd, trim: 0x3f8cad, metal: 0x8ab6bd, dark: 0x3c5155 };
}
