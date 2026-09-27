/** Persistent commander XP. Battle XP still belongs to each individual match. */
export const RANK_THRESHOLDS = [0, 80, 220, 420, 700, 1050, 1480, 2000, 2620, 3350] as const;

export function commanderRank(xp: number): number {
  let rank = 1;
  for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
    if (xp < RANK_THRESHOLDS[i]) break;
    rank = i + 1;
  }
  return rank;
}

export function nextRankXp(xp: number): number | null {
  return RANK_THRESHOLDS[commanderRank(xp)] ?? null;
}

export function careerXpForMission(reward: number, tierReward: number, won: boolean): number {
  return Math.round(reward * tierReward * (won ? 1 : 0.12));
}
