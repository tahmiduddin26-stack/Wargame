import type { ArmySkinId } from '@/data/cosmetics';
import type { DifficultyId } from '@/data/difficulty';
import type { PerkId } from '@/data/perks';

export interface MissionRecord {
  cleared: boolean;
  /** Fastest clear in battle seconds. */
  bestTime: number | null;
  /** Lowest age needed for a clear, zero based. */
  bestAge: number | null;
  clearedTiers?: DifficultyId[];
}

/** Finished offline battles, counted from the service-record update onwards. */
export interface ServiceStats {
  campaignBattles: number;
  campaignWins: number;
  survivalRuns: number;
  kills: number;
  losses: number;
  secondsPlayed: number;
  highestAge: number;
}

export interface BattleRecord {
  id: string;
  finishedAt: string;
  mode: 'campaign' | 'survival';
  levelId: number;
  difficulty: DifficultyId;
  won: boolean;
  waves: number;
  seconds: number;
  kills: number;
  losses: number;
  peakAge: number;
  credits: number;
  xp: number;
}

export interface LocalProgress {
  onboardingDone: boolean;
  records: Record<number, MissionRecord>;
  credits: number;
  careerXp: number;
  difficulty: DifficultyId;
  survivalBest: number;
  perks: PerkId[];
  ownedSkins: ArmySkinId[];
  equippedSkin: ArmySkinId;
  serviceStats: ServiceStats;
  battleHistory: BattleRecord[];
  settings: {
    speed: 1 | 1.5 | 2;
    haptics: boolean;
    reducedCorpses: boolean;
    showLaneStrip: boolean;
    sfx: boolean;
    music: boolean;
    reducedMotion: boolean;
  };
}

export function emptyServiceStats(): ServiceStats {
  return { campaignBattles: 0, campaignWins: 0, survivalRuns: 0, kills: 0, losses: 0, secondsPlayed: 0, highestAge: 0 };
}

export function defaultProgress(): LocalProgress {
  return {
    onboardingDone: false, records: {}, credits: 0, careerXp: 0, difficulty: 'normal',
    survivalBest: 0, perks: [], ownedSkins: ['field'], equippedSkin: 'field',
    serviceStats: emptyServiceStats(), battleHistory: [],
    settings: { speed: 1, haptics: true, reducedCorpses: false, showLaneStrip: true, sfx: true, music: true, reducedMotion: false },
  };
}

/** Explicit fields keep navigation, actions and online credentials out of saves. */
export function localProgress(state: LocalProgress): LocalProgress {
  return {
    onboardingDone: state.onboardingDone, records: state.records, credits: state.credits,
    careerXp: state.careerXp, difficulty: state.difficulty, survivalBest: state.survivalBest,
    perks: state.perks, ownedSkins: state.ownedSkins, equippedSkin: state.equippedSkin,
    serviceStats: state.serviceStats, battleHistory: state.battleHistory, settings: state.settings,
  };
}
