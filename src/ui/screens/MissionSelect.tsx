import { useState } from 'react';
import { AGES } from '@/data/ages';
import { DIFFICULTIES } from '@/data/difficulty';
import { LEVELS, MODIFIER_LABEL, MODIFIER_NOTE } from '@/data/levels';
import { isUnlocked, nextMission, useGame } from '@/state/store';

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * The campaign is a route up a valley, so it is drawn as one.
 *
 * It used to be a sortable table: a column of numbers, a column of names, a
 * column of tags, a deploy button on the right. That is the correct shape for a
 * dataset and the wrong one for a journey, and at twenty-four rows it was a
 * screen of scrolling admin. Nothing about it said the missions are *places*,
 * one after another, or that the campaign leaves the valley halfway through.
 *
 * Now the two acts are two legs of a survey line, missions are stations along
 * it, and picking one plates it above. Everything the table carried is still
 * here (best time, tiers cleared, modifiers) but it is attached to the station
 * you are looking at rather than tiled across every row at once.
 */
export function MissionSelect() {
  const { go, startMission, startSurvival } = useGame();
  const records = useGame((s) => s.records);
  const credits = useGame((s) => s.credits);
  const tier = useGame((s) => s.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const survivalBest = useGame((s) => s.survivalBest);
  const activeTier = DIFFICULTIES.find((d) => d.id === tier)!;

  // Opens on the next unplayed mission, which is where the player left off.
  const [selectedId, setSelectedId] = useState(() => nextMission(records));
  const selected = LEVELS.find((l) => l.id === selectedId) ?? LEVELS[0];
  const selectedRecord = records[selected.id];
  const selectedOpen = isUnlocked(selected.id, records);

  const legs = [
    { name: 'The valley', from: 0, to: 12 },
    { name: 'The road out', from: 12, to: 24 },
  ];

  return (
    <div className="ms field">
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
        {/* The plated station. Not a card in a grid: there is only ever one. */}
        <section className="ms__station bracket">
          <div className="ms__station-left">
            <h3 className="ms__station-name">
              <span className="num ms__station-op">
                {String(selected.id).padStart(2, '0')}
              </span>
              {selected.name}
            </h3>
            <p className="ms__station-brief">{selected.briefing}</p>
            <ul className="ms__mods">
              {selected.modifiers.length === 0 && <li className="tag">STANDARD RULES</li>}
              {selected.modifiers.map((m) => (
                <li className="tag tag--warn" key={m} title={MODIFIER_NOTE[m]}>
                  {MODIFIER_LABEL[m]}
                </li>
              ))}
            </ul>
          </div>

          <div className="ms__station-right">
            <dl className="ms__spec">
              <div>
                <dt className="label">Structure</dt>
                <dd className="num">{selected.baseHp.toLocaleString('en-GB')}</dd>
              </div>
              <div>
                <dt className="label">War chest</dt>
                <dd className="num">{selected.startGold}</dd>
              </div>
              <div>
                <dt className="label">Income</dt>
                <dd className="num">{selected.income}/s</dd>
              </div>
              <div>
                <dt className="label">Age cap</dt>
                <dd className="num">{AGES[Math.min(selected.maxAge, 4)].name.split(' ')[0]}</dd>
              </div>
            </dl>

            {/* The record for this station, where the table used to keep it. */}
            <div className="ms__record">
              <span className="label">Best</span>
              <span className="num ms__record-time">
                {selectedRecord?.bestTime != null ? mmss(selectedRecord.bestTime) : '--:--'}
              </span>
              <span className="ms__record-tiers" aria-label="Tiers cleared">
                {DIFFICULTIES.map((d) => (
                  <span
                    key={d.id}
                    title={d.name}
                    className={`ms__pip${
                      selectedRecord?.clearedTiers?.includes(d.id) ? ' ms__pip--on' : ''
                    }`}
                  />
                ))}
              </span>
            </div>

            <button
              className="btn btn--primary ms__deploy"
              disabled={!selectedOpen}
              onClick={() => startMission(selected.id)}
            >
              {selectedOpen ? (selectedRecord?.cleared ? 'Redeploy' : 'Deploy') : 'Not surveyed'}
            </button>
          </div>
        </section>

        {/* The route. Two legs, twelve stations each. */}
        <section className="route" aria-label="Campaign route">
          {legs.map((leg, legIndex) => (
            <div className="route__leg" key={leg.name}>
              <div className="route__leg-head">
                <span className="label">
                  Leg {legIndex === 0 ? 'one' : 'two'} &middot; {leg.name}
                </span>
                <span className="route__leg-rule" />
                <span className="chain">
                  OP {String(leg.from + 1).padStart(2, '0')}&ndash;
                  {String(leg.to).padStart(2, '0')}
                </span>
              </div>

              <ol className="route__line">
                <span className="route__rail" aria-hidden="true" />
                {LEVELS.slice(leg.from, leg.to).map((level) => {
                  const record = records[level.id];
                  const unlocked = isUnlocked(level.id, records);
                  const state = record?.cleared ? 'cleared' : unlocked ? 'open' : 'locked';
                  const here = level.id === selected.id;
                  return (
                    <li key={level.id} className="route__stop-cell">
                      <button
                        className={`route__stop route__stop--${state}${here ? ' is-here' : ''}`}
                        aria-current={here ? 'true' : undefined}
                        aria-label={`${level.name}, operation ${level.id}, ${state}`}
                        onClick={() => setSelectedId(level.id)}
                      >
                        <span className="route__mark" aria-hidden="true" />
                        <span className="num route__num">
                          {String(level.id).padStart(2, '0')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>

        {/* Tier applies to every deploy from this screen, so it sits with the
            route rather than inside the plated station. */}
        <section className="ms__tier">
          <div className="ms__tier-head">
            <span className="label">Difficulty</span>
            <span className="ms__tier-blurb">{activeTier.blurb}</span>
          </div>
          <div className="rail rail--tight ms__tier-row" role="radiogroup" aria-label="Difficulty">
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

        {/* Off the route: a standing position, not a station on the road. */}
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
      </div>
    </div>
  );
}
