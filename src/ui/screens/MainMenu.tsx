import { LEVELS } from '@/data/levels';
import { levelById } from '@/data/levels';
import { nextMission, useGame } from '@/state/store';
import { commanderRank } from '@/data/career';
import { useAvailability } from '@/state/appAvailability';

export function MainMenu() {
  const { go, startMission } = useGame();
  const survivalBest = useGame((s) => s.survivalBest);
  const records = useGame((s) => s.records);
  const credits = useGame((s) => s.credits);
  const careerXp = useGame((s) => s.careerXp);
  const onboardingDone = useGame((s) => s.onboardingDone);
  const app = useAvailability();

  const cleared = LEVELS.filter((l) => records[l.id]?.cleared).length;
  const nextId = nextMission(records);
  const next = levelById(nextId);
  const fresh = cleared === 0;

  const deploy = () => {
    if (!onboardingDone) go('onboarding');
    else startMission(nextId);
  };

  return (
    <div className="menu">
      <div className="hazard-rule" />

      <div className="menu__grid">
        <header className="menu__brand">
          {/* No kicker above the title. The identifier lives in the footer,
              where it reads as a plate stamp instead of an eyebrow. */}
          <h1 className="menu__title display--caps">
            Age of<br />War
          </h1>
          <div className="menu__underline" />
          <svg className="menu__doodle" viewBox="0 0 300 82" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 70q37-7 72 0t75-1 75 0 72-1" strokeDasharray="5 7" />
              <path d="M48 55l-4-18 5-10 10 2 4 8-5 18M50 55l-9 13m17-13 8 13M44 40l-16 8m35-8 21-10" />
              <circle cx="53" cy="20" r="8" />
              <path d="M40 12l12-7 12 7M203 53l-4-18 7-7 9 4 3 9-6 13m-8-1-12 14m20-14 11 14m-23-26-16-5m32 1 19 4" />
              <circle cx="208" cy="20" r="8" />
              <path d="M189 35l-5 20 17 2 2-17zM83 29l31 5m-3-4 7 5-9 3M231 38l-18-5" />
              <path d="M143 20l2-8m-2 8-7-5m7 5 7-6m-7 6-4 8m4-8 5 8" />
              <path d="M258 22q8-12 21 0m-20 5q9-7 20 0" strokeWidth="1.5" />
            </g>
            <path d="M43 10l20 2-5 7-14-2z" fill="var(--sun)" stroke="currentColor" strokeWidth="2" />
            <path d="M190 35l-5 20 17 2 2-17z" fill="var(--sky)" stroke="currentColor" strokeWidth="2" />
          </svg>
          <p className="menu__blurb">
            One lane. Two forts. Five ages of gloriously messy mayhem.
          </p>

          <dl className="menu__readout">
            <div>
              <dt className="label">Ops cleared</dt>
              <dd className="num">
                {String(cleared).padStart(2, '0')}
                <span className="menu__of">/{LEVELS.length}</span>
              </dd>
            </div>
            <div>
              <dt className="label">Credits</dt>
              <dd className="num">{credits.toLocaleString('en-GB')}</dd>
            </div>
            <div>
              <dt className="label">Best watch</dt>
              <dd className="num">
                {survivalBest > 0 ? survivalBest : '--'}
                <span className="menu__of"> waves</span>
              </dd>
            </div>
            <div>
              <dt className="label">Rank</dt>
              <dd className="num">{commanderRank(careerXp)}</dd>
            </div>
          </dl>
        </header>

        <nav className="menu__actions">
          {/* Featured row. Deliberately not one of three equal cards. */}
          <button className="menu__deploy bracket" onClick={deploy}>
            {/* The op number rides inline with the name it identifies. */}
            <span className="menu__deploy-name display">
              <span className="num menu__deploy-op">
                {String(next.id).padStart(2, '0')}
              </span>
              {next.name}
            </span>
            <span className="menu__deploy-brief">{next.briefing}</span>
            <span className="menu__deploy-go display">
              {fresh ? 'Begin campaign' : 'Resume campaign'}
              <span className="menu__deploy-arrow" aria-hidden="true" />
            </span>
          </button>

          <div className="menu__row">
            <button className="btn btn--ghost" onClick={() => go('missions')}>
              Missions
            </button>
            <button className="btn btn--ghost" onClick={() => go('codex')}>
              Roster
            </button>
          </div>
          <div className="menu__row">
            <button className="btn btn--ghost" onClick={() => go('armoury')}>
              Armoury
            </button>
            <button className="btn btn--ghost" onClick={() => go('online')}>
              Multiplayer
            </button>
          </div>
          <div className="menu__row">
            <button className="btn btn--ghost" onClick={() => go('settings')}>
              Settings
            </button>
            <button className="btn btn--ghost" onClick={() => go('service-record')}>
              Service record
            </button>
          </div>
        </nav>
      </div>

      {/* Plate stamps. Kept to two or three words each: uppercase is for short
          labels, and a 40-character tracked-caps line is a slog to read. */}
      <footer className="menu__foot">
        <span className="label">Doodlebook battles</span>
        <span className="label">Ink, arrows &amp; explosions</span>
        <span className="menu__foot-spacer" />
        <span className="label">{app.updateReady ? 'Update ready in Settings' : app.offline === 'ready' ? 'Offline ready' : 'Drawn for trouble'}</span>
      </footer>
    </div>
  );
}
