import { useState } from 'react';
import { AGES } from '@/data/ages';
import { SPECIALS } from '@/data/specials';
import { turretsForAge, TURRET_ROLE_LABEL } from '@/data/turrets';
import { ROLE_LABEL, unitsForAge } from '@/data/units';
import { useGame } from '@/state/store';
import { TurretGlyph, UnitGlyph } from '@/ui/components/Glyph';

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
    <div className="cx">
      <header className="cx__head">
        <button className="btn btn--ghost" onClick={() => go('menu')}>
          Back
        </button>
        <h2 className="cx__title">Roster</h2>
        <span className="stamp cx__count">
          <span className="num">{AGES.length * 4}</span> units &middot;{' '}
          <span className="num">{AGES.length * 3}</span> emplacements
        </span>
      </header>

      <nav className="cx__ages" role="tablist" aria-label="Ages">
        {AGES.map((a, i) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={i === ageIndex}
            className={`cx__age${i === ageIndex ? ' cx__age--on' : ''}`}
            style={{ '--accent': a.accent } as React.CSSProperties}
            onClick={() => setAgeIndex(i)}
          >
            <span className="num cx__age-i">{i + 1}</span>
            <span className="cx__age-name">{a.name.replace(' Age', '')}</span>
          </button>
        ))}
      </nav>

      <div className="cx__body scroll-y">
        <div className="cx__era" style={{ '--accent': age.accent } as React.CSSProperties}>
          <h3 className="cx__era-name">{age.name}</h3>
          <p className="cx__era-tag">{age.tagline}</p>
          <div className="cx__era-stats">
            <span className="stamp">
              Unlock at <span className="num">{age.evolveXp.toLocaleString('en-GB')}</span> XP
            </span>
            <span className="stamp">
              Gate structure <span className="num">&times;{age.baseArmour}</span>
            </span>
            <span className="stamp">
              Special <b>{special.name}</b> <span className="num">{special.cooldown}s</span>
            </span>
          </div>
        </div>

        <table className="cx__table">
          <caption className="stamp cx__caption">Field units</caption>
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Unit</th>
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
                  <span className="stamp">{ROLE_LABEL[u.role]}</span>
                </td>
                <td>
                  <b className="cx__name">{u.name}</b>
                  <span className="cx__brief">{u.brief}</span>
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
          <caption className="stamp cx__caption">Emplacements</caption>
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Emplacement</th>
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
                  <span className="stamp">{TURRET_ROLE_LABEL[t.role]}</span>
                </td>
                <td>
                  <b className="cx__name">{t.name}</b>
                  <span className="cx__brief">{t.brief}</span>
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
