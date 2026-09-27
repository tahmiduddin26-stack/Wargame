/** Public ranked divisions. New guest profiles begin at 1,000 rating in Bronze. */
export const RANK_TIERS = [
  { name: 'Bronze', min: 0 },
  { name: 'Silver', min: 1100 },
  { name: 'Gold', min: 1300 },
  { name: 'Platinum', min: 1500 },
  { name: 'Diamond', min: 1700 },
] as const;

export type RankTier = (typeof RANK_TIERS)[number]['name'];

export function rankForRating(rating: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (rating >= RANK_TIERS[i].min) return RANK_TIERS[i].name;
  }
  return 'Bronze';
}

export function nextRankForRating(rating: number): (typeof RANK_TIERS)[number] | null {
  return RANK_TIERS.find((tier) => tier.min > rating) ?? null;
}

/** Ranked search begins within 150 rating and expands across divisions. */
export function canPairRanked(leftRating: number, rightRating: number, waitedMs: number): boolean {
  const range = waitedMs >= 90000 ? Infinity : 150 + Math.floor(Math.max(0, waitedMs) / 15000) * 100;
  return Math.abs(leftRating - rightRating) <= range;
}
