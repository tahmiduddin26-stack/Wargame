import { useEffect } from 'react';
import { audio, installAudioUnlock } from '@/game/audio/Audio';
import { bridge } from '@/game/bridge';
import { useGame } from '@/state/store';
import { OrientationGate } from '@/ui/OrientationGate';
import { useIsLandscape } from '@/ui/useOrientation';
import { BattleView } from '@/ui/battle/BattleView';
import { Armoury } from '@/ui/screens/Armoury';
import { Codex } from '@/ui/screens/Codex';
import { Debrief } from '@/ui/screens/Debrief';
import { MainMenu } from '@/ui/screens/MainMenu';
import { MissionSelect } from '@/ui/screens/MissionSelect';
import { Onboarding } from '@/ui/screens/Onboarding';
import { Settings } from '@/ui/screens/Settings';

export function App() {
  const landscape = useIsLandscape();
  const screen = useGame((s) => s.screen);
  const sfxOn = useGame((s) => s.settings.sfx);
  const musicOn = useGame((s) => s.settings.music);

  // Browsers refuse to start an audio context outside a gesture, so this arms
  // one listener and the first touch anywhere brings the whole mixer up.
  useEffect(() => installAudioUnlock(), []);

  /*
   * One delegated listener gives every button a tick, rather than threading an
   * onClick wrapper through forty components. Battle-dock buttons are excluded:
   * they already produce a spawn or a rejection sound of their own, and doubling
   * it up turns a fast purchase run into a rattle.
   */
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const el = (event.target as HTMLElement | null)?.closest('button');
      if (!el) return;
      if (el.closest('.hud__dock') || el.closest('.lane')) return;
      audio.uiTap();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);

  useEffect(() => {
    audio.setSfx(sfxOn);
    audio.setMusic(musicOn);
  }, [sfxOn, musicOn]);

  // Rotating away mid-battle pauses rather than losing the match.
  useEffect(() => {
    if (screen === 'battle' && !landscape) bridge.send({ t: 'pause', on: true });
  }, [screen, landscape]);

  return (
    <>
      <div className="stage">
        {screen === 'menu' && <MainMenu />}
        {screen === 'onboarding' && <Onboarding />}
        {screen === 'missions' && <MissionSelect />}
        {screen === 'battle' && <BattleView />}
        {screen === 'debrief' && <Debrief />}
        {screen === 'codex' && <Codex />}
        {screen === 'armoury' && <Armoury />}
        {screen === 'settings' && <Settings />}
      </div>
      {!landscape && <OrientationGate />}
    </>
  );
}
