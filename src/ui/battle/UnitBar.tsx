import { AGES } from '@/data/ages';
import { ROLE_LABEL, unitsForAge } from '@/data/units';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { UnitGlyph } from '@/ui/components/Glyph';

/**
 * The four purchase cards. Order is fixed across every age (front, ranged,
 * heavy, artillery) so muscle memory survives an evolve: the card you tap for
 * a Clubman is the card you tap for an Exo Trooper.
 */
export function UnitBar({
  snapshot,
  eraChanged = false,
}: {
  snapshot: HudSnapshot;
  /** True for a moment after an evolve, so the new roster arrives as a list. */
  eraChanged?: boolean;
}) {
  const roster = unitsForAge(AGES[snapshot.ageIndex].id);

  return (
    <div className={`units${eraChanged ? ' units--changed' : ''}`}>
      {roster.map((def) => {
        const cooling = snapshot.cooldowns[def.id] ?? 0;
        const queued = snapshot.queue.filter((id) => id === def.id).length;
        const affordable = snapshot.gold >= def.gold;
        const ready = affordable && cooling <= 0;

        return (
          <button
            key={def.id}
            className={`unit${ready ? ' unit--ready' : ''}${affordable ? '' : ' unit--poor'}`}
            onClick={() => bridge.send({ t: 'unit', id: def.id })}
            aria-label={`Buy ${def.name}, ${def.gold} gold`}
          >
            {/* Cooldown wipe, drawn as a shutter rather than a spinner. */}
            {cooling > 0 && (
              <span
                className="unit__cool"
                style={{ transform: `scaleY(${Math.min(1, cooling / def.cooldown)})` }}
              />
            )}
            <span className="unit__role">
              <UnitGlyph role={def.role} size={14} />
              <span className="label">{ROLE_LABEL[def.role]}</span>
            </span>
            <span className="unit__name">{def.name}</span>
            <span className="unit__foot">
              <span className="num unit__cost">{def.gold.toLocaleString('en-GB')}</span>
              {cooling > 0 ? (
                <span className="num unit__wait">{cooling.toFixed(1)}s</span>
              ) : (
                queued > 0 && <span className="num unit__queued">&times;{queued}</span>
              )}
            </span>
            {/*
             * The card says why it is dead. A brass rail across the foot fills
             * as the gold approaches the price, so during a fast purchase run
             * you can see which card comes back next without reading four
             * numbers and doing the subtraction yourself.
             */}
            <span className="unit__rail" aria-hidden="true">
              <span
                className="unit__rail-fill"
                style={
                  { '--fill': Math.min(1, snapshot.gold / def.gold) } as React.CSSProperties
                }
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
