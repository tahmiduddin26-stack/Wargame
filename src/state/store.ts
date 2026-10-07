import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DifficultyId } from '@/data/difficulty';
import { careerXpForMission, commanderRank } from '@/data/career';
import { ARMY_SKIN_BY_ID, type ArmySkinId } from '@/data/cosmetics';
import { LEVELS } from '@/data/levels';
import { PERKS, type PerkId } from '@/data/perks';
import { readProgress } from './backup';
import { defaultProgress, emptyServiceStats, localProgress, type BattleRecord, type LocalProgress, type MissionRecord, type ServiceStats } from './progress';
export type { MissionRecord } from './progress';

export type Screen =
  | 'menu'
  | 'onboarding'
  | 'missions'
  | 'battle'
  | 'debrief'
  | 'survival-debrief'
  | 'service-record'
  | 'codex'
  | 'armoury'
  | 'settings'
  | 'online';

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
  careerXpAward: number;
  firstClear: boolean;
}

export interface SurvivalDebriefData {
  waves: number;
  seconds: number;
  kills: number;
  losses: number;
  peakAge: number;
  won: boolean;
  reward: number;
  careerXpAward: number;
  previousBest: number;
}

interface GameState extends LocalProgress {
  screen: Screen;
  /** Mission currently loaded, or about to be. */
  activeLevel: number;
  debrief: DebriefData | null;
  survivalDebrief: SurvivalDebriefData | null;
  /** Changes on every deploy, including restarting the same level. */
  battleId: number;
  /** True while a Survival run is the active battle. */
  survivalRun: boolean;

  go: (screen: Screen) => void;
  startMission: (levelId: number) => void;
  startSurvival: () => void;
  setDifficulty: (id: DifficultyId) => void;
  buyPerk: (id: PerkId) => boolean;
  buySkin: (id: ArmySkinId) => boolean;
  equipSkin: (id: ArmySkinId) => boolean;
  finishSurvival: (data: Omit<SurvivalDebriefData, 'reward' | 'careerXpAward' | 'previousBest'>) => void;
  finishMission: (data: Omit<DebriefData, 'reward' | 'careerXpAward' | 'firstClear'>) => void;
  closeDebrief: () => void;
  completeOnboarding: () => void;
  resetProgress: () => void;
  restoreProgress: (progress: LocalProgress) => void;
  setSetting: <K extends keyof GameState['settings']>(
    key: K,
    value: GameState['settings'][K],
  ) => void;
}

function recordBattle(stats: ServiceStats, data: { kills: number; losses: number; seconds: number; peakAge: number }): ServiceStats {
  return {
    ...stats, kills: stats.kills + data.kills, losses: stats.losses + data.losses,
    secondsPlayed: stats.secondsPlayed + data.seconds, highestAge: Math.max(stats.highestAge, data.peakAge),
  };
}

