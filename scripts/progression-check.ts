import assert from 'node:assert/strict';
import { createBackup, parseBackup, readProgress } from '../src/state/backup';
import { defaultProgress, localProgress } from '../src/state/progress';
import { serviceMedals } from '../src/data/medals';

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
};
Object.defineProperty(globalThis, 'localStorage', { value: storage });
Object.defineProperty(globalThis, 'window', { value: { localStorage: storage } });
const { useGame } = await import('../src/state/store');

const legacy = readProgress({ records: { 1: { cleared: true, bestTime: 90, bestAge: 0 } }, credits: 100 });
assert(legacy.careerXp > 0);
assert.equal(legacy.records[1].bestTime, 90);
assert.equal(legacy.serviceStats.campaignBattles, 0);
assert.deepEqual(legacy.ownedSkins, ['field']);
assert.equal(readProgress({ records: { 1: { cleared: true } } }).records[1].bestTime, null);
assert.equal(readProgress(null).credits, 0);

useGame.getState().startSurvival();
const firstRun = useGame.getState().battleId;
useGame.getState().startSurvival();
assert.equal(useGame.getState().battleId, firstRun + 1);
assert.equal(useGame.getState().survivalRun, true);
const survival = { waves: 12, seconds: 250, kills: 40, losses: 10, peakAge: 3, won: false };
useGame.getState().finishSurvival(survival);
assert.equal(useGame.getState().screen, 'survival-debrief');
assert.equal(useGame.getState().credits, 12);
assert.equal(useGame.getState().careerXp, 36);
assert.equal(useGame.getState().serviceStats.survivalRuns, 1);
useGame.getState().finishSurvival(survival);
assert.equal(useGame.getState().credits, 12, 'duplicate result must not pay twice');
assert.equal(useGame.getState().serviceStats.survivalRuns, 1);

useGame.getState().startMission(1);
const campaign = { levelId: 1, won: true, tierReward: 1, decidedBy: 'gate' as const, seconds: 100, kills: 20, losses: 5, goldSpent: 200, peakAge: 1 };
useGame.getState().finishMission(campaign);
const credits = useGame.getState().credits;
assert(credits > 12);
useGame.getState().finishMission(campaign);
assert.equal(useGame.getState().credits, credits);
assert.equal(useGame.getState().serviceStats.campaignWins, 1);
assert.equal(useGame.getState().serviceStats.kills, 60);
assert.equal(useGame.getState().battleHistory.length, 2);
assert.equal(JSON.parse(memory.get('aow.progress.v1')!).state.serviceStats.kills, 60);
assert(serviceMedals(useGame.getState()).find((m) => m.id === 'first-ink')?.earned);
assert(serviceMedals(useGame.getState()).find((m) => m.id === 'watch-10')?.earned);

const backup = createBackup(useGame.getState());
assert.deepEqual(parseBackup(backup).progress, localProgress(useGame.getState()));
assert(!backup.includes('survivalDebrief'));
assert(!backup.includes('battleId'));
assert.throws(() => parseBackup('{broken'), /valid JSON/);
assert.throws(() => parseBackup(JSON.stringify({ ...JSON.parse(backup), version: 99 })), /version/);
const malformed = JSON.parse(backup);
malformed.progress.credits = -10;
assert.throws(() => parseBackup(JSON.stringify(malformed)), /credits/);
malformed.progress.credits = 0;
malformed.progress.equippedSkin = 'iron';
assert.throws(() => parseBackup(JSON.stringify(malformed)), /ownership/);
const legacyBackup = JSON.parse(backup);
delete legacyBackup.progress.battleHistory;
delete legacyBackup.progress.settings.reducedMotion;
assert.deepEqual(parseBackup(JSON.stringify(legacyBackup)).progress.battleHistory, []);
assert.equal(parseBackup(JSON.stringify(legacyBackup)).progress.settings.reducedMotion, false);
assert.throws(() => parseBackup(' '.repeat(129 * 1024)), /too large/);

useGame.getState().resetProgress();
assert.equal(useGame.getState().serviceStats.kills, 0);
assert.equal(useGame.getState().battleHistory.length, 0);
useGame.getState().restoreProgress(parseBackup(backup).progress);
assert.equal(useGame.getState().credits, credits);
assert.equal(useGame.getState().screen, 'menu');
assert.equal(useGame.getState().serviceStats.kills, 60);
assert.equal(typeof useGame.getState().startSurvival, 'function');
useGame.getState().restoreProgress(defaultProgress());
console.log('Progression, duplicate rewards, restart IDs, legacy saves and backup validation passed.');
