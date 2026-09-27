import type { AgeDef, AgeId } from './types';

/**
 * Five ages, matching the arc from cavemen to lasers. Later gates are tuned
 * against the campaign clock so Future can actually appear in late missions.
 */
export const AGES: AgeDef[] = [
  {
    id: 'stone',
    index: 0,
    name: 'Stone Age',
    tagline: 'Rocks and nerve.',
    evolveXp: 0,
    baseArmour: 1,
    accent: '#d9784e',
    skyline: ['#8bc9df', '#d9ece0'],
    ground: '#c9aa76',
  },
  {
    id: 'medieval',
    index: 1,
    name: 'Medieval Age',
    tagline: 'Steel and siege.',
    evolveXp: 1_200,
    baseArmour: 1.8,
    accent: '#708fb6',
    skyline: ['#96cddd', '#e4efd9'],
    ground: '#aab682',
  },
  {
    id: 'gunpowder',
    index: 2,
    name: 'Gunpowder Age',
    tagline: 'Powder and drill.',
    evolveXp: 4_500,
    baseArmour: 3.2,
    accent: '#d68c42',
    skyline: ['#f5c59e', '#fae1b6'],
    ground: '#c3aa79',
  },
  {
    id: 'modern',
    index: 3,
    name: 'Modern Age',
    tagline: 'Armour and airpower.',
    evolveXp: 14_000,
    baseArmour: 6,
    accent: '#6c9f73',
    skyline: ['#a2d3d8', '#e2eecf'],
    ground: '#a4b68b',
  },
  {
    id: 'future',
    index: 4,
    name: 'Future Age',
    tagline: 'Rails and ion.',
    evolveXp: 32_000,
    baseArmour: 11,
    accent: '#71a6bd',
    skyline: ['#b6b8e7', '#e4e3ef'],
    ground: '#acafc7',
  },
];

export const AGE_COUNT = AGES.length;

export const AGE_BY_ID: Record<AgeId, AgeDef> = AGES.reduce(
  (acc, age) => {
    acc[age.id] = age;
    return acc;
  },
  {} as Record<AgeId, AgeDef>,
);

export function ageAt(index: number): AgeDef {
  return AGES[Math.max(0, Math.min(AGE_COUNT - 1, index))];
}

/** XP still owed before the next age unlocks. Returns null at max age. */
export function xpToNextAge(currentIndex: number, bankedXp: number): number | null {
  const next = AGES[currentIndex + 1];
  if (!next) return null;
  return Math.max(0, next.evolveXp - bankedXp);
}
