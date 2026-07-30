import type { AgeDef, AgeId } from './types';

/**
 * Five ages, matching the original's arc from cavemen to lasers. The XP gates
 * follow the original's exponential curve (the Flash game asked 4k for age 2
 * and 14k for age 3); later gates are extrapolated on the same ratio.
 */
export const AGES: AgeDef[] = [
  {
    id: 'stone',
    index: 0,
    name: 'Stone Age',
    tagline: 'Rocks and nerve.',
    evolveXp: 0,
    baseArmour: 1,
    accent: '#c8783c',
    skyline: ['#3a2d24', '#6b4a30'],
    ground: '#5a4530',
  },
  {
    id: 'medieval',
    index: 1,
    name: 'Medieval Age',
    tagline: 'Steel and siege.',
    evolveXp: 1_200,
    baseArmour: 1.8,
    accent: '#8fa1b8',
    skyline: ['#232b33', '#4a5b6b'],
    ground: '#414a3c',
  },
  {
    id: 'gunpowder',
    index: 2,
    name: 'Gunpowder Age',
    tagline: 'Powder and drill.',
    evolveXp: 5_000,
    baseArmour: 3.2,
    accent: '#c9a227',
    skyline: ['#2a241c', '#6a5a38'],
    ground: '#4c4531',
  },
  {
    id: 'modern',
    index: 3,
    name: 'Modern Age',
    tagline: 'Armour and airpower.',
    evolveXp: 18_000,
    baseArmour: 6,
    accent: '#6f8f5a',
    skyline: ['#1d2420', '#3f5342'],
    ground: '#3c4437',
  },
  {
    id: 'future',
    index: 4,
    name: 'Future Age',
    tagline: 'Rails and ion.',
    evolveXp: 60_000,
    baseArmour: 11,
    accent: '#3fd0c9',
    skyline: ['#14181f', '#25384a'],
    ground: '#2b333a',
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