function historyEntry(state: GameState, data: Omit<BattleRecord, 'id' | 'finishedAt' | 'difficulty'>): BattleRecord[] {
  const finishedAt = new Date().toISOString();
  return [{
    id: `${finishedAt}-${state.battleId}`, finishedAt, difficulty: state.difficulty,
    mode: data.mode, levelId: data.levelId, won: data.won, waves: data.waves,
    seconds: data.seconds, kills: data.kills, losses: data.losses, peakAge: data.peakAge,
    credits: data.credits, xp: data.xp,
  }, ...state.battleHistory].slice(0, 20);
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
      ...defaultProgress(),
      screen: 'menu',
      activeLevel: 1,
      debrief: null,
      survivalDebrief: null,
      battleId: 0,
      survivalRun: false,

      go: (screen) => set({ screen }),

      startMission: (levelId) => {
        if (!LEVELS.some((level) => level.id === levelId) || !isUnlocked(levelId, get().records)) return;
        set((s) => ({ activeLevel: levelId, screen: 'battle', debrief: null, survivalDebrief: null, survivalRun: false, battleId: s.battleId + 1 }));
      },

      startSurvival: () => set((s) => ({ screen: 'battle', debrief: null, survivalDebrief: null, survivalRun: true, battleId: s.battleId + 1 })),

      setDifficulty: (id) => set({ difficulty: id }),

      buyPerk: (id) => {
        const perk = PERKS.find((p) => p.id === id);
        const state = get();
        if (!perk || state.perks.includes(id) || state.credits < perk.cost) return false;
        if (commanderRank(state.careerXp) < perk.rank) return false;
        if (perk.requires && !state.perks.includes(perk.requires)) return false;
        set({ credits: state.credits - perk.cost, perks: [...state.perks, id] });
        return true;
      },

      buySkin: (id) => {
        const skin = ARMY_SKIN_BY_ID[id];
        const state = get();
        if (!skin || state.ownedSkins.includes(id) || state.credits < skin.cost) return false;
        set({
          credits: state.credits - skin.cost,
          ownedSkins: [...state.ownedSkins, id],
          equippedSkin: id,
        });
        return true;
      },

      equipSkin: (id) => {
        if (!get().ownedSkins.includes(id)) return false;
        set({ equippedSkin: id });
        return true;
      },

      finishSurvival: (data) => {
        const state = get();
        if (state.screen !== 'battle' || !state.survivalRun) return;
        // The score is the wave reached, consistent with existing saved bests.
        const reward = data.waves;
        const careerXpAward = data.waves * 3;
        set({
          survivalDebrief: { ...data, reward, careerXpAward, previousBest: state.survivalBest },
          screen: 'survival-debrief',
          survivalBest: Math.max(state.survivalBest, data.waves),
          credits: state.credits + reward,
          careerXp: state.careerXp + careerXpAward,
          survivalRun: false,
          serviceStats: { ...recordBattle(state.serviceStats, data), survivalRuns: state.serviceStats.survivalRuns + 1 },
          battleHistory: historyEntry(state, { ...data, mode: 'survival', levelId: 0, credits: reward, xp: careerXpAward }),
        });
      },

      finishMission: (data) => {
        const level = LEVELS.find((l) => l.id === data.levelId);
        const state = get();
        if (!level || state.screen !== 'battle' || state.survivalRun || state.activeLevel !== data.levelId) return;
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
        const careerXpAward = careerXpForMission(level?.reward ?? 0, data.tierReward, data.won);

        set((state) => ({
          debrief: { ...data, reward, careerXpAward, firstClear },
          screen: 'debrief',
          credits: state.credits + reward,
          careerXp: state.careerXp + careerXpAward,
          serviceStats: {
            ...recordBattle(state.serviceStats, data),
            campaignBattles: state.serviceStats.campaignBattles + 1,
            campaignWins: state.serviceStats.campaignWins + Number(data.won),
          },
          battleHistory: historyEntry(state, { ...data, mode: 'campaign', waves: 0, credits: reward, xp: careerXpAward }),
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

      closeDebrief: () => set({ debrief: null, survivalDebrief: null, screen: 'missions' }),

      completeOnboarding: () => set({ onboardingDone: true }),

      resetProgress: () =>
        set({ records: {}, credits: 0, careerXp: 0, onboardingDone: false, perks: [], survivalBest: 0, ownedSkins: ['field'], equippedSkin: 'field', serviceStats: emptyServiceStats(), battleHistory: [], debrief: null, survivalDebrief: null, survivalRun: false }),

      restoreProgress: (progress) => set({
        ...readProgress(progress, true), screen: 'menu', activeLevel: 1,
        debrief: null, survivalDebrief: null, survivalRun: false,
      }),

      setSetting: (key, value) =>
        set((state) => ({ settings: { ...state.settings, [key]: value } })),
    }),
    {
      name: 'aow.progress.v1',
      partialize: (state) => localProgress(state),
      merge: (persisted, current) => ({ ...current, ...readProgress(persisted) }),
    },
  ),
);
