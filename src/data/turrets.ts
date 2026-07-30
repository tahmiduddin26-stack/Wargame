import type { AgeId, TurretDef, TurretRole } from './types';

/**
 * Four emplacement slots sit on the base, exactly as in the original. Three
 * archetypes per age so the choice is a real one rather than a tier ladder:
 *   rapid     cheap, high fire rate, melts swarms, no reach
 *   marksman  outranges enemy infantry, single target
 *   mortar    splash, slow, the answer to a packed push
 *
 * Emplacements carry through an evolve, upgrading to the same role in the new
 * age for free. That is what makes "fill your mounts before you age up" the
 * right play, and it matches the original.
 */
export const TURRETS: TurretDef[] = [
  {
    id: 'rock-chucker',
    age: 'stone',
    role: 'rapid',
    name: 'Rock Chucker',
    brief: 'A lad on the roof with a pile of stones.',
    gold: 80,
    damage: 15,
    damageKind: 'impact',
    blast: 0,
    range: 150,
    rate: 1.4,
  },
  {
    id: 'spear-post',
    age: 'stone',
    role: 'marksman',
    name: 'Spear Post',
    brief: 'Long reach, one target at a time.',
    gold: 140,
    damage: 34,
    damageKind: 'pierce',
    blast: 0,
    range: 240,
    rate: 0.6,
  },
  {
    id: 'log-drop',
    age: 'stone',
    role: 'mortar',
    name: 'Log Drop',
    brief: 'Rolls timber into whatever is bunched up.',
    gold: 190,
    damage: 51,
    damageKind: 'blast',
    blast: 60,
    range: 190,
    rate: 0.4,
  },

  {
    id: 'arrow-slit',
    age: 'medieval',
    role: 'rapid',
    name: 'Arrow Slit',
    brief: 'Steady fire into anything that closes.',
    gold: 280,
    damage: 34,
    damageKind: 'impact',
    blast: 0,
    range: 170,
    rate: 1.6,
  },
  {
    id: 'ballista',
    age: 'medieval',
    role: 'marksman',
    name: 'Ballista',
    brief: 'Punches a knight off his feet.',
    gold: 480,
    damage: 100,
    damageKind: 'pierce',
    blast: 0,
    range: 270,
    rate: 0.55,
  },
  {
    id: 'pitch-catapult',
    age: 'medieval',
    role: 'mortar',
    name: 'Pitch Catapult',
    brief: 'Burning tar across the whole rank.',
    gold: 600,
    damage: 152,
    damageKind: 'blast',
    blast: 75,
    range: 215,
    rate: 0.36,
  },

  {
    id: 'swivel-gun',
    age: 'gunpowder',
    role: 'rapid',
    name: 'Swivel Gun',
    brief: 'Grapeshot at anything in the yard.',
    gold: 850,
    damage: 60,
    damageKind: 'impact',
    blast: 0,
    range: 185,
    rate: 1.8,
  },
  {
    id: 'long-nine',
    age: 'gunpowder',
    role: 'marksman',
    name: 'Long Nine',
    brief: 'Armour-piercing. Answers heavies and artillery.',
    gold: 1400,
    damage: 218,
    damageKind: 'pierce',
    blast: 0,
    range: 300,
    rate: 0.5,
  },
  {
    id: 'howitzer-pit',
    age: 'gunpowder',
    role: 'mortar',
    name: 'Howitzer Pit',
    brief: 'Drops shells on the whole approach.',
    gold: 1750,
    damage: 340,
    damageKind: 'blast',
    blast: 90,
    range: 245,
    rate: 0.32,
  },

  {
    id: 'auto-cannon',
    age: 'modern',
    role: 'rapid',
    name: 'Auto Cannon',
    brief: 'Nothing on foot gets past it. Armour walks through.',
    gold: 2300,
    damage: 87,
    damageKind: 'impact',
    blast: 0,
    range: 200,
    rate: 2.6,
  },
  {
    id: 'atgm-nest',
    age: 'modern',
    role: 'marksman',
    name: 'ATGM Nest',
    brief: 'Built for tanks. Wasted on infantry.',
    gold: 3400,
    damage: 566,
    damageKind: 'pierce',
    blast: 28,
    range: 320,
    rate: 0.4,
  },
  {
    id: 'mortar-battery',
    age: 'modern',
    role: 'mortar',
    name: 'Mortar Battery',
    brief: 'Saturates the lane in front of the gate.',
    gold: 3850,
    damage: 755,
    damageKind: 'blast',
    blast: 110,
    range: 265,
    rate: 0.3,
  },

  {
    id: 'pulse-array',
    age: 'future',
    role: 'rapid',
    name: 'Pulse Array',
    brief: 'Sweeps the yard clean every second.',
    gold: 5400,
    damage: 189,
    damageKind: 'impact',
    blast: 0,
    range: 215,
    rate: 3,
  },
  {
    id: 'rail-turret',
    age: 'future',
    role: 'marksman',
    name: 'Rail Turret',
    brief: 'One slug, one mech.',
    gold: 8100,
    damage: 1620,
    damageKind: 'pierce',
    blast: 0,
    range: 350,
    rate: 0.35,
  },
  {
    id: 'graviton-well',
    age: 'future',
    role: 'mortar',
    name: 'Graviton Well',
    brief: 'Crushes a push into the ground. Literally.',
    gold: 9300,
    damage: 2027,
    damageKind: 'energy',
    blast: 145,
    range: 290,
    rate: 0.28,
  },
];

export const TURRET_BY_ID: Record<string, TurretDef> = TURRETS.reduce<Record<string, TurretDef>>(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {},
);

const ROLE_ORDER: TurretRole[] = ['rapid', 'marksman', 'mortar'];

export function turretsForAge(age: AgeId): TurretDef[] {
  return TURRETS.filter((t) => t.age === age).sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );
}

export const TURRET_SLOTS = 4;

/**
 * Slots two and three come free with the base. The last two are bought once
 * and kept for the whole match, so late-game defence is a real investment.
 */
export const SLOT_UNLOCK_COST = [0, 0, 400, 1200];

export const TURRET_ROLE_LABEL: Record<TurretRole, string> = {
  rapid: 'RAPID',
  marksman: 'MARKSMAN',
  mortar: 'MORTAR',
};
