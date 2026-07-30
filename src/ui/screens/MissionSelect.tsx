import { AGES } from '@/data/ages';
import { LEVELS, MODIFIER_LABEL, MODIFIER_NOTE } from '@/data/levels';
import { isUnlocked, nextMission, useGame } from '@/state/store';

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MissionSelect() {
  const { go, startMission } = useGame();
  const records = useGame((s) => s.records);
  const credits = useGame((s) => s.credits);

  const featuredId = nextMission(records);
  const featured = LEVELS.find((l) => l.id === featuredId)!;

  return (
    <div className="ms">
      <header className="ms__head">
        <button className="btn btn--ghost ms__back" onClick={() => go('menu')}>
          Back
        </button>
        <h2 className="ms__title">Campaign</h2>
        <span className="stamp ms__credits">
          Credits <span className="num">{credits.toLocaleString('en-GB')}</span>
        </span>
      </header>
      <div className="hazard-rule" />

      <div className="ms__body scroll-y">
        {/* Featured op. One full-width row, not a card in a grid. */}
        <section className="ms__featured">
          <div className="ms__featured-left">
            <span className="num ms__featured-op">
              OP.{String(featured.id).padStart(2, '0')}
            </span>
            <h3 className="ms__featured-name">{featured.name}</h3>
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
                <dt className="stamp">Structure</dt>
                <dd className="num">{featured.baseHp.toLocaleString('en-GB')}</dd>
              </div>
              <div>
                <dt className="stamp">War chest</dt>
                <dd className="num">{featured.startGold}</dd>
              </div>
              <div>
                <dt className="stamp">Income</dt>
                <dd className="num">{featured.income}/s</dd>
              </div>
              <div>
                <dt className="stamp">Age cap</dt>
                <dd className="num">{AGES[Math.min(featured.maxAge, 4)].name.split(' ')[0]}</dd>
              </div>
            </dl>
            <button className="btn btn--primary ms__deploy" onClick={() => startMission(featured.id)}>
              Deploy
            </button>
          </div>
        </section>

        <div className="ms__list-head">
          <span className="stamp">All operations</span>
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
                  {level.modifiers.slice(0, 2).map((m) => (
                    <span className="tag" key={m}>
                      {MODIFIER_LABEL[m]}
                    </span>
                  ))}
                </span>
                <span className="num ms__row-time">
                  {record?.bestTime != null ? mmss(record.bestTime) : '--:--'}
                </span>
                <span className="ms__row-state stamp">
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
