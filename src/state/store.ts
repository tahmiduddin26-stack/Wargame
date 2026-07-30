import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LEVELS } from '@/data/levels';

export type Screen =
  | 'menu'
  | 'onboarding'
  | 'missions'
  | 'battle'
  | 'debrief'
  | 'codex'
  | 'settings';

export interface MissionRecord {
  cleared: boolean;
  /** Fastest clear, seconds. */
  bestTime: number | null;
  /** Highest age reached in a clear. Lower is a flex. */
  bestAge: number | null;
}

export interface DebriefData {
  levelId: number;
  won: boolean;
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

  settings: {
    /** Battle speed preference, restored on deploy. */
    speed: 1 | 1.5 | 2;
    haptics: boolean;
    /** Halves the corpse cap on weaker devices. */
    reducedCorpses: boolean;
    showLaneStrip: boolean;
  };

  go: (screen: Screen) => void;
  startMission: (levelId: number) => void;
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
      settings: {
        speed: 1,
        haptics: true,
        reducedCorpses: false,
        showLaneStrip: true,
      },

      go: (screen) => set({ screen }),

      startMission: (levelId) => set({ activeLevel: levelId, screen: 'battle', debrief: null }),

      finishMission: (data) => {
        const level = LEVELS.find((l) => l.id === data.levelId);
        const prior = get().records[data.levelId];
        const firstClear = data.won && !prior?.cleared;
        const reward = data.won ? Math.round((level?.reward ?? 0) * (firstClear ? 1 : 0.25)) : 0;

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
                },
              }
            : state.records,
        }));
      },

      closeDebrief: () => set({ debrief: null, screen: 'missions' }),

      completeOnboarding: () => set({ onboardingDone: true }),

      resetProgress: () => set({ records: {}, credits: 0, onboardingDone: false }),

      setSetting: (key, value) =>
        set((state) => ({ settings: { ...state.settings, [key]: value } })),
    }),
    {
      name: 'aow.progress.v1',
      partialize: (state) => ({
        onboardingDone: state.onboardingDone,
        records: state.records,
        credits: state.credits,
        settings: state.settings,
      }),
    },
  ),
);
