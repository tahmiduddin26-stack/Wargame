import { useEffect, useState } from 'react';
import { AGES } from '@/data/ages';
import type { LevelDef } from '@/data/types';
import { audio } from '@/game/audio/Audio';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { useGame } from '@/state/store';
import { GoldGlyph } from '@/ui/components/Glyph';
import { useChangeFlash, useJustChanged, useTweenedNumber } from '@/ui/useMotion';
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
 * SEVEN CHROME ELEMENTS BECAME FOUR.
 *
 * Pause, gold, your age, their gate, the clock, the lane strip and your gate
 * meter each had their own bordered box strung along the top, which is seven
 * things to find and seven edges to read before you learn where anything is.
 * They collapse into two plates that answer the only two questions a lane war
 * asks -- how am I doing, how are they doing -- plus the lane strip and the
 * dock:
 *
 *   yours    pause, gold and its rate, your age and experience, your gate
 *   theirs   the clock, their gate, their age, who is on the field
 *   lane     the overview strip (optional, per setting)
 *   dock     everything you press
 *
 * CORNERS, NOT THE CENTRE. Held in landscape the hands wrap the short edges, so
 * the bottom corners are the easy zone and the bottom middle is the worst place
 * on the screen. Purchases sit bottom-left, the special bottom-right, and the
 * emplacements that used to occupy permanent dock space in the middle are now a
 * chip that opens a tray.
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

  // Gold arrives in lumps from loot and leaves in lumps on purchase, so the
  // figure eases rather than snapping and tints for a moment in the direction
  // it moved.
  const gold = useTweenedNumber(snapshot.gold);
  const goldDir = useChangeFlash(snapshot.gold);

  // The focal moment. Every piece of the evolve sequence hangs off this.
  const eraChanged = useJustChanged(snapshot.ageIndex, 700);

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
        {/* YOURS. Everything about your side, in reading order. */}
        <div
          className={`hud__side hud__yours plate${eraChanged ? ' hud__yours--changed' : ''}`}
          style={{ '--accent': age.accent } as React.CSSProperties}
        >
          <div className="hud__row hud__row--head">
            <button className="hud__pause" onClick={() => pause(true)} aria-label="Pause">
              <span className="hud__pause-bars" aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
            <span className="hud__res-icon">
              <GoldGlyph size={14} />
            </span>
            <span className={`hud__gold${goldDir ? ` tick--${goldDir}` : ''}`}>
              {Math.round(gold).toLocaleString('en-GB')}
            </span>
            {/* The rate, as a rate. */}
            <span className="num hud__rate">+{snapshot.income.toFixed(0)}/s</span>
          </div>

          <div className="hud__row">
            <span className="label hud__age-name">{age.name.replace(' Age', '')}</span>
            <span className="num hud__age-i">
              {snapshot.ageIndex + 1}/{AGES.length}
            </span>
            <div className="meter hud__xp">
              <div
                className="meter__fill meter__fill--xp"
                style={{ '--fill': xpProgress } as React.CSSProperties}
              />
            </div>
            <span className="num hud__xp-text">
              {capped || snapshot.nextAgeXp == null
                ? 'capped'
                : `${Math.max(0, snapshot.xpToNext ?? 0).toLocaleString('en-GB')} xp`}
            </span>
          </div>

          <div className="hud__row">
            <span className="label">Your gate</span>
            <span className="num hud__pct">
              {Math.round((snapshot.baseHp / snapshot.baseMaxHp) * 100)}%
            </span>
            <div className="meter hud__gate-meter">
              <div
                className="meter__ghost"
                style={{ '--fill': snapshot.baseHp / snapshot.baseMaxHp } as React.CSSProperties}
              />
              <div
                className="meter__fill"
                style={{ '--fill': snapshot.baseHp / snapshot.baseMaxHp } as React.CSSProperties}
              />
            </div>
            <span className="num hud__hp">{snapshot.baseHp.toLocaleString('en-GB')}</span>
          </div>
        </div>

        <div className="hud__spacer" />

        {/* THEIRS. The clock leads, because it is the thing that runs out. */}
        <div className="hud__side hud__theirs plate">
          <div
            className={`hud__row hud__row--head${
              (snapshot.survival ? snapshot.waveCountdown <= 4 : snapshot.timeLeft <= 30)
                ? ' hud__row--urgent'
                : ''
            }`}
          >
            {snapshot.survival ? (
              <>
                <span className="num hud__clock-fig">WAVE {snapshot.wave}</span>
                <span className="label hud__esc">
                  {snapshot.veterancy > 1.02 ? (
                    <>
                      Vet <span className="num">&times;{snapshot.veterancy.toFixed(2)}</span>
                    </>
                  ) : (
                    <>
                      Next <span className="num">{Math.ceil(snapshot.waveCountdown)}s</span>
                    </>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="num hud__clock-fig">{mmss(snapshot.timeLeft)}</span>
                <span className="label hud__esc">OP.{String(level.id).padStart(2, '0')}</span>
              </>
            )}
          </div>

          <div className="hud__row">
            <span className="label">Their gate</span>
            <span className="num hud__pct">
              {Math.round((snapshot.enemyBaseHp / snapshot.enemyBaseMaxHp) * 100)}%
            </span>
            <div className="meter hud__gate-meter">
              <div
                className="meter__ghost"
                style={
                  { '--fill': snapshot.enemyBaseHp / snapshot.enemyBaseMaxHp } as React.CSSProperties
                }
              />
              <div
                className="meter__fill meter__fill--enemy"
                style={
                  { '--fill': snapshot.enemyBaseHp / snapshot.enemyBaseMaxHp } as React.CSSProperties
                }
              />
            </div>
            <span className="num hud__hp">
              {Math.round(snapshot.enemyBaseHp).toLocaleString('en-GB')}
            </span>
          </div>

          <div className="hud__row">
            <span className="label hud__age-name">
              {AGES[snapshot.enemyAgeIndex].name.replace(' Age', '')}
            </span>
            <span className="hud__spacer" />
            <span className="num hud__field">
              {snapshot.enemyFieldCount}v{snapshot.fieldCount} on field
            </span>
          </div>
        </div>
      </div>

      {showLaneStrip && <LaneStrip snapshot={snapshot} />}

      <div className={`hud__dock${denied ? ' deny' : ''}`}>
        {/* Focal: a light sweep crosses the dock as the era turns over. */}
        {eraChanged && (
          <span
            className="era-sweep"
            style={{ '--accent': age.accent } as React.CSSProperties}
            aria-hidden="true"
          />
        )}
        <UnitBar snapshot={snapshot} eraChanged={eraChanged} />

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

          <TurretRack snapshot={snapshot} />
        </div>

        <SpecialDial snapshot={snapshot} />
      </div>

      {coach && !paused && <BattleCoach snapshot={snapshot} />}

      {paused && <PauseSheet snapshot={snapshot} level={level} onResume={() => pause(false)} />}
    </div>
  );
}
