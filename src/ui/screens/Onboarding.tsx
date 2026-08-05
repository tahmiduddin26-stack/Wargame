import { useState } from 'react';
import { nextMission, useGame } from '@/state/store';
import { GoldGlyph, UnitGlyph, XpGlyph } from '@/ui/components/Glyph';

interface Step {
  key: string;
  title: string;
  body: string;
  /** The one thing to remember. Printed as a stamped rule under the body. */
  rule: string;
  diagram: React.ReactNode;
}

/**
 * Four screens, one system each, in the order the first mission teaches them.
 * No walls of text: each step names the mechanic, states the trade-off, and
 * shows a diagram built from the same primitives as the real HUD so the player
 * recognises the control when they meet it.
 */
const STEPS: Step[] = [
  {
    key: 'gold',
    title: 'Gold buys bodies',
    body: 'Tap a card in the dock to buy a soldier. He queues at your gate and marches out one at a time, then walks right until something stops him.',
    rule: 'Four roles, every age: front, ranged, heavy, artillery.',
    diagram: (
      <div className="ob-dock">
        {(['melee', 'ranged', 'heavy', 'artillery'] as const).map((role, i) => (
          <div className={`ob-card${i === 0 ? ' ob-card--hot' : ''}`} key={role}>
            <UnitGlyph role={role} size={16} />
            <span className="num">{[15, 32, 115, 200][i]}</span>
          </div>
        ))}
        <div className="ob-arrow" />
      </div>
    ),
  },
  {
    key: 'xp',
    title: 'Kills pay twice',
    body: 'Every enemy you kill drops gold and experience. Gold buys the next soldier. Experience is never spent, it only unlocks the next age.',
    rule: 'Bank experience to evolve. Spend gold to survive long enough to.',
    diagram: (
      <div className="ob-split">
        <div className="ob-pill">
          <GoldGlyph size={15} />
          <span className="label">Gold</span>
          <span className="num">spends</span>
        </div>
        <div className="ob-pill ob-pill--xp">
          <XpGlyph size={15} />
          <span className="label">Experience</span>
          <span className="num">accrues</span>
        </div>
      </div>
    ),
  },
  {
    key: 'turrets',
    title: 'Emplacements hold the gate',
    body: 'Your base has four mounts. Rapid guns shred crowds, marksman guns reach further, mortars hit whole ranks. Two mounts are yours, the other two are bought.',
    rule: 'Mounts upgrade themselves when you evolve. Fill them before you age up.',
    diagram: (
      <div className="ob-mounts">
        {['RAPID', 'MARKSMAN', 'MORTAR', 'SEALED'].map((label, i) => (
          <div className={`ob-mount${i === 3 ? ' ob-mount--sealed' : ''}`} key={label}>
            <span className="label">{label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: 'special',
    title: 'The special is free',
    body: 'Once per cooldown you can call down the age you are in: a rockslide, an arrow storm, an air strike. It costs no gold and no experience.',
    rule: 'Hold it for the push that would break your gate.',
    diagram: (
      <div className="ob-special">
        <div className="ob-special__ring">
          <span className="num">READY</span>
        </div>
        <div className="ob-special__strikes" aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
      </div>
    ),
  },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const { completeOnboarding, startMission, go } = useGame();
  const records = useGame((s) => s.records);
  const onboardingDone = useGame((s) => s.onboardingDone);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = () => {
    completeOnboarding();
    // Replaying the briefing from the menu should not yank you into a mission.
    if (onboardingDone) go('menu');
    else startMission(nextMission(records));
  };

  return (
    <div className="ob field">
      <div className="hazard-rule" />
      <header className="ob__head">
        <span className="label">
          Field briefing <span className="num">{step + 1}</span> of{' '}
          <span className="num">{STEPS.length}</span>
        </span>
        <button className="btn btn--ghost ob__skip" onClick={finish}>
          Skip
        </button>
      </header>

      <div className="ob__body">
        <div className="ob__text">
          {/* The step number is real sequence information, so it stays, but it
              rides inline with the title rather than stacking above it. */}
          <h2 className="ob__title">
            <span className="num ob__step">{String(step + 1).padStart(2, '0')}</span>
            {current.title}
          </h2>
          <p className="ob__copy">{current.body}</p>
          <div className="ob__rule">
            <span className="label">Remember</span>
            <p>{current.rule}</p>
          </div>
        </div>
        <div className="ob__figure">{current.diagram}</div>
      </div>

      <footer className="ob__foot">
        <div className="ob__ticks" role="tablist" aria-label="Briefing steps">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={i === step}
              aria-label={s.title}
              className={`ob__tick${i === step ? ' ob__tick--on' : ''}${i < step ? ' ob__tick--done' : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
        <div className="ob__nav">
          <button
            className="btn btn--ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          <button
            className="btn btn--primary"
            onClick={() => (last ? finish() : setStep((s) => s + 1))}
          >
            {last ? (onboardingDone ? 'Done' : 'Deploy') : 'Next'}
          </button>
        </div>
      </footer>
    </div>
  );
}
