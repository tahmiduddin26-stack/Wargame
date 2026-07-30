import type { AgeId, SpecialDef } from './types';

/**
 * The original's free-but-slow panic button, one per age. Costs no gold and no
 * XP; the only resource is the cooldown. Impulse is deliberately large: the
 * ragdoll launch is most of why using it feels worth the wait.
 */
export const SPECIALS: Record<AgeId, SpecialDef> = {
  stone: {
    age: 'stone',
    name: 'Rockslide',
    brief: 'The whole hillside comes down on the lane.',
    cooldown: 45,
    damage: 60,
    strikes: 9,
    blast: 62,
    impulse: 0.5,
  },
  medieval: {
    age: 'medieval',
    name: 'Arrow Storm',
    brief: 'Every archer in the keep fires at once.',
    cooldown: 48,
    damage: 150,
    strikes: 14,
    blast: 55,
    impulse: 0.35,
  },
  gunpowder: {
    age: 'gunpowder',
    name: 'Mortar Barrage',
    brief: 'Nine tubes, one grid reference.',
    cooldown: 52,
    damage: 420,
    strikes: 10,
    blast: 80,
    impulse: 0.75,
  },
  modern: {
    age: 'modern',
    name: 'Air Strike',
    brief: 'Two passes down the length of the lane.',
    cooldown: 58,
    damage: 1100,
    strikes: 12,
    blast: 105,
    impulse: 1.1,
  },
  future: {
    age: 'future',
    name: 'Ion Lance',
    brief: 'Orbital cut from one end of the field to the other.',
    cooldown: 65,
    damage: 3200,
    strikes: 8,
    blast: 130,
    impulse: 1.6,
  },
};
