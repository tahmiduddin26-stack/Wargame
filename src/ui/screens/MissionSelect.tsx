import { AGES } from '@/data/ages';
import { DIFFICULTIES } from '@/data/difficulty';
import { LEVELS, MODIFIER_LABEL, MODIFIER_NOTE } from '@/data/levels';
import { isUnlocked, nextMission, useGame } from '@/state/store';

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MissionSelect() {
  const { go, startMission, startSurvival } = useGame();
  const records = useGame((s) => s.records);
  const credits = useGame((s) => s.credits);
  const tier = useGame((s) => s.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const survivalBest = useGame((s) => s.survivalBest);
  const activeTier = DIFFICULTIES.find((d) => d.id === tier)!;

  const featuredId = nextMission(records);
  const featured = LEVELS.find((l) => l.id === featuredId)!;

  return (
    <div className="ms">
      <header className="ms__head">
        <button className="btn btn--ghost ms__back" onClick={() => go('menu')}>
          Back
        </button>
        <h2 className="ms__title">Campaign</h2>
        <span className="label ms__credits">
          Credits <span className="num">{credits.toLocaleString('en-GB')}</span>
        </span>
      </header>
      <div className="hazard-rule" />

      <div className="ms__body scroll-y">
        {/* Featured op. One full-width row, not a card in a grid. */}
        <section className="ms__featured bracket">
          <div className="ms__featured-left">
            <h3 className="ms__featured-name">
              <span className="num ms__featured-op">
                {String(featured.id).padStart(2, '0')}
              </span>
              {featured.name}
            </h3>
            <p className="ms__featured-brief">{featured.briefing}</p>
            <ul className="ms__mods">
              {featured.modifiers.length === 0 && (
                <li className="tag">STANDARD RULES</li>
              )}
              {featured.modifiers.map((m) => (
                <li className="tag tag--warn" key={m} title={MODIFIER_NOTE[m]}>
                  {MODIFIER_LABEL[m]}
                </li>
              ))}
            </ul>
          </div>
          <div className="ms__featured-right">
            <dl className="ms__spec">
              <div>
                <dt className="label">Structure</dt>
                <dd className="num">{featured.baseHp.toLocaleString('en-GB')}</dd>
              </div>
              <div>
                <dt className="label">War chest</dt>
                <dd className="num">{featured.startGold}</dd>
              </div>
              <div>
                <dt className="label">Income</dt>
                <dd className="num">{featured.income}/s</dd>
              </div>
              <div>
                <dt className="label">Age cap</dt>
                <dd className="num">{AGES[Math.min(featured.maxAge, 4)].name.split(' ')[0]}</dd>
              </div>
            </dl>
            <button className="btn btn--primary ms__deploy" onClick={() => startMission(featured.id)}>
              Deploy
            </button>
          </div>
        </section>

        {/* Tier applies to every deploy from this screen, so it sits above the
            list rather than inside the featured card. */}
        <section className="ms__tier">
          <div className="ms__tier-head">
            <span className="label">Difficulty</span>
            <span className="ms__tier-blurb">{activeTier.blurb}</span>
          </div>
          <div
            className="rail rail--tight ms__tier-row"
            role="radiogroup"
            aria-label="Difficulty"
          >
            <span className="rail__track" aria-hidden="true" />
            {DIFFICULTIES.map((d, i) => (
              <button
                key={d.id}
                role="radio"
                aria-checked={d.id === tier}
                className={`rail__stop${d.id === tier ? ' rail__stop--on' : ''}`}
                onClick={() => setDifficulty(d.id)}
              >
                <span className="rail__detent" aria-hidden="true" />
                <span className="num rail__index">{i + 1}</span>
                <span className="rail__name">{d.name}</span>
                <span className="num rail__note">&times;{d.reward}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="ms__survival">
          <div className="ms__survival-text">
            <h3 className="ms__survival-name">The Long Watch</h3>
            <p className="ms__survival-brief">
              Endless authored waves on one field. No clock, no relief, and a credit for every wave
              you hold.
            </p>
          </div>
          <div className="ms__survival-score">
            <span className="label">Best</span>
            <span className="num">
              {survivalBest > 0 ? survivalBest : '--'}
              <span className="ms__survival-unit"> waves</span>
            </span>
          </div>
          <button className="btn ms__survival-go" onClick={startSurvival}>
            Stand watch
          </button>
        </section>

        <div className="ms__list-head">
          <span className="label">All operations</span>
          <div className="rule ms__list-rule" />
        </div>

        <ol className="ms__list">
          {LEVELS.map((level) => {
            const record = records[level.id];
            const unlocked = isUnlocked(level.id, records);
            const state = record?.cleared ? 'cleared' : unlocked ? 'open' : 'locked';
            return (
              <li key={level.id} className={`ms__row ms__row--${state}`}>
                <span className="num ms__row-num">{String(level.id).padStart(2, '0')}</span>
                <span className="ms__row-name display">{level.name}</span>
                <span className="ms__row-mods">
                  {/* Three, not two: OP 23 carries three and the one that was
                      being dropped was the one that decides how you open. */}
                  {level.modifiers.slice(0, 3).map((m) => (
                    <span className="tag" key={m}>
                      {MODIFIER_LABEL[m]}
                    </span>
                  ))}
                </span>
                <span className="num ms__row-time">
                  {record?.bestTime != null ? mmss(record.bestTime) : '--:--'}
                </span>
                <span className="ms__row-tiers" aria-label="Tiers cleared">
                  {DIFFICULTIES.map((d) => (
                    <span
                      key={d.id}
                      title={d.name}
                      className={`ms__pip${record?.clearedTiers?.includes(d.id) ? ' ms__pip--on' : ''}`}
                    />
                  ))}
                </span>
                <span className="label ms__row-state">
                  {state === 'cleared' ? 'Cleared' : state === 'open' ? 'Open' : 'Locked'}
                </span>
                <button
                  className="btn ms__row-go"
                  disabled={!unlocked}
                  onClick={() => startMission(level.id)}
                >
                  {record?.cleared ? 'Replay' : 'Start'}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
