import { useState } from 'react';
import { AGES } from '@/data/ages';
import { SPECIALS } from '@/data/specials';
import { turretsForAge, TURRET_ROLE_LABEL } from '@/data/turrets';
import { ROLE_LABEL, unitsForAge } from '@/data/units';
import { ARMOUR_LABEL, ARMOUR_TABLE } from '@/data/types';
import type { ArmourClass, DamageKind } from '@/data/types';
import { useGame } from '@/state/store';
import { TurretGlyph, UnitGlyph } from '@/ui/components/Glyph';

const KINDS: DamageKind[] = ['impact', 'pierce', 'blast', 'energy'];
const CLASSES: ArmourClass[] = ['flesh', 'plate', 'hull'];

/**
 * The counter table, beside the roster rather than under it.
 *
 * It used to be a caption-led table stacked above the unit list, which meant
 * "why did my clubmen bounce off that knight" and the clubman's own numbers
 * were never on screen together. It is a fixed panel now: read a unit, read its
 * counters, without scrolling between the two.
 *
 * Strength is keyed on brightness, not hue. The green-and-red version measured
 * 18.2 dE under protanopia, which is below the point where two colours read as
 * different at all, in the one table whose whole job is scanning for good and
 * bad.
 */
function CounterMatrix() {
  return (
    <table className="matrix">
      <caption className="label matrix__cap">Damage against armour</caption>
      <thead>
        <tr>
          <th scope="col" />
          {/*
            Short forms here, full words on the cards. "Unarmoured / Plated /
            Hull" as three column heads in a 21em panel collide; the class name
            is the same information and the card spells it out anyway.
          */}
          {CLASSES.map((c) => (
            <th scope="col" className="matrix__head" key={c}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {KINDS.map((kind) => (
          <tr key={kind}>
            <th scope="row" className="matrix__kind">
              {kind}
            </th>
            {CLASSES.map((cls) => {
              const v = ARMOUR_TABLE[kind][cls];
              const tone = v >= 1.2 ? ' matrix__v--good' : v <= 0.8 ? ' matrix__v--bad' : '';
              return (
                <td className={`num matrix__v${tone}`} key={cls}>
                  {v.toFixed(2)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The roster: cards for comparing, matrix for learning.
 *
 * This was an eleven-column spreadsheet -- role, unit, armour, gold, hp, dmg,
 * rate, dps, reach, speed, bounty -- which is a shape that asks a phone to do
 * something a phone cannot do, and asks a player to hold eleven figures in mind
 * to answer a question about two of them.
 *
 * Four cards carry the figures that actually change a decision: what it costs,
 * how much it can take, how much it deals, and how far it reaches. Everything
 * else (rate, raw damage, speed, bounty) was derivable, decorative, or both --
 * dps is rate times damage, and nobody has ever chosen a unit on bounty.
 *
 * The card also keeps a real art slot. There is no art yet, so it holds the role
 * glyph; when sprites arrive they drop straight in, which is the difference
 * between a placeholder and a gap.
 */
export function Codex() {
  const go = useGame((s) => s.go);
  const [ageIndex, setAgeIndex] = useState(0);
  const age = AGES[ageIndex];
  const units = unitsForAge(age.id);
  const turrets = turretsForAge(age.id);
  const special = SPECIALS[age.id];

  return (
    <div className="cx field">
      <header className="cx__head">
        <button className="btn btn--ghost" onClick={() => go('menu')}>
          Back
        </button>
        <h2 className="cx__title">Roster</h2>
        <span className="label cx__count">
          <span className="num">{AGES.length * 4}</span> units &middot;{' '}
          <span className="num">{AGES.length * 3}</span> emplacements
        </span>
      </header>

      {/*
        Era colour rides on the keys, which is the one place in the app where it
        is data rather than decoration: it is the legend for the colour you will
        be looking at on the battlefield.
      */}
      <nav className="rail" role="tablist" aria-label="Ages">
        {AGES.map((a, i) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={i === ageIndex}
            className={`rail__stop cx__age${i === ageIndex ? ' rail__stop--on' : ''}`}
            style={{ '--accent': a.accent } as React.CSSProperties}
            onClick={() => setAgeIndex(i)}
          >
            <span className="cx__swatch" aria-hidden="true" />
            <span className="rail__name">{a.name.replace(' Age', '')}</span>
          </button>
        ))}
      </nav>

      <div className="cx__body">
        <div className="cx__main scroll-y">
          <div className="cx__era">
            <h3 className="cx__era-name">{age.name}</h3>
            <p className="cx__era-tag">{age.tagline}</p>
            <div className="cx__era-stats">
              <span className="label">
                Unlock at <span className="num">{age.evolveXp.toLocaleString('en-GB')}</span> XP
              </span>
              <span className="label">
                Gate structure <span className="num">&times;{age.baseArmour}</span>
              </span>
              <span className="label">
                Special <b>{special.name}</b> <span className="num">{special.cooldown}s</span>
              </span>
            </div>
          </div>

          <h4 className="label cx__group">Field units</h4>
          <div className="cards">
            {units.map((u) => (
              <article className="card plate" key={u.id}>
                <header className="card__head">
                  <span className="label card__role">{ROLE_LABEL[u.role]}</span>
                  <span className="num card__cost">{u.gold.toLocaleString('en-GB')}</span>
                </header>

                {/* Real art slot. Holds the glyph until sprites exist. */}
                <div className="card__art readout">
                  <UnitGlyph role={u.role} size={26} />
                </div>

                <h5 className="card__name">{u.name}</h5>
                <p className="card__brief">{u.brief}</p>

                <dl className="card__figs">
                  <div>
                    <dt className="label">hp</dt>
                    <dd className="num">{u.hp.toLocaleString('en-GB')}</dd>
                  </div>
                  <div>
                    <dt className="label">dps</dt>
                    <dd className="num">{Math.round(u.damage * u.rate)}</dd>
                  </div>
                  <div>
                    <dt className="label">reach</dt>
                    <dd className="num">
                      {u.range}m{u.blast > 0 && <span className="card__blast"> &middot; {u.blast}r</span>}
                    </dd>
                  </div>
                </dl>

                {/* The two words that decide every trade in the game. */}
                <footer className="card__trade">
                  <span className="card__kind">{u.damageKind}</span>
                  <span className="card__vs">vs</span>
                  <span className="card__armour">{ARMOUR_LABEL[u.armour]}</span>
                </footer>
              </article>
            ))}
          </div>

          <h4 className="label cx__group">Emplacements</h4>
          <div className="cards cards--three">
            {turrets.map((t) => (
              <article className="card plate" key={t.id}>
                <header className="card__head">
                  <span className="label card__role">{TURRET_ROLE_LABEL[t.role]}</span>
                  <span className="num card__cost">{t.gold.toLocaleString('en-GB')}</span>
                </header>

                <div className="card__art readout">
                  <TurretGlyph role={t.role} size={26} />
                </div>

                <h5 className="card__name">{t.name}</h5>
                <p className="card__brief">{t.brief}</p>

                <dl className="card__figs">
                  <div>
                    <dt className="label">dps</dt>
                    <dd className="num">{Math.round(t.damage * t.rate)}</dd>
                  </div>
                  <div>
                    <dt className="label">reach</dt>
                    <dd className="num">
                      {t.range}m{t.blast > 0 && <span className="card__blast"> &middot; {t.blast}r</span>}
                    </dd>
                  </div>
                </dl>

                <footer className="card__trade">
                  <span className="card__kind">{t.damageKind}</span>
                  <span className="card__vs">on the approach</span>
                </footer>
              </article>
            ))}
          </div>
        </div>

        <aside className="cx__aside">
          <div className="matrix-panel plate">
            <CounterMatrix />
            <p className="matrix__note">
              Brightness carries the strength, not hue. Ranged answers heavies, artillery answers
              crowds, and chaff answers nothing with plate on it.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
