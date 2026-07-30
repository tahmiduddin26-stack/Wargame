import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { difficulty } from '@/data/difficulty';
import { levelById } from '@/data/levels';
import { resolvePerks } from '@/data/perks';
import { audio } from '@/game/audio/Audio';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { RAGDOLL } from '@/game/config';
import { BattleScene, battleGameConfig } from '@/game/scenes/BattleScene';
import { useGame } from '@/state/store';
import { Hud } from './Hud';

export function BattleView() {
  const levelId = useGame((s) => s.activeLevel);
  const settings = useGame((s) => s.settings);
  const finishMission = useGame((s) => s.finishMission);
  const recordSurvival = useGame((s) => s.recordSurvival);
  const tierId = useGame((s) => s.difficulty);
  const perks = useGame((s) => s.perks);
  const survival = useGame((s) => s.survivalRun);
  const go = useGame((s) => s.go);
  const level = levelById(levelId);

  const hostRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<HudSnapshot | null>(null);
  const reported = useRef(false);

  // One Phaser instance per mission. Remounting on level change is deliberate:
  // a fresh Matter world is cheaper and safer than resetting one in place.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    bridge.reset();
    reported.current = false;

    audio.setSfx(settings.sfx);
    audio.setMusic(settings.music);

    const game = new Phaser.Game(battleGameConfig(host));
    game.scene.add(
      'battle',
      BattleScene,
      true,
      {
        level,
        survival,
        difficulty: tierId,
        perks: resolvePerks(perks),
        seed: 1337 + level.id * 977,
        corpseCap: settings.reducedCorpses ? Math.floor(RAGDOLL.maxActive / 2) : RAGDOLL.maxActive,
        speed: settings.speed,
      },
    );

    return () => {
      game.destroy(true);
      bridge.reset();
    };
    // Settings are read once at deploy; changing them mid-match would be worse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id, survival]);

  useEffect(() => bridge.onSnapshot(setSnapshot), []);

  useEffect(() => {
    if (!settings.haptics) return;
    return bridge.onReject(() => navigator.vibrate?.(35));
  }, [settings.haptics]);

  // Hand the result to the store exactly once; that swaps in the debrief screen.
  useEffect(() => {
    if (!snapshot?.over || reported.current) return;
    reported.current = true;

    // Survival has no win condition, only how long you lasted.
    if (snapshot.survival) {
      recordSurvival(snapshot.wave);
      go('missions');
      return;
    }

    const mine = snapshot.stats.player;
    finishMission({
      levelId: level.id,
      won: snapshot.over === 'player',
      decidedBy: snapshot.decidedBy,
      tierReward: difficulty(tierId).reward,
      seconds: snapshot.elapsed,
      kills: mine.kills,
      losses: mine.losses,
      goldSpent: mine.goldSpent,
      peakAge: mine.peakAge,
    });
  }, [snapshot?.over, snapshot, level.id, finishMission, recordSurvival, go, tierId]);

  return (
    <>
      <div className="stage__canvas" ref={hostRef} />
      {snapshot ? (
        <Hud snapshot={snapshot} level={level} />
      ) : (
        <div className="battle-boot">
          <span className="label blink">Deploying to {level.name}</span>
        </div>
      )}
    </>
  );
}
