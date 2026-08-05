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
 * The counter table, shown rather than hidden. Reach and cost are legible from
 * the unit rows, but "why did my clubmen bounce off that knight" is not, and it
 * is the single most important thing to understand about a fight.
 */
function CounterMatrix() {
  return (
    <table className="cx__table cx__matrix">
      <caption className="label cx__caption">Damage against armour</caption>
      <thead>
        <tr>
          <th scope="col">Damage</th>
          {CLASSES.map((c) => (
            <th scope="col" className="cx__n" key={c}>
              {ARMOUR_LABEL[c]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {KINDS.map((kind) => (
          <tr key={kind}>
            <td className="cx__kind">{kind}</td>
            {CLASSES.map((cls) => {
              const v = ARMOUR_TABLE[kind][cls];
              const tone = v >= 1.2 ? ' cx__mult--good' : v <= 0.8 ? ' cx__mult--bad' : '';
              return (
                <td className={`num cx__n cx__mult${tone}`} key={cls}>
                  {v.toFixed(2)}&times;
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
 * The roster, as a readout rather than a set of cards. Every figure is mono
 * tabular so the columns line up and a player can actually compare a Knight to
 * a Trebuchet, which is the only reason to have this screen.
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

      {/* A detented rail, not a tab bar: the ages are an ordered ladder, and
          the underline-tab is the pattern everything else already uses. */}
      <nav className="rail" role="tablist" aria-label="Ages">
        <span className="rail__track" aria-hidden="true" />
        {AGES.map((a, i) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={i === ageIndex}
            className={`rail__stop${i === ageIndex ? ' rail__stop--on' : ''}`}
            onClick={() => setAgeIndex(i)}
          >
            <span className="rail__detent" aria-hidden="true" />
            <span className="num rail__index">{i + 1}</span>
            <span className="rail__name">{a.name.replace(' Age', '')}</span>
          </button>
        ))}
      </nav>

      <div className="cx__body scroll-y">
        <div className="cx__era" style={{ '--accent': age.accent } as React.CSSProperties}>
          <h3 className="cx__era-name">
            {/* Colour as legend, beside the era it describes, rather than as
                chrome tint on the heading itself. */}
            <span className="cx__swatch" aria-hidden="true" />
            {age.name}
          </h3>
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

        <CounterMatrix />

        <table className="cx__table">
          <caption className="label cx__caption">Field units</caption>
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Unit</th>
              <th scope="col">Armour</th>
              <th scope="col" className="cx__n">Gold</th>
              <th scope="col" className="cx__n">HP</th>
              <th scope="col" className="cx__n">Dmg</th>
              <th scope="col" className="cx__n">Rate</th>
              <th scope="col" className="cx__n">DPS</th>
              <th scope="col" className="cx__n">Reach</th>
              <th scope="col" className="cx__n">Speed</th>
              <th scope="col" className="cx__n">Bounty</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td className="cx__role">
                  <UnitGlyph role={u.role} size={15} />
                  <span className="label">{ROLE_LABEL[u.role]}</span>
                </td>
                <td>
                  <b className="cx__name">{u.name}</b>
                  <span className="cx__brief">{u.brief}</span>
                </td>
                <td className="cx__armour">
                  <span className="label">{ARMOUR_LABEL[u.armour]}</span>
                  <span className="cx__kind">{u.damageKind}</span>
                </td>
                <td className="num cx__n">{u.gold.toLocaleString('en-GB')}</td>
                <td className="num cx__n">{u.hp.toLocaleString('en-GB')}</td>
                <td className="num cx__n">
                  {u.damage}
                  {u.blast > 0 && <span className="cx__blast">+{u.blast}r</span>}
                </td>
                <td className="num cx__n">{u.rate.toFixed(2)}/s</td>
                <td className="num cx__n">{Math.round(u.damage * u.rate)}</td>
                <td className="num cx__n">{u.range}m</td>
                <td className="num cx__n">{u.speed}</td>
                <td className="num cx__n">{u.bounty.toLocaleString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="cx__table">
          <caption className="label cx__caption">Emplacements</caption>
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Emplacement</th>
              <th scope="col">Damage</th>
              <th scope="col" className="cx__n">Gold</th>
              <th scope="col" className="cx__n">Dmg</th>
              <th scope="col" className="cx__n">Rate</th>
              <th scope="col" className="cx__n">DPS</th>
              <th scope="col" className="cx__n">Reach</th>
            </tr>
          </thead>
          <tbody>
            {turrets.map((t) => (
              <tr key={t.id}>
                <td className="cx__role">
                  <TurretGlyph role={t.role} size={15} />
                  <span className="label">{TURRET_ROLE_LABEL[t.role]}</span>
                </td>
                <td>
                  <b className="cx__name">{t.name}</b>
                  <span className="cx__brief">{t.brief}</span>
                </td>
                <td className="cx__armour">
                  <span className="cx__kind">{t.damageKind}</span>
                </td>
                <td className="num cx__n">{t.gold.toLocaleString('en-GB')}</td>
                <td className="num cx__n">
                  {t.damage}
                  {t.blast > 0 && <span className="cx__blast">+{t.blast}r</span>}
                </td>
                <td className="num cx__n">{t.rate.toFixed(2)}/s</td>
                <td className="num cx__n">{Math.round(t.damage * t.rate)}</td>
                <td className="num cx__n">{t.range}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
