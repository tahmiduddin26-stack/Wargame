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
          <p className="stamp">Valley grid 47-K &middot; Field command terminal</p>
          <h1 className="menu__title">
            Age of<br />War
          </h1>
          <div className="menu__underline" />
          <p className="menu__blurb">
            One lane. Two gates. Five ages between a sharpened rock and an orbital lance.
          </p>

          <dl className="menu__readout">
            <div>
              <dt className="stamp">Ops cleared</dt>
              <dd className="num">
                {String(cleared).padStart(2, '0')}
                <span className="menu__of">/{LEVELS.length}</span>
              </dd>
            </div>
            <div>
              <dt className="stamp">Credits</dt>
              <dd className="num">{credits.toLocaleString('en-GB')}</dd>
            </div>
            <div>
              <dt className="stamp">Build</dt>
              <dd className="num">{BUILD}</dd>
            </div>
          </dl>
        </header>

        <nav className="menu__actions">
          {/* Featured row. Deliberately not one of three equal cards. */}
          <button className="menu__deploy" onClick={deploy}>
            <span className="menu__deploy-head">
              <span className="stamp">{fresh ? 'Begin campaign' : 'Resume campaign'}</span>
              <span className="num menu__deploy-op">
                OP.{String(next.id).padStart(2, '0')}
              </span>
            </span>
            <span className="menu__deploy-name display">{next.name}</span>
            <span className="menu__deploy-brief">{next.briefing}</span>
            <span className="menu__deploy-go display">
              {onboardingDone ? 'Deploy' : 'Run briefing'}
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

      <footer className="menu__foot">
        <span className="stamp">Landscape only. Rotate to play.</span>
        <span className="stamp">Placeholder art. Ragdolls are real.</span>
      </footer>
    </div>
  );
}
