import { useState } from 'react';
import { AGES } from '@/data/ages';
import { SLOT_UNLOCK_COST, TURRET_BY_ID, TURRET_ROLE_LABEL, turretsForAge } from '@/data/turrets';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { CloseGlyph, TurretGlyph } from '@/ui/components/Glyph';

/**
 * Four mounts on the gate. Anything built here upgrades itself on evolve, so
 * filling the mounts before you age up is strictly better than after.
 */
export function TurretRack({ snapshot, noTurrets }: { snapshot: HudSnapshot; noTurrets: boolean }) {
  const [picking, setPicking] = useState<number | null>(null);
  const options = turretsForAge(AGES[snapshot.ageIndex].id);

  if (noTurrets) {
    return (
      <div className="rack rack--disabled">
        <span className="label">Emplacements sealed</span>
      </div>
    );
  }

  return (
    <div className="rack">
      {snapshot.slots.map((turretId, index) => {
        const locked = index >= snapshot.unlockedSlots;
        const def = turretId ? TURRET_BY_ID[turretId] : null;
        const unlockCost = SLOT_UNLOCK_COST[index];
        const nextToUnlock = index === snapshot.unlockedSlots;

        if (locked) {
          return (
            <button
              key={index}
              className={`mount mount--locked${nextToUnlock ? ' mount--next' : ''}`}
              disabled={!nextToUnlock}
              onClick={() => bridge.send({ t: 'unlockSlot', slot: index })}
              aria-label={`Unlock mount ${index + 1} for ${unlockCost} gold`}
            >
              <span className="mount__hazard" />
              <span className="num mount__price">
                {nextToUnlock ? unlockCost.toLocaleString('en-GB') : '--'}
              </span>
            </button>
          );
        }

        return (
          <button
            key={index}
            className={`mount${def ? ' mount--built' : ' mount--empty'}`}
            onClick={() => setPicking(picking === index ? null : index)}
            aria-label={def ? `Mount ${index + 1}: ${def.name}` : `Build on mount ${index + 1}`}
          >
            {def ? (
              <>
                <TurretGlyph role={def.role} size={16} />
                <span className="label mount__label">{TURRET_ROLE_LABEL[def.role]}</span>
              </>
            ) : (
              <span className="label mount__label">Build</span>
            )}
          </button>
        );
      })}

      {picking !== null && (
        <div className="picker panel panel--raised" role="dialog" aria-label="Choose emplacement">
          <header className="picker__head">
            <span className="label">Mount {picking + 1}</span>
            <button className="picker__close" onClick={() => setPicking(null)} aria-label="Close">
              <CloseGlyph size={14} />
            </button>
          </header>
          <ul className="picker__list">
            {options.map((t) => {
              const affordable = snapshot.gold >= t.gold;
              return (
                <li key={t.id}>
                  <button
                    className={`picker__opt${affordable ? '' : ' picker__opt--poor'}`}
                    onClick={() => {
                      bridge.send({ t: 'turret', slot: picking, id: t.id });
                      setPicking(null);
                    }}
                  >
                    <TurretGlyph role={t.role} size={16} />
                    <span className="picker__opt-text">
                      <b>{t.name}</b>
                      <span className="picker__opt-brief">{t.brief}</span>
                    </span>
                    <span className="picker__opt-stats num">
                      {Math.round(t.damage * t.rate)} dps &middot; {t.range}m
                    </span>
                    <span className="num picker__opt-cost">{t.gold.toLocaleString('en-GB')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {snapshot.slots[picking] && (
            <button
              className="picker__scrap"
              onClick={() => {
                bridge.send({ t: 'scrap', slot: picking });
                setPicking(null);
              }}
            >
              <span className="label">Scrap for half</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
