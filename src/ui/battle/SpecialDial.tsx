import { AGES } from '@/data/ages';
import { SPECIALS } from '@/data/specials';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { useJustChanged } from '@/ui/useMotion';

const R = 26;
const CIRC = 2 * Math.PI * R;

/**
 * The free panic button. An SVG ring rather than a conic gradient, because the
 * ring is state (how long until it is usable) and needs to read at a glance in
 * the corner of the eye during a push.
 */
export function SpecialDial({ snapshot }: { snapshot: HudSnapshot }) {
  const age = AGES[snapshot.ageIndex];
  const def = SPECIALS[age.id];
  const remaining = snapshot.specialCd;

  /*
   * Sealed for the mission. Drawn as a dead ring rather than hidden, because the
   * dock is muscle memory by the time a player meets this modifier and a control
   * that vanishes reads as a bug. An empty ring where the dial lives reads as
   * "you know what goes here, and it is not coming".
   */
  if (!snapshot.specialsAllowed) {
    return (
      <div className="dial dial--sealed" role="img" aria-label="Support fire unavailable">
        <span className="label dial__name">No support</span>
      </div>
    );
  }

  const ready = remaining <= 0;
  // One bloom on the transition into ready, not a loop: the dial is in the
  // corner of the eye during a push and a permanent pulse would nag.
  const justReady = useJustChanged(ready, 640) && ready;
  const progress = ready ? 1 : 1 - remaining / snapshot.specialMax;

  return (
    <button
      className={`dial${ready ? ' dial--ready' : ''}${justReady ? ' bloom' : ''}`}
      style={{ '--accent': age.accent } as React.CSSProperties}
      onClick={() => bridge.send({ t: 'special' })}
      aria-label={ready ? `Call ${def.name}` : `${def.name} recharging`}
    >
      <svg viewBox="0 0 64 64" className="dial__svg" aria-hidden="true">
        <circle cx="32" cy="32" r={R} className="dial__track" />
        <circle
          cx="32"
          cy="32"
          r={R}
          className="dial__arc"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress)}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="dial__text">
        {ready ? (
          <span className="label dial__ready">Call</span>
        ) : (
          <span className="num dial__count">{Math.ceil(remaining)}</span>
        )}
      </span>
      <span className="label dial__name">{def.name}</span>
    </button>
  );
}
