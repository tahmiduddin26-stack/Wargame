import { AGES } from '@/data/ages';
import { ARMY_SKINS } from '@/data/cosmetics';
import { DIFFICULTIES } from '@/data/difficulty';
import { LEVELS } from '@/data/levels';
import { PERKS } from '@/data/perks';
import { defaultProgress, localProgress, type BattleRecord, type LocalProgress, type MissionRecord } from './progress';

export const MAX_BACKUP_BYTES = 128 * 1024;
const FORMAT = 'doodlebook-battles-save';
const VERSION = 1;
type ObjectData = Record<string, unknown>;
const isObject = (v: unknown): v is ObjectData => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Strict for user imports; tolerant of missing/invalid fields in older local saves. */
export function readProgress(value: unknown, strict = false): LocalProgress {
  if (!isObject(value)) {
    if (strict) throw new Error('The backup has no valid progress data.');
    return defaultProgress();
  }
  const defaults = defaultProgress();
  const invalid = (label: string) => { throw new Error(`Invalid ${label} in this backup.`); };
  const number = (v: unknown, fallback: number, label: string, max = 1e9, integer = true): number => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max && (!integer || Number.isInteger(v))) return v;
    if (strict) invalid(label);
    return fallback;
  };
  const boolean = (v: unknown, fallback: boolean, label: string): boolean => {
    if (typeof v === 'boolean') return v;
    if (strict) invalid(label);
    return fallback;
  };
  const choice = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T, label: string): T => {
    if (allowed.includes(v as T)) return v as T;
    if (strict) invalid(label);
    return fallback;
  };
  const choices = <T extends string>(v: unknown, allowed: readonly T[], label: string): T[] => {
    if (!Array.isArray(v)) {
      if (strict) invalid(label);
      return [];
    }
    if (strict && (v.length > allowed.length || v.some((id) => !allowed.includes(id)))) invalid(label);
    return [...new Set(v.filter((id): id is T => allowed.includes(id)))];
  };
  const records: Record<number, MissionRecord> = {};
  if (strict && !isObject(value.records)) invalid('mission records');
  if (isObject(value.records)) {
    for (const [key, raw] of Object.entries(value.records)) {
      const level = LEVELS.find((l) => String(l.id) === key);
      if (!level || !isObject(raw)) {
        if (strict) invalid('mission record');
        continue;
      }
      const cleared = boolean(raw.cleared, false, 'mission clear');
      const bestTime = raw.bestTime === null || (!strict && (typeof raw.bestTime !== 'number' || !Number.isFinite(raw.bestTime) || raw.bestTime < 0)) ? null : number(raw.bestTime, 0, 'mission time', 604800, false);
      const bestAge = raw.bestAge === null || (!strict && (typeof raw.bestAge !== 'number' || !Number.isInteger(raw.bestAge) || raw.bestAge < 0 || raw.bestAge >= AGES.length)) ? null : number(raw.bestAge, 0, 'mission age', AGES.length - 1);
      const clearedTiers = raw.clearedTiers === undefined
        ? [] : choices(raw.clearedTiers, DIFFICULTIES.map((d) => d.id), 'cleared tiers');
      if (strict && !cleared && (bestTime !== null || bestAge !== null || clearedTiers.length)) invalid('uncleared mission');
      records[level.id] = { cleared, bestTime: cleared ? bestTime : null, bestAge: cleared ? bestAge : null, clearedTiers: cleared ? clearedTiers : [] };
    }
  }
  const recoveredXp = LEVELS.reduce((sum, l) => sum + (records[l.id]?.cleared ? l.reward : 0), 0);
  const skinIds = ARMY_SKINS.map((skin) => skin.id);
  const ownedSkins = [...new Set([defaults.equippedSkin, ...choices(value.ownedSkins, skinIds, 'army paints')])];
  const equippedSkin = choice(value.equippedSkin, skinIds, 'field', 'equipped paint');
  if (strict && !ownedSkins.includes(equippedSkin)) invalid('paint ownership');
  const settings = isObject(value.settings) ? value.settings : {};
  if (strict && !isObject(value.settings)) invalid('settings');
  // Backups made before service records remain importable.
  const stats = isObject(value.serviceStats) ? value.serviceStats : {};
  if (strict && value.serviceStats !== undefined && !isObject(value.serviceStats)) invalid('service totals');
  const statsStrict = strict && value.serviceStats !== undefined;
  const statNumber = (key: keyof LocalProgress['serviceStats'], max = 1e9, integer = true) =>
    statsStrict ? number(stats[key], 0, key, max, integer)
      : typeof stats[key] === 'number' && Number.isFinite(stats[key]) && stats[key] >= 0 && stats[key] <= max && (!integer || Number.isInteger(stats[key])) ? stats[key] : 0;
  const serviceStats = {
    campaignBattles: statNumber('campaignBattles'), campaignWins: statNumber('campaignWins'),
    survivalRuns: statNumber('survivalRuns'), kills: statNumber('kills'), losses: statNumber('losses'),
    secondsPlayed: statNumber('secondsPlayed', 1e10, false), highestAge: statNumber('highestAge', AGES.length - 1),
  };
  if (strict && serviceStats.campaignWins > serviceStats.campaignBattles) invalid('campaign win total');
  serviceStats.campaignWins = Math.min(serviceStats.campaignWins, serviceStats.campaignBattles);
  const battleHistory: BattleRecord[] = [];
  if (value.battleHistory !== undefined && !Array.isArray(value.battleHistory) && strict) invalid('battle history');
  if (Array.isArray(value.battleHistory)) {
    if (strict && value.battleHistory.length > 20) invalid('battle history length');
    for (const raw of value.battleHistory.slice(0, 20)) {
      if (!isObject(raw) || typeof raw.id !== 'string' || raw.id.length > 64 || typeof raw.finishedAt !== 'string' || !Number.isFinite(Date.parse(raw.finishedAt))) {
        if (strict) invalid('battle history entry');
        continue;
      }
      const mode = choice(raw.mode, ['campaign', 'survival'], 'campaign', 'battle mode');
      const levelId = number(raw.levelId, 0, 'battle mission', LEVELS.length);
      if ((mode === 'campaign' && !LEVELS.some((l) => l.id === levelId)) || (mode === 'survival' && levelId !== 0)) {
        if (strict) invalid('battle mission');
        continue;
      }
      battleHistory.push({
        id: raw.id, finishedAt: raw.finishedAt, mode, levelId,
        difficulty: choice(raw.difficulty, DIFFICULTIES.map((d) => d.id), 'normal', 'battle tier'),
        won: boolean(raw.won, false, 'battle result'), waves: number(raw.waves, 0, 'battle waves', 1e6),
        seconds: number(raw.seconds, 0, 'battle time', 604800, false), kills: number(raw.kills, 0, 'battle kills'),
        losses: number(raw.losses, 0, 'battle losses'), peakAge: number(raw.peakAge, 0, 'battle age', AGES.length - 1),
        credits: number(raw.credits, 0, 'battle credits'), xp: number(raw.xp, 0, 'battle XP'),
      });
    }
  }
  return {
    onboardingDone: boolean(value.onboardingDone, defaults.onboardingDone, 'briefing flag'), records,
    credits: number(value.credits, 0, 'credits'), careerXp: number(value.careerXp, recoveredXp, 'commander XP'),
    difficulty: choice(value.difficulty, DIFFICULTIES.map((d) => d.id), 'normal', 'difficulty'),
    survivalBest: number(value.survivalBest, 0, 'survival best', 1e6),
    perks: choices(value.perks, PERKS.map((p) => p.id), 'skills'), ownedSkins,
    equippedSkin: ownedSkins.includes(equippedSkin) ? equippedSkin : 'field', serviceStats, battleHistory,
    settings: {
      speed: choice(settings.speed, [1, 1.5, 2], 1, 'battle speed'),
      haptics: boolean(settings.haptics, true, 'haptics'), reducedCorpses: boolean(settings.reducedCorpses, false, 'corpse setting'),
      showLaneStrip: boolean(settings.showLaneStrip, true, 'lane strip'), sfx: boolean(settings.sfx, true, 'sound effects'), music: boolean(settings.music, true, 'music'),
      reducedMotion: settings.reducedMotion === undefined ? false : boolean(settings.reducedMotion, false, 'reduced motion'),
    },
  };
}

export function createBackup(state: LocalProgress, date = new Date()): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: date.toISOString(), progress: localProgress(state) }, null, 2);
}

export function parseBackup(json: string): { progress: LocalProgress; exportedAt: string } {
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new Error('This file is too large to be a game backup.');
  let data: unknown;
  try { data = JSON.parse(json); } catch { throw new Error('This file is not valid JSON. Choose a War Game backup.'); }
  if (!isObject(data) || data.format !== FORMAT) throw new Error('Choose a backup exported from War Game Settings.');
  if (data.version !== VERSION) throw new Error('This backup version is not supported.');
  if (typeof data.exportedAt !== 'string' || !Number.isFinite(Date.parse(data.exportedAt))) throw new Error('The backup date is invalid.');
  return { progress: readProgress(data.progress, true), exportedAt: data.exportedAt };
}
