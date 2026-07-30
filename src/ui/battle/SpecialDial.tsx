import { AGES } from '@/data/ages';
import { SPECIALS } from '@/data/specials';
import { bridge, type HudSnapshot } from '@/game/bridge';

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
  const ready = remaining <= 0;
  const progress = ready ? 1 : 1 - remaining / snapshot.specialMax;

  return (
    <button
      className={`dial${ready ? ' dial--ready' : ''}`}
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
          <span className="stamp dial__ready">Call</span>
        ) : (
          <span className="num dial__count">{Math.ceil(remaining)}</span>
        )}
      </span>
      <span className="dial__name stamp">{def.name}</span>
    </button>
  );
}
