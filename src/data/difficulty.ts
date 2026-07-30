/**
 * Four tiers, as both Age of War games shipped (Easy / Medium / Hard / Insane).
 *
 * These multiply each mission's own enemy numbers rather than replacing them, so
 * a mission keeps its character at every tier: the wide-field artillery duel is
 * still an artillery duel on Insane, just against a better-funded commander who
 * reacts faster and starts sooner.
 *
 * Nothing here touches the player's side. A tier never nerfs your units or pads
 * your gate, because a difficulty setting that changes your own numbers makes
 * every guide and every habit tier-specific.
 */
export type DifficultyId = 'easy' | 'normal' | 'hard' | 'insane';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  /** One line, stated in terms of what the opponent does. */
  blurb: string;
  /** Multiplies the mission's enemy income and opening war chest. */
  economy: number;
  /** Multiplies enemy aggression, which drives reaction speed and push size. */
  aggression: number;
  /** Multiplies the enemy's warmup, so higher tiers start sooner. */
  warmup: number;
  /** Multiplies credits earned. Clearing on Insane is worth the pain. */
  reward: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'easy',
    name: 'Easy',
    blurb: 'Their commander is poorly funded and slow off the mark.',
    economy: 0.7,
    aggression: 0.75,
    warmup: 1.4,
    reward: 0.6,
  },
  {
    id: 'normal',
    name: 'Normal',
    blurb: 'The valley as it was written. Every mission is tuned here.',
    economy: 1,
    aggression: 1,
    warmup: 1,
    reward: 1,
  },
  {
    id: 'hard',
    name: 'Hard',
    blurb: 'Better funded, quicker to answer a push, and awake early.',
    economy: 1.35,
    aggression: 1.15,
    warmup: 0.7,
    reward: 1.5,
  },
  {
    id: 'insane',
    name: 'Insane',
    blurb: 'Outspends you almost two to one and never wastes a purchase.',
    economy: 1.8,
    aggression: 1.3,
    warmup: 0.5,
    reward: 2.2,
  },
];

export const DIFFICULTY_BY_ID: Record<DifficultyId, DifficultyDef> = DIFFICULTIES.reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<DifficultyId, DifficultyDef>,
);

export function difficulty(id: DifficultyId): DifficultyDef {
  return DIFFICULTY_BY_ID[id] ?? DIFFICULTY_BY_ID.normal;
}
