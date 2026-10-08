import { AGES } from '@/data/ages';
import { SPECIALS } from '@/data/specials';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { SpecialInsignia } from '@/ui/components/Insignia';

const R = 26;
const CIRC = 2 * Math.PI * R;

/**
 * The special's name, status and action each have a row. The small ring shows
 * recharge progress without running through the label or the attack icon.
 */
export function SpecialDial({ snapshot }: { snapshot: HudSnapshot }) {
  const age = AGES[snapshot.ageIndex];
  const def = SPECIALS[age.id];
  const remaining = Math.max(0, snapshot.specialCd);
  const ready = remaining <= 0;
  const seconds = Math.ceil(remaining);
  const progress = ready ? 1 : Math.max(0, Math.min(1, 1 - remaining / (snapshot.specialMax || def.cooldown)));

  return (
    <button
      className={`dial${ready ? ' dial--ready' : ''}`}
      disabled={!ready}
      onClick={() => bridge.send({ t: 'special' })}
      aria-label={ready ? `Call ${def.name}` : `${def.name} recharging, ${seconds} seconds`}
      title={def.brief}
    >
      <span className="label dial__name">{def.name}</span>
      <span className="dial__status" aria-hidden="true">
        <svg viewBox="0 0 64 64" className="dial__svg">
          <circle cx="32" cy="32" r={R} className="dial__track" />
          <circle cx="32" cy="32" r={R} className="dial__arc"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} transform="rotate(-90 32 32)" />
        </svg>
        <span className="dial__text">
          {ready ? <SpecialInsignia age={age.id} size={22} /> : <span className="num dial__count">{seconds}</span>}
        </span>
      </span>
      <span className="label dial__ready">{ready ? 'Call' : 'Recharging'}</span>
    </button>
  );
}
