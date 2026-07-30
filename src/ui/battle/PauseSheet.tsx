import { AGES } from '@/data/ages';
import { MODIFIER_LABEL, MODIFIER_NOTE } from '@/data/levels';
import type { LevelDef } from '@/data/types';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { useGame } from '@/state/store';

export function PauseSheet({
  snapshot,
  level,
  onResume,
}: {
  snapshot: HudSnapshot;
  level: LevelDef;
  onResume: () => void;
}) {
  const go = useGame((s) => s.go);
  const startMission = useGame((s) => s.startMission);

  return (
    <div className="pause">
      <div className="pause__sheet panel panel--raised">
        <div className="hazard-rule" />
        <header className="pause__head">
          <span className="num">OP.{String(level.id).padStart(2, '0')}</span>
          <h3 className="pause__title">{level.name}</h3>
          <span className="stamp">Held</span>
        </header>

        <p className="pause__brief">{level.briefing}</p>

        <dl className="pause__stats">
          <div>
            <dt className="stamp">Your age</dt>
            <dd className="num">{AGES[snapshot.ageIndex].name.replace(' Age', '')}</dd>
          </div>
          <div>
            <dt className="stamp">Their age</dt>
            <dd className="num">{AGES[snapshot.enemyAgeIndex].name.replace(' Age', '')}</dd>
          </div>
          <div>
            <dt className="stamp">Kills</dt>
            <dd className="num">{snapshot.stats.player.kills}</dd>
          </div>
          <div>
            <dt className="stamp">Losses</dt>
            <dd className="num">{snapshot.stats.player.losses}</dd>
          </div>
        </dl>

        {level.modifiers.length > 0 && (
          <ul className="pause__mods">
            {level.modifiers.map((m) => (
              <li key={m}>
                <span className="tag tag--warn">{MODIFIER_LABEL[m]}</span>
                <span className="pause__mod-note">{MODIFIER_NOTE[m]}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="pause__speed">
          <span className="stamp">Speed</span>
          {([1, 1.5, 2] as const).map((factor) => (
            <button
              key={factor}
              className="btn btn--ghost pause__speed-btn"
              onClick={() => bridge.send({ t: 'speed', factor })}
            >
              <span className="num">{factor}&times;</span>
            </button>
          ))}
        </div>

        <div className="pause__actions">
          <button className="btn btn--primary" onClick={onResume}>
            Resume
          </button>
          <button className="btn btn--ghost" onClick={() => startMission(level.id)}>
            Restart
          </button>
          <button className="btn btn--danger" onClick={() => go('missions')}>
            Abandon
          </button>
        </div>
      </div>
    </div>
  );
}
