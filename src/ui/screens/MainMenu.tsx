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
   * Destinations as a numbered index, not a grid of buttons.
   *
   * Six identical bordered rectangles in a 2x3 grid is the single most
   * generated-looking arrangement in interface design, and it was also a lie
   * about the content: these six are not peers. The campaign is the game and
   * the rest are places you visit between missions, so the index is ranked and
   * the plate above it carries the only thing you are likely to want.
   */
  const index = [
    { n: 1, name: 'Missions', note: 'Pick the op', go: () => go('missions') },
    { n: 2, name: 'Roster', note: 'Units, counters, armour', go: () => go('codex') },
    { n: 3, name: 'Armoury', note: 'Spend the credits', go: () => go('armoury') },
    { n: 4, name: 'Survival', note: 'The Long Watch', go: startSurvival },
    { n: 5, name: 'Briefing', note: 'How the valley works', go: () => go('onboarding') },
    { n: 6, name: 'Settings', note: 'Speed, sound, finish', go: () => go('settings') },
  ];

  return (
    <div className="menu field">
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
          {/* The only thing most sessions need, plated and bracketed. */}
          <button className="menu__deploy bracket" onClick={deploy}>
            {/* The op number rides inline with the name it identifies. */}
            <span className="menu__deploy-name display">
              <span className="num menu__index-op">
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

          <ol className="menu__index">
            {index.map((item) => (
              <li key={item.name}>
                <button className="menu__index-row" onClick={item.go}>
                  <span className="num menu__index-n">{String(item.n).padStart(2, '0')}</span>
                  <span className="menu__index-name display">{item.name}</span>
                  <span className="menu__index-note">{item.note}</span>
                </button>
              </li>
            ))}
          </ol>
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
