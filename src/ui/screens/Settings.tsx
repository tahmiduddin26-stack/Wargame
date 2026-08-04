import { useState } from 'react';
import { useGame, type ThemePref } from '@/state/store';

const THEMES: { id: ThemePref; name: string }[] = [
  { id: 'auto', name: 'Auto' },
  { id: 'dark', name: 'Night' },
  { id: 'light', name: 'Day' },
];

export function Settings() {
  const go = useGame((s) => s.go);
  const settings = useGame((s) => s.settings);
  const setSetting = useGame((s) => s.setSetting);
  const resetProgress = useGame((s) => s.resetProgress);
  const [confirmWipe, setConfirmWipe] = useState(false);

  return (
    <div className="st">
      <header className="st__head">
        <button className="btn btn--ghost" onClick={() => go('menu')}>
          Back
        </button>
        <h2 className="st__title">Settings</h2>
        <span className="label">Stored on this device</span>
      </header>
      <div className="hazard-rule" />

      <div className="st__body scroll-y">
        <section className="st__group">
          <h3 className="st__label">Battle speed</h3>
          <p className="st__note">Applies the moment you deploy. Corpse physics run at real time.</p>
          <div className="st__choices">
            {([1, 1.5, 2] as const).map((factor) => (
              <button
                key={factor}
                className={`st__choice${settings.speed === factor ? ' st__choice--on' : ''}`}
                onClick={() => setSetting('speed', factor)}
              >
                <span className="num">{factor}&times;</span>
              </button>
            ))}
          </div>
        </section>

        <section className="st__group">
          <h3 className="st__label">Panel finish</h3>
          <p className="st__note">
            Night is the authored look. Day is the same panel printed on bleached board, for
            playing in sunlight. Auto follows your device. The battlefield keeps its own light
            either way &mdash; the era colours are the world, not the chrome.
          </p>
          <div className="st__choices">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                className={`st__choice${settings.theme === theme.id ? ' st__choice--on' : ''}`}
                aria-pressed={settings.theme === theme.id}
                onClick={() => setSetting('theme', theme.id)}
              >
                <span className="st__choice-word">{theme.name}</span>
              </button>
            ))}
          </div>
        </section>

        <Toggle
          label="Sound effects"
          note="Impacts, gunfire and detonations. All synthesised at runtime, so there is nothing to download."
          on={settings.sfx}
          onChange={(v) => setSetting('sfx', v)}
        />

        <Toggle
          label="Music bed"
          note="A drone that shifts with the age and tightens as the fighting reaches your gate."
          on={settings.music}
          onChange={(v) => setSetting('music', v)}
        />

        <Toggle
          label="Reduced corpses"
          note="Halves the ragdoll cap. Use on older phones if the frame rate dips during a push."
          on={settings.reducedCorpses}
          onChange={(v) => setSetting('reducedCorpses', v)}
        />

        <Toggle
          label="Lane strip"
          note="The overview bar across the top of the HUD showing both gates and every unit."
          on={settings.showLaneStrip}
          onChange={(v) => setSetting('showLaneStrip', v)}
        />

        <Toggle
          label="Haptics"
          note="Short buzz when a purchase is denied. Ignored on devices without a vibrator."
          on={settings.haptics}
          onChange={(v) => setSetting('haptics', v)}
        />

        <section className="st__group st__group--danger">
          <h3 className="st__label">Wipe progress</h3>
          <p className="st__note">
            Clears every mission record, credit and the briefing flag. Cannot be undone.
          </p>
          {!confirmWipe ? (
            <button className="btn btn--danger" onClick={() => setConfirmWipe(true)}>
              Wipe
            </button>
          ) : (
            <div className="st__confirm">
              <button
                className="btn btn--danger"
                onClick={() => {
                  resetProgress();
                  setConfirmWipe(false);
                }}
              >
                Confirm wipe
              </button>
              <button className="btn btn--ghost" onClick={() => setConfirmWipe(false)}>
                Cancel
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Toggle({
  label,
  note,
  on,
  onChange,
}: {
  label: string;
  note: string;
  on: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <section className="st__group">
      <button
        className="st__toggle"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
      >
        <span className="st__toggle-text">
          <span className="st__label">{label}</span>
          <span className="st__note">{note}</span>
        </span>
        <span className={`st__switch${on ? ' st__switch--on' : ''}`}>
          <span className="label">{on ? 'ON' : 'OFF'}</span>
        </span>
      </button>
    </section>
  );
}
