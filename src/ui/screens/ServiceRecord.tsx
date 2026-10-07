import { useState } from 'react';
import { AGES } from '@/data/ages';
import { commanderRank, nextRankXp, RANK_THRESHOLDS } from '@/data/career';
import { LEVELS } from '@/data/levels';
import { DIFFICULTIES } from '@/data/difficulty';
import { serviceMedals, type MedalMark } from '@/data/medals';
import { useGame } from '@/state/store';

function MedalDrawing({ mark }: { mark: MedalMark }) {
  return (
    <svg className="sr__drawing" viewBox="0 0 64 72" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 3 15 2 2 26-10 3-7-31Z" fill="var(--coral)" />
        <path d="m33 5 14-2-6 31-10-3 2-26Z" fill="var(--sky)" />
        <path d="M32 23c16-1 25 9 25 22 0 14-10 25-25 24C18 70 7 58 8 44 8 31 18 23 32 23Z" fill="var(--sun)" />
        <circle cx="32" cy="46" r="18" fill="var(--paper-bright)" strokeDasharray="2 4" />
        <g fill="none">
          {mark === 'flag' && <path d="M26 57V35l16 3-4 7-12-2m-5 15h13" />}
          {mark === 'shield' && <path d="m32 34 11 5-2 12-9 8-9-8-2-12 11-5Zm-6 12 4 4 8-9" />}
          {mark === 'watch' && <><circle cx="32" cy="46" r="11" /><path d="M32 38v8l6 3m-8-18h4" /></>}
          {mark === 'star' && <path d="m32 33 4 8 9 2-7 6 1 10-7-5-8 4 2-9-7-7 9-1 4-8Z" />}
          {mark === 'tools' && <path d="m24 36 16 20m-1-20-16 20m-2-17 5-4m9 3 6 4m-18 9-3 5 5 1 3-3m10-4 5 4-3 4-4-4" />}
          {mark === 'paint' && <path d="m25 36 12-1 5 8-8 7-4-2-5-12Zm6 13-8 10m14-20 2 4" />}
        </g>
      </g>
    </svg>
  );
}

export function ServiceRecord() {
  const [showAll, setShowAll] = useState(false);
  const state = useGame();
  const { go, serviceStats: stats, careerXp } = state;
  const rank = commanderRank(careerXp);
  const nextXp = nextRankXp(careerXp);
  const rankStart = RANK_THRESHOLDS[rank - 1];
  const medals = serviceMedals(state);
  const clears = LEVELS.filter((l) => state.records[l.id]?.cleared).length;
  const finished = stats.campaignBattles + stats.survivalRuns;
  const totals = [
    ['Operations cleared', `${clears} / ${LEVELS.length}`],
    ['Best survival wave', String(state.survivalBest)],
    ['Battles finished', String(finished)],
    ['Campaign wins', `${stats.campaignWins} / ${stats.campaignBattles}`],
    ['Survival runs', String(stats.survivalRuns)],
    ['Kills / losses', `${stats.kills.toLocaleString('en-GB')} / ${stats.losses.toLocaleString('en-GB')}`],
    ['Battle time', `${Math.floor(stats.secondsPlayed / 60)} min`],
    ['Highest age', finished ? AGES[stats.highestAge].name : 'No battles yet'],
  ];

  return (
    <div className="st sr">
      <header className="st__head">
        <button className="btn btn--ghost" onClick={() => go('menu')}>Back</button>
        <h2 className="st__title">Service record</h2>
        <span className="label">{medals.filter((m) => m.earned).length} / {medals.length} medals</span>
      </header>
      <div className="hazard-rule" />
      <div className="sr__body scroll-y">
        <section className="sr__career panel">
          <div>
            <span className="label">Commander</span>
            <h3>Rank <span className="num">{rank}</span></h3>
          </div>
          <div className="sr__xp">
            <p><span className="num">{careerXp.toLocaleString('en-GB')}</span> total XP</p>
            <progress aria-label="Commander rank progress" value={nextXp ? careerXp - rankStart : 1} max={nextXp ? nextXp - rankStart : 1} />
            <span>{nextXp ? `${(nextXp - careerXp).toLocaleString('en-GB')} XP to rank ${rank + 1}` : 'Top commander rank reached'}</span>
          </div>
          <button className="btn btn--ghost" onClick={() => go('armoury')}>Visit Armoury</button>
        </section>
        <dl className="sr__totals">
          {totals.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <p className="sr__note">Battle totals count finished campaign and survival runs from this update. Existing mission clears and survival bests are kept. Online ratings live in Multiplayer.</p>
        <div className="sr__section-head"><h3>Recent battles</h3><span>Last 20 finished offline runs</span></div>
        {state.battleHistory.length === 0 ? <p className="sr__note">Finish a campaign battle or survival run to start your record.</p> : <ol className="sr__history">
          {state.battleHistory.slice(0, showAll ? 20 : 5).map((battle) => <li key={battle.id}>
            <div><strong>{battle.mode === 'survival' ? `The Long Watch · Wave ${battle.waves}` : LEVELS.find((l) => l.id === battle.levelId)?.name}</strong>
              <span>{new Date(battle.finishedAt).toLocaleDateString('en-GB')} · {DIFFICULTIES.find((d) => d.id === battle.difficulty)?.name} · {Math.floor(battle.seconds / 60)}:{String(Math.floor(battle.seconds % 60)).padStart(2, '0')}</span>
            </div>
            <span className="sr__outcome">{battle.mode === 'survival' ? 'Watch ended' : battle.won ? 'Victory' : 'Defeat'}</span>
            <span>{battle.kills} kills / {battle.losses} losses<br />+{battle.credits} credits · +{battle.xp} XP</span>
          </li>)}
        </ol>}
        {state.battleHistory.length > 5 && <button className="btn btn--ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show recent five' : 'Show all battles'}</button>}
        <div className="sr__section-head">
          <h3>Medal cabinet</h3>
          <span>Earned through play</span>
        </div>
        <ul className="sr__medals">
          {medals.map((medal) => (
            <li key={medal.id} className={`sr__medal${medal.earned ? ' sr__medal--earned' : ''}`}>
              <MedalDrawing mark={medal.mark} />
              <div>
                <h4>{medal.name}</h4>
                <p>{medal.note}</p>
                <span className="sr__medal-status">{medal.earned ? 'Earned' : `${medal.value} / ${medal.target}`}</span>
                <progress aria-label={`${medal.name} progress`} value={medal.value} max={medal.target} />
              </div>
            </li>
          ))}
        </ul>
        <div className="sr__links">
          <button className="btn btn--primary" onClick={() => go('missions')}>Choose a battle</button>
          <button className="btn btn--ghost" onClick={() => go('onboarding')}>Replay briefing</button>
          <button className="btn btn--ghost" onClick={() => go('settings')}>Back up save</button>
        </div>
      </div>
    </div>
  );
}
