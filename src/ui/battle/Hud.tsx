import { useEffect, useState } from 'react';
import { AGES } from '@/data/ages';
import type { LevelDef } from '@/data/types';
import { audio } from '@/game/audio/Audio';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { useGame } from '@/state/store';
import { GoldGlyph, XpGlyph } from '@/ui/components/Glyph';
import { BattleCoach } from './BattleCoach';
import { LaneStrip } from './LaneStrip';
import { PauseSheet } from './PauseSheet';
import { SpecialDial } from './SpecialDial';
import { TurretRack } from './TurretRack';
import { UnitBar } from './UnitBar';

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * DOM over canvas. The HUD is not drawn in Phaser on purpose: text and touch
 * targets are the two things the browser does better than a canvas, and keeping
 * them in the DOM means the HUD stays crisp on every DPI without a font atlas.
 *
 * The layout assumes landscape thumbs: purchases bottom-left, the special
 * bottom-right, everything informational along the top out of the way.
 */
export function Hud({ snapshot, level }: { snapshot: HudSnapshot; level: LevelDef }) {
  const showLaneStrip = useGame((s) => s.settings.showLaneStrip);
  const coachedMissions = useGame((s) => s.records);
  // Coaching only on the first mission, and only until it has been cleared once.
  const coach = level.id === 1 && !coachedMissions[1]?.cleared && !snapshot.survival;
  const [denied, setDenied] = useState(false);
  const [paused, setPaused] = useState(false);

  // Nudge the dock when a purchase is refused. This must NOT remount the dock:
  // keying it off a counter recreated every button on every refused tap, which
  // dropped the taps that came immediately after -- exactly when a player is
  // mashing a card they cannot afford yet.
  useEffect(
    () =>
      bridge.onReject(() => {
        audio.uiDeny();
        setDenied(true);
        window.setTimeout(() => setDenied(false), 180);
      }),
    [],
  );

  const age = AGES[snapshot.ageIndex];
  const nextAge = AGES[snapshot.ageIndex + 1];
  const capped = snapshot.ageIndex >= level.maxAge;
  const xpProgress =
    nextAge && snapshot.nextAgeXp
      ? Math.min(1, snapshot.xp / snapshot.nextAgeXp)
      : 1;

  const pause = (on: boolean) => {
    setPaused(on);
    bridge.send({ t: 'pause', on });
  };

  return (
    <div className="hud">
      <div className="hud__top">
        <button className="hud__pause" onClick={() => pause(true)} aria-label="Pause">
          <span className="hud__pause-bars" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>

        <div className="hud__res">
          <span className="hud__res-icon">
            <GoldGlyph size={14} />
          </span>
          <span className="num hud__gold">{snapshot.gold.toLocaleString('en-GB')}</span>
        </div>

        <div className="hud__age" style={{ '--accent': age.accent } as React.CSSProperties}>
          <div className="hud__age-line">
            <span className="label hud__age-name">{age.name.replace(' Age', '')}</span>
            <span className="num hud__age-i">
              {snapshot.ageIndex + 1}/{AGES.length}
            </span>
          </div>
          <div className="meter hud__xp">
            <div
              className="meter__fill meter__fill--xp"
              style={{ '--fill': xpProgress } as React.CSSProperties}
            />
          </div>
          <div className="hud__age-line">
            <span className="hud__res-icon">
              <XpGlyph size={11} />
            </span>
            <span className="num hud__xp-text">
              {snapshot.xp.toLocaleString('en-GB')}
              {snapshot.nextAgeXp != null && !capped && (
                <span className="hud__xp-goal">
                  /{snapshot.nextAgeXp.toLocaleString('en-GB')}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="hud__spacer" />

        <div className="hud__enemy">
          <div className="hud__age-line">
            <span className="label">Their gate</span>
            <span className="num">
              {Math.round((snapshot.enemyBaseHp / snapshot.enemyBaseMaxHp) * 100)}%
            </span>
          </div>
          <div className="meter">
            <div
              className="meter__fill meter__fill--enemy"
              style={
                { '--fill': snapshot.enemyBaseHp / snapshot.enemyBaseMaxHp } as React.CSSProperties
              }
            />
          </div>
          <div className="hud__age-line">
            <span className="label">
              {AGES[snapshot.enemyAgeIndex].name.replace(' Age', '')}
            </span>
            <span className="num hud__field">
              {snapshot.enemyFieldCount}v{snapshot.fieldCount}
            </span>
          </div>
        </div>

        {/*
          Counts down, not up. The clock is a real mechanic: at zero the mission
          is decided on gate integrity and then on ground held, so the player has
          to be able to see how long they have to break through.
        */}
        {snapshot.survival ? (
          <div
            className={`hud__clock${snapshot.waveCountdown <= 4 ? ' hud__clock--urgent' : ''}`}
          >
            <span className="num">WAVE {snapshot.wave}</span>
            <span className="label hud__esc">
              {snapshot.veterancy > 1.02 ? (
                <>
                  Veterancy <span className="num">&times;{snapshot.veterancy.toFixed(2)}</span>
                </>
              ) : (
                <>
                  Next in <span className="num">{Math.ceil(snapshot.waveCountdown)}s</span>
                </>
              )}
            </span>
          </div>
        ) : (
          <div className={`hud__clock${snapshot.timeLeft <= 30 ? ' hud__clock--urgent' : ''}`}>
            <span className="num">{mmss(snapshot.timeLeft)}</span>
            {snapshot.escalation > 1.02 ? (
              <span className="label hud__esc">
                Escalation <span className="num">&times;{snapshot.escalation.toFixed(1)}</span>
              </span>
            ) : (
              <span className="label">OP.{String(level.id).padStart(2, '0')}</span>
            )}
          </div>
        )}
      </div>

      {showLaneStrip && <LaneStrip snapshot={snapshot} />}

      {/* Your own structure, read against the gate it belongs to. */}
      <div className="hud__mine">
        <span className="label">Your gate</span>
        <div className="meter hud__mine-meter">
          <div
            className="meter__fill"
            style={{ '--fill': snapshot.baseHp / snapshot.baseMaxHp } as React.CSSProperties}
          />
        </div>
        <span className="num">{snapshot.baseHp.toLocaleString('en-GB')}</span>
      </div>

      <div className={`hud__dock${denied ? ' deny' : ''}`}>
        <UnitBar snapshot={snapshot} />

        <div className="hud__mid">
          <button
            className={`evolve${snapshot.canEvolve ? ' evolve--ready' : ''}`}
            disabled={!snapshot.canEvolve}
            onClick={() => bridge.send({ t: 'evolve' })}
            style={
              { '--accent': (nextAge ?? age).accent } as React.CSSProperties
            }
          >
            <span className="label evolve__kicker">
              {capped ? 'Age capped' : nextAge ? 'Evolve to' : 'Final age'}
            </span>
            <span className="evolve__name display display--caps">
              {capped || !nextAge ? age.name.replace(' Age', '') : nextAge.name.replace(' Age', '')}
            </span>
            <span className="num evolve__need">
              {snapshot.canEvolve
                ? 'Ready'
                : capped || !nextAge
                  ? '--'
                  : `${Math.max(0, snapshot.xpToNext ?? 0).toLocaleString('en-GB')} xp`}
            </span>
          </button>

          <TurretRack snapshot={snapshot} noTurrets={level.modifiers.includes('no-turrets')} />
        </div>

        <SpecialDial snapshot={snapshot} />
      </div>

      {coach && !paused && <BattleCoach snapshot={snapshot} />}

      {paused && <PauseSheet snapshot={snapshot} level={level} onResume={() => pause(false)} />}
    </div>
  );
}
