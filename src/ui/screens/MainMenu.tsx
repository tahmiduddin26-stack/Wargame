import { LEVELS } from '@/data/levels';
import { levelById } from '@/data/levels';
import { nextMission, useGame } from '@/state/store';

const BUILD = '0.1.0';

export function MainMenu() {
  const { go, startMission, startSurvival } = useGame();
  const survivalBest = useGame((s) => s.survivalBest);
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

  /*
   * Six equal ghost buttons became one brass key carrying the actual next
   * operation, plus a tile row for the rest. The key is the only thing most
   * sessions need to press, and making it the only brass object on the screen
   * says so without a word of copy.
   */
  const tiles = [
    { name: 'Missions', go: () => go('missions') },
    { name: 'Roster', go: () => go('codex') },
    { name: 'Armoury', go: () => go('armoury') },
    { name: 'Survival', go: startSurvival, mode: true },
    { name: 'Briefing', go: () => go('onboarding') },
    { name: 'Settings', go: () => go('settings') },
  ];

  return (
    <div className="menu field">
      <div className="hazard-rule" />

      <div className="menu__grid">
        <header className="menu__brand">
          {/* No kicker above the title. The identifier lives in the footer,
              where it reads as a plate stamp instead of an eyebrow. */}
          <h1 className="menu__title heavy">
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
              <dt className="label">Best watch</dt>
              <dd className="num">
                {survivalBest > 0 ? survivalBest : '--'}
                <span className="menu__of"> waves</span>
              </dd>
            </div>
            <div>
              <dt className="label">Build</dt>
              <dd className="num">{BUILD}</dd>
            </div>
          </dl>
        </header>

        <nav className="menu__actions">
          {/*
           * Progress as a strip of pips above the key: cleared, next, locked.
           * It answers "how far am I" and "what now" in one glance, which two
           * lines of copy were doing badly.
           */}
          <div className="menu__progress">
            <span className="label">Campaign</span>
            <span className="num menu__progress-count">
              {String(cleared).padStart(2, '0')} / {LEVELS.length} cleared
            </span>
          </div>
          <ol className="menu__pips" aria-hidden="true">
            {LEVELS.map((l) => {
              const done = !!records[l.id]?.cleared;
              const here = l.id === nextId;
              return (
                <li
                  key={l.id}
                  className={`menu__pip${done ? ' menu__pip--done' : here ? ' menu__pip--next' : ''}`}
                />
              );
            })}
          </ol>

          <button className="menu__key key" onClick={deploy}>
            <span className="menu__key-op num">{String(next.id).padStart(2, '0')}</span>
            <span className="menu__key-text">
              <span className="menu__key-name">{next.name}</span>
              <span className="menu__key-brief">{next.briefing}</span>
            </span>
            <span className="menu__key-go">{fresh ? 'Begin' : 'Resume'}</span>
          </button>

          <div className="menu__tiles">
            {tiles.map((t) => (
              <button
                key={t.name}
                className={`menu__tile plate${t.mode ? ' menu__tile--mode' : ''}`}
                onClick={t.go}
              >
                {t.name}
              </button>
            ))}
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
