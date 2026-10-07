import { commanderRank } from './career';
import { ARMY_SKINS } from './cosmetics';
import { LEVELS } from './levels';
import { PERKS } from './perks';
import type { LocalProgress } from '@/state/progress';

export type MedalMark = 'flag' | 'shield' | 'watch' | 'star' | 'tools' | 'paint';
export interface Medal {
  id: string;
  name: string;
  note: string;
  mark: MedalMark;
  value: number;
  target: number;
  earned: boolean;
}

/** Medals recognise existing progress; they do not add currency or combat stats. */
export function serviceMedals(progress: LocalProgress): Medal[] {
  const clears = LEVELS.filter((l) => progress.records[l.id]?.cleared).length;
  const hardClears = LEVELS.filter((l) => progress.records[l.id]?.clearedTiers?.some((tier) => tier === 'hard' || tier === 'insane')).length;
  const insaneClears = LEVELS.filter((l) => progress.records[l.id]?.clearedTiers?.includes('insane')).length;
  const medal = (id: string, name: string, note: string, mark: MedalMark, value: number, target: number): Medal =>
    ({ id, name, note, mark, value: Math.min(value, target), target, earned: value >= target });
  return [
    medal('first-ink', 'First ink', 'Clear your first operation.', 'flag', clears, 1),
    medal('trailblazer', 'Trailblazer', 'Clear four different operations.', 'flag', clears, 4),
    medal('halfway', 'Half the map', 'Clear eight different operations.', 'flag', clears, 8),
    medal('campaign', 'Every valley', 'Clear the whole campaign.', 'flag', clears, LEVELS.length),
    medal('hard', 'Hard fought', 'Clear an operation on Hard or Insane.', 'shield', hardClears, 1),
    medal('insane', 'Against the odds', 'Clear three operations on Insane.', 'shield', insaneClears, 3),
    medal('watch-10', 'Night watch', 'Reach wave 10 in Survival.', 'watch', progress.survivalBest, 10),
    medal('watch-25', 'No relief', 'Reach wave 25 in Survival.', 'watch', progress.survivalBest, 25),
    medal('future', 'Tomorrow’s army', 'Reach the Future Age in a finished offline battle.', 'star', Number(progress.serviceStats.highestAge >= 4 || Object.values(progress.records).some((r) => r.bestAge === 4)), 1),
    medal('rank-5', 'Field commander', 'Reach commander rank 5.', 'star', commanderRank(progress.careerXp), 5),
    medal('skills', 'Full kit', 'Own every Armoury skill.', 'tools', PERKS.filter((p) => progress.perks.includes(p.id)).length, PERKS.length),
    medal('paints', 'Colour guard', 'Collect every army paint.', 'paint', ARMY_SKINS.filter((s) => progress.ownedSkins.includes(s.id)).length, ARMY_SKINS.length),
  ];
}
