import { LEVELS } from '@/data/levels';
import { levelById } from '@/data/levels';
import { nextMission, useGame } from '@/state/store';

const BUILD = '0.1.0';

export function MainMenu() {
  const { go, startMission } = useGame();
  const records = useGame((s) => s.records);
  const credits = useGame((s) => s.credits);
  const onboardingDone = useGame((s) => s.onboardingDone);

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
          <p className="menu__blurb">
            One lane. Two gates. Five ages between a sharpened rock and an orbital lance.
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
              <dt className="label">Build</dt>
              <dd className="num">{BUILD}</dd>
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
            <button className="btn btn--ghost" onClick={() => go('settings')}>
              Settings
            </button>
            <button className="btn btn--ghost" onClick={() => go('onboarding')}>
              Briefing
            </button>
          </div>
        </nav>
      </div>

      {/* Plate stamps. Kept to two or three words each: uppercase is for short
          labels, and a 40-character tracked-caps line is a slog to read. */}
      <footer className="menu__foot">
        <span className="label">Grid 47-K</span>
        <span className="label">Field command</span>
        <span className="menu__foot-spacer" />
        <span className="label">Placeholder art</span>
      </footer>
    </div>
  );
}
