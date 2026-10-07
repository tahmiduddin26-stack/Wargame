import { AGES } from '@/data/ages';
import { commanderRank } from '@/data/career';
import { useGame } from '@/state/store';

export function SurvivalDebrief() {
  const { survivalDebrief: result, careerXp, startSurvival, closeDebrief, go } = useGame();
  if (!result) return null;
  const newBest = result.waves > result.previousBest;
  const duration = `${Math.floor(result.seconds / 60)}:${String(Math.floor(result.seconds % 60)).padStart(2, '0')}`;
  return (
    <div className={`db db--${newBest ? 'win' : 'loss'} sd`}>
      <div className="hazard-rule" />
      <div className="db__inner scroll-y">
        <header className="db__head">
          <span className="label">The Long Watch · Survival</span>
          <h2 className="db__verdict">{newBest ? 'A new best!' : 'Watch ended'}</h2>
          <p className="db__sub">{result.won ? 'Their gate fell. Your watch is recorded.' : 'Your gate fell. The next watch starts stronger.'} Score counts the last wave reached.</p>
        </header>
        <dl className="db__stats">
          <div className="sd__wave"><dt className="label">Wave reached</dt><dd className="num">{result.waves}</dd></div>
          <div><dt className="label">Personal best</dt><dd className="num">{Math.max(result.previousBest, result.waves)}</dd></div>
          <div><dt className="label">Duration</dt><dd className="num">{duration}</dd></div>
          <div><dt className="label">Kills / losses</dt><dd className="num">{result.kills} / {result.losses}</dd></div>
          <div><dt className="label">Final age</dt><dd>{AGES[result.peakAge].name}</dd></div>
          <div className="db__stat--reward"><dt className="label">Credits earned</dt><dd className="num">+{result.reward}</dd></div>
          <div className="db__stat--career"><dt className="label">Commander XP</dt><dd className="num">+{result.careerXpAward}</dd></div>
        </dl>
        <p className="db__rank">Rank {commanderRank(careerXp)} · {careerXp.toLocaleString('en-GB')} total XP. Each wave reached earns 1 credit and 3 XP.</p>
        <div className="db__actions">
          <button className="btn btn--primary" onClick={startSurvival}>Try again</button>
          <button className="btn btn--ghost" onClick={closeDebrief}>Campaign</button>
          <button className="btn btn--ghost" onClick={() => go('service-record')}>Service record</button>
        </div>
      </div>
    </div>
  );
}
