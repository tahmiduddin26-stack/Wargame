import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { levelById } from '@/data/levels';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { RAGDOLL } from '@/game/config';
import { BattleScene, battleGameConfig } from '@/game/scenes/BattleScene';
import { useGame } from '@/state/store';
import { Hud } from './Hud';

export function BattleView() {
  const levelId = useGame((s) => s.activeLevel);
  const settings = useGame((s) => s.settings);
  const finishMission = useGame((s) => s.finishMission);
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

    const game = new Phaser.Game(battleGameConfig(host));
    game.scene.add(
      'battle',
      BattleScene,
      true,
      {
        level,
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
  }, [level.id]);

  useEffect(() => bridge.onSnapshot(setSnapshot), []);

  useEffect(() => {
    if (!settings.haptics) return;
    return bridge.onReject(() => navigator.vibrate?.(35));
  }, [settings.haptics]);

  // Hand the result to the store exactly once; that swaps in the debrief screen.
  useEffect(() => {
    if (!snapshot?.over || reported.current) return;
    reported.current = true;
    const mine = snapshot.stats.player;
    finishMission({
      levelId: level.id,
      won: snapshot.over === 'player',
      decidedBy: snapshot.decidedBy,
      seconds: snapshot.elapsed,
      kills: mine.kills,
      losses: mine.losses,
      goldSpent: mine.goldSpent,
      peakAge: mine.peakAge,
    });
  }, [snapshot?.over, snapshot, level.id, finishMission]);

  return (
    <>
      <div className="stage__canvas" ref={hostRef} />
      {snapshot ? (
        <Hud snapshot={snapshot} level={level} />
      ) : (
        <div className="battle-boot">
          <span className="stamp blink">Deploying to {level.name}</span>
        </div>
      )}
    </>
  );
}
