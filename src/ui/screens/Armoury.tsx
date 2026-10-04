import { useState } from 'react';
import { commanderRank, nextRankXp, RANK_THRESHOLDS } from '@/data/career';
import { ARMY_SKINS } from '@/data/cosmetics';
import { PERKS, PERK_BY_ID, type PerkDef } from '@/data/perks';
import { useGame } from '@/state/store';
import { useChangeFlash, useTweenedNumber } from '@/ui/useMotion';

/**
 * Three branches, each with prerequisites. Career XP opens higher tiers while
 * campaign credits buy the permanent upgrades within them.
 */
export function Armoury() {
  const [tab, setTab] = useState<'skills' | 'skins'>('skills');
  const go = useGame((s) => s.go);
  const credits = useGame((s) => s.credits);
  const careerXp = useGame((s) => s.careerXp);
  const owned = useGame((s) => s.perks);
  const buyPerk = useGame((s) => s.buyPerk);
  const ownedSkins = useGame((s) => s.ownedSkins);
  const equippedSkin = useGame((s) => s.equippedSkin);
  const buySkin = useGame((s) => s.buySkin);
  const equipSkin = useGame((s) => s.equipSkin);

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
        <h2 className="st__title">Armoury</h2>
        <span className="label">
          Credits{' '}
          <span className={`num${creditsDir ? ` tick--${creditsDir}` : ''}`}>
            {Math.round(shownCredits).toLocaleString('en-GB')}
          </span>
        </span>
      </header>
      <div className="hazard-rule" />

      <div className="st__body scroll-y am__body">
        <div className="am__tabs" role="tablist" aria-label="Armoury sections">
          <button role="tab" aria-selected={tab === 'skills'} className={`btn${tab === 'skills' ? ' btn--primary' : ''}`} onClick={() => setTab('skills')}>Skill tree</button>
          <button role="tab" aria-selected={tab === 'skins'} className={`btn${tab === 'skins' ? ' btn--primary' : ''}`} onClick={() => setTab('skins')}>Army paints</button>
        </div>
        {tab === 'skills' ? <>
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
        </> : <>
          <p className="am__intro">Paints change your army and fort in campaign, survival and your local online view. They never change damage, health or matchmaking. Earn credits by playing; there is no real-money checkout in this build.</p>
          <ul className="am__skins">
            {ARMY_SKINS.map((skin) => {
              const ownedSkin = ownedSkins.includes(skin.id);
              const equipped = equippedSkin === skin.id;
              return <li className={`am__skin${equipped ? ' am__skin--equipped' : ''}`} key={skin.id}>
                <div className="am__skin-preview" style={{ '--skin-cloth': `#${skin.cloth.toString(16).padStart(6, '0')}`, '--skin-trim': `#${skin.trim.toString(16).padStart(6, '0')}`, '--skin-wall': `#${skin.fortPaper.toString(16).padStart(6, '0')}` } as React.CSSProperties} aria-hidden="true">
                  <span className="am__skin-flag" /><span className="am__skin-fort" /><span className="am__skin-soldier" />
                </div>
                <div className="am__skin-copy"><h3>{skin.name}</h3><p>{skin.note}</p><span className="label">Visual only · all ages</span></div>
                {equipped ? <span className="label am__skin-state">Equipped</span> : ownedSkin ?
                  <button className="btn" onClick={() => equipSkin(skin.id)}>Equip</button> :
                  <button className="btn btn--primary" disabled={credits < skin.cost} onClick={() => buySkin(skin.id)}>
                    Unlock · <span className="num">{skin.cost}</span>
                  </button>}
              </li>;
            })}
          </ul>
        </>}
      </div>
    </div>
  );
}
