import { useEffect } from 'react';
import { bridge } from '@/game/bridge';
import { useGame } from '@/state/store';
import { OrientationGate } from '@/ui/OrientationGate';
import { useIsLandscape } from '@/ui/useOrientation';
import { BattleView } from '@/ui/battle/BattleView';
import { Codex } from '@/ui/screens/Codex';
import { Debrief } from '@/ui/screens/Debrief';
import { MainMenu } from '@/ui/screens/MainMenu';
import { MissionSelect } from '@/ui/screens/MissionSelect';
import { Onboarding } from '@/ui/screens/Onboarding';
import { Settings } from '@/ui/screens/Settings';

export function App() {
  const landscape = useIsLandscape();
  const screen = useGame((s) => s.screen);

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
        {screen === 'settings' && <Settings />}
      </div>
      {!landscape && <OrientationGate />}
    </>
  );
}
