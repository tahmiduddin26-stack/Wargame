import { AGES } from '@/data/ages';
import { LEVELS, levelById } from '@/data/levels';
import { isUnlocked, useGame, type DebriefData } from '@/state/store';

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * A match can end three ways, and the debrief should say which: a gate actually
 * fell, or the clock ran out and it went on remaining structure, or on how far
 * the front line had been pushed. Reporting "you won" without saying it was a
 * timed decision would be misleading.
 */
function verdictLine(debrief: DebriefData, name: string): string {
  const bonus = debrief.firstClear ? 'First clear bonus paid.' : 'Replay bonus paid.';
  if (debrief.decidedBy === 'gate') {
    return debrief.won
      ? `Their gate is rubble. ${name} is yours. ${bonus}`
      : `${name} stands. Their commander walked through your gate.`;
  }
  const basis = debrief.decidedBy === 'structure' ? 'remaining structure' : 'ground held';
  return debrief.won
    ? `Clock out. Decided on ${basis} in your favour. ${bonus}`
    : `Clock out. Decided on ${basis}, and theirs was better.`;
}

export function Debrief() {
  const debrief = useGame((s) => s.debrief);
  const records = useGame((s) => s.records);
  const { startMission, closeDebrief } = useGame();

  if (!debrief) {
    closeDebrief();
    return null;
  }

  const level = levelById(debrief.levelId);
  const nextLevel = LEVELS.find((l) => l.id === debrief.levelId + 1);
  const nextOpen = nextLevel ? isUnlocked(nextLevel.id, records) : false;

  return (
    <div className={`db db--${debrief.won ? 'win' : 'loss'}`}>
      <div className="hazard-rule" />
      <div className="db__inner">
        <header className="db__head">
          <span className="num db__op">OP.{String(level.id).padStart(2, '0')}</span>
          <h2 className="db__verdict">{debrief.won ? 'Valley held' : 'Gate lost'}</h2>
          <p className="db__sub">{verdictLine(debrief, level.name)}</p>
        </header>

        <dl className="db__stats">
          <div>
            <dt className="stamp">Duration</dt>
            <dd className="num">{mmss(debrief.seconds)}</dd>
          </div>
          <div>
            <dt className="stamp">Kills</dt>
            <dd className="num">{debrief.kills}</dd>
          </div>
          <div>
            <dt className="stamp">Losses</dt>
            <dd className="num">{debrief.losses}</dd>
          </div>
          <div>
            <dt className="stamp">Gold spent</dt>
            <dd className="num">{debrief.goldSpent.toLocaleString('en-GB')}</dd>
          </div>
          <div>
            <dt className="stamp">Final age</dt>
            <dd className="num">
              {debrief.peakAge + 1}
              <span className="db__of">/{AGES.length}</span>
            </dd>
          </div>
          <div className="db__stat--reward">
            <dt className="stamp">Credits</dt>
            <dd className="num">{debrief.reward > 0 ? `+${debrief.reward}` : '0'}</dd>
          </div>
        </dl>

        <div className="db__actions">
          <button className="btn btn--ghost" onClick={closeDebrief}>
            Campaign
          </button>
          <button className="btn btn--ghost" onClick={() => startMission(level.id)}>
            Replay
          </button>
          {debrief.won && nextLevel && nextOpen && (
            <button className="btn btn--primary" onClick={() => startMission(nextLevel.id)}>
              OP.{String(nextLevel.id).padStart(2, '0')} {nextLevel.name}
            </button>
          )}
          {debrief.won && !nextLevel && (
            <span className="tag">CAMPAIGN COMPLETE</span>
          )}
        </div>
      </div>
    </div>
  );
}
