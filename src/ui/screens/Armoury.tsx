import { PERKS } from '@/data/perks';
import { useGame } from '@/state/store';

/**
 * The credits sink. A list, not a grid of cards, and every row states its effect
 * in the same units the HUD and roster already use, so nothing here needs a
 * separate explanation of what "+15% loot" means.
 */
export function Armoury() {
  const go = useGame((s) => s.go);
  const credits = useGame((s) => s.credits);
  const owned = useGame((s) => s.perks);
  const buyPerk = useGame((s) => s.buyPerk);

  const spent = PERKS.filter((p) => owned.includes(p.id)).reduce((n, p) => n + p.cost, 0);
  const total = PERKS.reduce((n, p) => n + p.cost, 0);

  return (
    <div className="st">
      <header className="st__head">
        <button className="btn btn--ghost" onClick={() => go('menu')}>
          Back
        </button>
        <h2 className="st__title">Armoury</h2>
        <span className="label">
          Credits <span className="num">{credits.toLocaleString('en-GB')}</span>
        </span>
      </header>
      <div className="hazard-rule" />

      <div className="st__body scroll-y am__body">
        <p className="am__intro">
          Permanent, bought once, and kept across every mission. The campaign is tuned to be
          winnable with none of this, so treat it as a head start rather than a requirement.
        </p>
        <p className="label am__progress">
          Fitted <span className="num">{owned.length}</span>/<span className="num">{PERKS.length}</span>
          {' '}&middot; <span className="num">{spent.toLocaleString('en-GB')}</span> of{' '}
          <span className="num">{total.toLocaleString('en-GB')}</span> credits committed
        </p>

        <ul className="am__list">
          {PERKS.map((perk) => {
            const have = owned.includes(perk.id);
            const affordable = credits >= perk.cost;
            return (
              <li key={perk.id} className={`am__row${have ? ' am__row--owned' : ''}`}>
                <span className="am__row-main">
                  <b className="am__name">{perk.name}</b>
                  <span className="am__brief">{perk.brief}</span>
                </span>
                <span className="am__effect num">{perk.effect}</span>
                {have ? (
                  <span className="label am__fitted">Fitted</span>
                ) : (
                  <button
                    className={`btn am__buy${affordable ? ' btn--primary' : ''}`}
                    disabled={!affordable}
                    onClick={() => buyPerk(perk.id)}
                  >
                    <span className="num">{perk.cost.toLocaleString('en-GB')}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
