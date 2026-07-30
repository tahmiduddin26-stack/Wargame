import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DifficultyId } from '@/data/difficulty';
import { LEVELS } from '@/data/levels';
import { PERKS, type PerkId } from '@/data/perks';

export type Screen =
  | 'menu'
  | 'onboarding'
  | 'missions'
  | 'battle'
  | 'debrief'
  | 'codex'
  | 'armoury'
  | 'settings';

export interface MissionRecord {
  cleared: boolean;
  /** Fastest clear, seconds. */
  bestTime: number | null;
  /** Highest age reached in a clear. Lower is a flex. */
  bestAge: number | null;
  /** Tiers this mission has been cleared on. Drives the ladder on the list. */
  clearedTiers?: DifficultyId[];
}

export interface DebriefData {
  levelId: number;
  won: boolean;
  /** Tier reward multiplier at the time of the clear. */
  tierReward: number;
  /** 'gate' means a base fell. The others mean the clock ran out. */
  decidedBy: 'gate' | 'structure' | 'ground';
  seconds: number;
  kills: number;
  losses: number;
  goldSpent: number;
  peakAge: number;
  reward: number;
  firstClear: boolean;
}

interface GameState {
  screen: Screen;
  /** Mission currently loaded, or about to be. */
  activeLevel: number;
  debrief: DebriefData | null;

  onboardingDone: boolean;
  records: Record<number, MissionRecord>;
  credits: number;
  /** Tier used for campaign deploys. Remembered between sessions. */
  difficulty: DifficultyId;
  /** Survival is its own mode, with its own best score. */
  survivalBest: number;
  /** True while a Survival run is the active battle. */
  survivalRun: boolean;
  /** Permanently purchased armoury perks. */
  perks: PerkId[];

  settings: {
    /** Battle speed preference, restored on deploy. */
    speed: 1 | 1.5 | 2;
    haptics: boolean;
    /** Halves the corpse cap on weaker devices. */
    reducedCorpses: boolean;
    showLaneStrip: boolean;
    sfx: boolean;
    music: boolean;
  };

  go: (screen: Screen) => void;
  startMission: (levelId: number) => void;
  startSurvival: () => void;
  setDifficulty: (id: DifficultyId) => void;
  buyPerk: (id: PerkId) => boolean;
  recordSurvival: (waves: number) => void;
  finishMission: (data: Omit<DebriefData, 'reward' | 'firstClear'>) => void;
  closeDebrief: () => void;
  completeOnboarding: () => void;
  resetProgress: () => void;
  setSetting: <K extends keyof GameState['settings']>(
    key: K,
    value: GameState['settings'][K],
  ) => void;
}

/** A mission is playable once the one before it has been cleared. */
export function isUnlocked(levelId: number, records: Record<number, MissionRecord>): boolean {
  if (levelId <= 1) return true;
  return !!records[levelId - 1]?.cleared;
}

export function nextMission(records: Record<number, MissionRecord>): number {
  for (const level of LEVELS) {
    if (!records[level.id]?.cleared) return level.id;
  }
  return LEVELS[LEVELS.length - 1].id;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'menu',
      activeLevel: 1,
      debrief: null,
      onboardingDone: false,
      records: {},
      credits: 0,
      difficulty: 'normal',
      survivalBest: 0,
      survivalRun: false,
      perks: [],
      settings: {
        speed: 1,
        haptics: true,
        reducedCorpses: false,
        showLaneStrip: true,
        sfx: true,
        music: true,
      },

      go: (screen) => set({ screen }),

      startMission: (levelId) =>
        set({ activeLevel: levelId, screen: 'battle', debrief: null, survivalRun: false }),

      startSurvival: () => set({ screen: 'battle', debrief: null, survivalRun: true }),

      setDifficulty: (id) => set({ difficulty: id }),

      buyPerk: (id) => {
        const perk = PERKS.find((p) => p.id === id);
        const state = get();
        if (!perk || state.perks.includes(id) || state.credits < perk.cost) return false;
        set({ credits: state.credits - perk.cost, perks: [...state.perks, id] });
        return true;
      },

      recordSurvival: (waves) =>
        set((state) => ({
          survivalBest: Math.max(state.survivalBest, waves),
          // Survival pays a credit per wave held, so it is a real way to earn.
          credits: state.credits + waves,
          survivalRun: false,
        })),

      finishMission: (data) => {
        const level = LEVELS.find((l) => l.id === data.levelId);
        const state = get();
        const prior = state.records[data.levelId];
        const tier = state.difficulty;
        const firstClear = data.won && !prior?.cleared;
        // First clear on a tier you have not beaten before pays like a first
        // clear, which is what makes the ladder worth climbing.
        const firstOnTier = data.won && !prior?.clearedTiers?.includes(tier);
        const scale = firstClear ? 1 : firstOnTier ? 0.6 : 0.25;
        const reward = data.won
          ? Math.round((level?.reward ?? 0) * scale * data.tierReward)
          : 0;

        set((state) => ({
          debrief: { ...data, reward, firstClear },
          screen: 'debrief',
          credits: state.credits + reward,
          records: data.won
            ? {
                ...state.records,
                [data.levelId]: {
                  cleared: true,
                  bestTime:
                    prior?.bestTime != null
                      ? Math.min(prior.bestTime, data.seconds)
                      : data.seconds,
                  bestAge:
                    prior?.bestAge != null
                      ? Math.min(prior.bestAge, data.peakAge)
                      : data.peakAge,
                  clearedTiers: Array.from(new Set([...(prior?.clearedTiers ?? []), tier])),
                },
              }
            : state.records,
        }));
      },

      closeDebrief: () => set({ debrief: null, screen: 'missions' }),

      completeOnboarding: () => set({ onboardingDone: true }),

      resetProgress: () =>
        set({ records: {}, credits: 0, onboardingDone: false, perks: [], survivalBest: 0 }),

      setSetting: (key, value) =>
        set((state) => ({ settings: { ...state.settings, [key]: value } })),
    }),
    {
      name: 'aow.progress.v1',
      partialize: (state) => ({
        onboardingDone: state.onboardingDone,
        records: state.records,
        credits: state.credits,
        difficulty: state.difficulty,
        survivalBest: state.survivalBest,
        perks: state.perks,
        settings: state.settings,
      }),
    },
  ),
);
