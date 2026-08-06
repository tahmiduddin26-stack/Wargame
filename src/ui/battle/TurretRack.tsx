import { useState } from 'react';
import { AGES } from '@/data/ages';
import { SLOT_UNLOCK_COST, TURRET_BY_ID, TURRET_ROLE_LABEL, turretsForAge } from '@/data/turrets';
import { bridge, type HudSnapshot } from '@/game/bridge';
import { CloseGlyph, TurretGlyph } from '@/ui/components/Glyph';

/**
 * Emplacements, off the dock.
 *
 * Four mounts held permanent space in the bottom middle of the screen -- the
 * worst real estate there is in landscape, where neither thumb reaches -- for
 * something a player touches a handful of times a match and then forgets. They
 * collapse into one chip carrying the count, and the chip opens a tray.
 *
 * Inside the tray a mount still draws three states, not two, because "you have
 * not bought this yet" and "this mission will never sell you this" have to look
 * different: an offered mount carries a price, a sealed one carries nothing and
 * is not a button at all.
 */
export function TurretRack({ snapshot }: { snapshot: HudSnapshot }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const options = turretsForAge(AGES[snapshot.ageIndex].id);

  if (snapshot.slotBudget === 0) {
    return (
      <div className="mountchip mountchip--sealed">
        <span className="label">Sealed</span>
      </div>
    );
  }

  const built = snapshot.slots.filter((t, i) => i < snapshot.unlockedSlots && t !== null).length;

  const close = () => {
    setOpen(false);
    setPicking(null);
  };

  return (
    <div className="mounts">
      <button
        className={`mountchip plate${open ? ' mountchip--open' : ''}`}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="label">Mounts</span>
        <span className="num mountchip__count">
          {built}/{snapshot.slotBudget}
        </span>
      </button>

      {open && (
      <div className="tray plate" role="dialog" aria-label="Gate mounts">
        <header className="tray__head">
          <span className="label">Gate mounts</span>
          <button className="tray__close" onClick={close} aria-label="Close mounts">
            <CloseGlyph size={14} />
          </button>
        </header>

        <div className="tray__rack">
      {snapshot.slots.map((turretId, index) => {
        const sealed = index >= snapshot.slotBudget;
        const locked = index >= snapshot.unlockedSlots;
        const def = turretId ? TURRET_BY_ID[turretId] : null;
        const unlockCost = SLOT_UNLOCK_COST[index];
        const nextToUnlock = index === snapshot.unlockedSlots;

        if (sealed) {
          return (
            <div key={index} className="mount mount--locked mount--sealed" aria-hidden="true">
              <span className="mount__hazard" />
            </div>
          );
        }

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
            className={`mount${def ? ' mount--built' : ' mount--empty'}${
              picking === index ? ' mount--picking' : ''
            }`}
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
        </div>

        {picking === null ? (
          <p className="tray__note">Mounts upgrade themselves on evolve. Fill them first.</p>
        ) : (
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
            {snapshot.slots[picking] && (
              <li>
                <button
                  className="picker__scrap"
                  onClick={() => {
                    bridge.send({ t: 'scrap', slot: picking });
                    setPicking(null);
                  }}
                >
                  <span className="label">Scrap for half</span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      )}
    </div>
  );
}
