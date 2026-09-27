import { commanderRank, nextRankXp, RANK_THRESHOLDS } from '@/data/career';
import { PERKS, PERK_BY_ID, type PerkDef } from '@/data/perks';
import { useGame } from '@/state/store';
import { useChangeFlash, useTweenedNumber } from '@/ui/useMotion';

/**
 * Three branches, each with prerequisites. Career XP opens higher tiers while
 * campaign credits buy the permanent upgrades within them.
 */
export function Armoury() {
  const go = useGame((s) => s.go);
  const credits = useGame((s) => s.credits);
  const careerXp = useGame((s) => s.careerXp);
  const owned = useGame((s) => s.perks);
  const buyPerk = useGame((s) => s.buyPerk);

  const shownCredits = useTweenedNumber(credits);
  const creditsDir = useChangeFlash(credits);

  const spent = PERKS.filter((p) => owned.includes(p.id)).reduce((n, p) => n + p.cost, 0);
  const total = PERKS.reduce((n, p) => n + p.cost, 0);
  const rank = commanderRank(careerXp);
  const next = nextRankXp(careerXp);
  const from = RANK_THRESHOLDS[rank - 1];
  const progress = next == null ? 1 : (careerXp - from) / (next - from);

  return (
    <div className="st">
      <header className="st__head">
        <button className="btn btn--ghost" onClick={() => go('menu')}>
          Back
        </button>
        <h2 className="st__title">Skill tree</h2>
        <span className="label">
          Credits{' '}
          <span className={`num${creditsDir ? ` tick--${creditsDir}` : ''}`}>
            {Math.round(shownCredits).toLocaleString('en-GB')}
          </span>
        </span>
      </header>
      <div className="hazard-rule" />

      <div className="st__body scroll-y am__body">
        <p className="am__intro">
          Win missions to earn commander XP and credits. XP opens higher ranks;
          credits fit each skill once. Follow a branch to reach its later skills.
        </p>
        <div className="am__career panel">
          <span className="label">Commander rank <strong className="num">{rank}</strong></span>
          <span className="num">{careerXp.toLocaleString('en-GB')} XP{next != null ? ` / ${next.toLocaleString('en-GB')}` : ' · MAX'}</span>
          <div className="meter"><div className="meter__fill meter__fill--xp" style={{ '--fill': progress } as React.CSSProperties} /></div>
        </div>
        <p className="label am__progress">
          Fitted <span className="num">{owned.length}</span>/<span className="num">{PERKS.length}</span>
          {' '}&middot; <span className="num">{spent.toLocaleString('en-GB')}</span> of{' '}
          <span className="num">{total.toLocaleString('en-GB')}</span> credits committed
        </p>

        {(['Supply', 'Training', 'Fortification'] as const).map((branch) => (
          <section className="am__branch" key={branch}>
            <h3 className="am__branch-name">{branch}</h3>
            <ul className="am__list">
              {PERKS.filter((perk) => perk.branch === branch).map((perk: PerkDef) => {
                const have = owned.includes(perk.id);
                const prerequisite = !perk.requires || owned.includes(perk.requires);
                const unlocked = rank >= perk.rank && prerequisite;
                const affordable = unlocked && credits >= perk.cost;
                return (
                  <li key={perk.id} className={`am__row${have ? ' am__row--owned' : ''}`}>
                    <span className="am__row-main">
                      <b className="am__name">{perk.name}</b>
                      <span className="am__brief">{perk.brief}</span>
                      {!have && <span className="am__req">
                        Rank {perk.rank}{perk.requires ? ` · after ${PERK_BY_ID[perk.requires].name}` : ''}
                      </span>}
                    </span>
                    <span className="am__effect num">{perk.effect}</span>
                    {have ? (
                      <span className="label am__fitted">Fitted</span>
                    ) : (
                      <button
                        className={`btn am__buy${affordable ? ' btn--primary' : ''}`}
                        disabled={!affordable}
                        onClick={() => buyPerk(perk.id)}
                        title={!unlocked ? 'Unlock the required rank and earlier skill first' : undefined}
                      >
                        <span className="num">{perk.cost.toLocaleString('en-GB')}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
