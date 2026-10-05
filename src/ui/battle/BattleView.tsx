import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { difficulty } from '@/data/difficulty';
import { levelById } from '@/data/levels';
import { resolvePerks } from '@/data/perks';
import { audio } from '@/game/audio/Audio';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { RAGDOLL } from '@/game/config';
import { BattleScene, battleGameConfig } from '@/game/scenes/BattleScene';
import { onlineClient, useOnline } from '@/multiplayer/client';
import { ONLINE_LEVEL } from '@/multiplayer/protocol';
import { useGame } from '@/state/store';
import { Hud } from './Hud';

export function BattleView() {
  const levelId = useGame((s) => s.activeLevel);
  const settings = useGame((s) => s.settings);
  const finishMission = useGame((s) => s.finishMission);
  const recordSurvival = useGame((s) => s.recordSurvival);
  const tierId = useGame((s) => s.difficulty);
  const perks = useGame((s) => s.perks);
  const equippedSkin = useGame((s) => s.equippedSkin);
  const survival = useGame((s) => s.survivalRun);
  const go = useGame((s) => s.go);
  const online = useOnline();
  const onlineMatch = online.match;
  const level = onlineMatch ? ONLINE_LEVEL : levelById(levelId);

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
        survival: onlineMatch ? false : survival,
        // Survival keeps one leaderboard of waves, so it is always played as written.
        difficulty: onlineMatch || survival ? 'normal' : tierId,
        perks: onlineMatch ? undefined : resolvePerks(perks),
        skinId: equippedSkin,
        seed: onlineMatch?.seed ?? (1337 + level.id * 977),
        onlineMatchId: onlineMatch?.matchId,
        corpseCap: settings.reducedCorpses ? Math.floor(RAGDOLL.maxActive / 2) : RAGDOLL.maxActive,
        speed: onlineMatch ? 1 : settings.speed,
      },
    );

    return () => {
      game.destroy(true);
      bridge.reset();
    };
    // Settings are read once at deploy; changing them mid-match would be worse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id, survival, onlineMatch?.matchId]);

  useEffect(() => bridge.onSnapshot(setSnapshot), []);

  useEffect(() => {
    if (!settings.haptics) return;
    return bridge.onReject(() => navigator.vibrate?.(35));
  }, [settings.haptics]);

  // Hand the result to the store exactly once; that swaps in the debrief screen.
  useEffect(() => {
    if (!snapshot?.over || reported.current) return;
    if (onlineMatch) return;
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
  }, [snapshot?.over, snapshot, level.id, finishMission, recordSurvival, go, tierId, onlineMatch]);

  useEffect(() => {
    if (!onlineMatch) return;
    if (online.result?.matchId !== onlineMatch.matchId && online.connection !== 'offline') return;
    const timer = window.setTimeout(() => { onlineClient.returnToLobby(); go('online'); }, online.result ? 900 : 0);
    return () => window.clearTimeout(timer);
  }, [onlineMatch, online.result, online.connection, go]);

  return (
    <>
      <div className="stage__canvas" ref={hostRef} />
      {snapshot ? (
        <Hud snapshot={snapshot} level={level} onlineMatch={onlineMatch} />
      ) : (
        <div className="battle-boot">
          <span className="label blink">Deploying to {level.name}</span>
        </div>
      )}
    </>
  );
}
