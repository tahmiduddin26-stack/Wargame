import { useEffect, useMemo, useState } from 'react';
import type { HudSnapshot } from '@/game/bridge';

interface Cue {
  id: string;
  /** Shown only when this is true of the live battle state. */
  when: (s: HudSnapshot) => boolean;
  text: React.ReactNode;
}

/**
 * First-run coaching, shown on mission 1 only.
 *
 * The briefing screens explain the systems in the abstract; this points at the
 * actual control the first time it matters, which is a different job. Each cue
 * fires on a condition read from the live battle rather than on a timer, so it
 * arrives exactly when the player has the problem it solves, and each one is
 * shown once per run and then never again.
 */
const CUES: Cue[] = [
  {
    id: 'buy',
    when: (s) => s.fieldCount === 0 && s.queue.length === 0 && s.elapsed < 25,
    text: (
      <>
        Tap <b>Clubman</b> in the dock. He walks right until something stops him.
      </>
    ),
  },
  {
    id: 'contact',
    when: (s) => s.fieldCount > 0 && s.enemyFieldCount > 0,
    text: (
      <>
        Their line is out. Kills pay <b>gold</b> and <b>experience</b>, so keep bodies moving.
      </>
    ),
  },
  {
    id: 'special',
    when: (s) => s.specialCd <= 0 && s.enemyFieldCount >= 3,
    text: (
      <>
        Three or more in the lane. The <b>special</b> bottom right is free; only the cooldown costs
        you.
      </>
    ),
  },
  {
    id: 'evolve',
    when: (s) => s.canEvolve,
    text: (
      <>
        Enough experience banked. <b>Evolve</b> for a better roster and a tougher gate.
      </>
    ),
  },
  {
    id: 'gate',
    when: (s) => s.enemyBaseHp < s.enemyBaseMaxHp * 0.6,
    text: (
      <>
        Their gate is cracking. Keep the pressure on and it falls.
      </>
    ),
  },
];

export function BattleCoach({ snapshot }: { snapshot: HudSnapshot }) {
  const [seen, setSeen] = useState<string[]>([]);
  const [active, setActive] = useState<Cue | null>(null);

  const pending = useMemo(() => CUES.filter((c) => !seen.includes(c.id)), [seen]);

  useEffect(() => {
    if (active) return;
    const next = pending.find((c) => c.when(snapshot));
    if (next) setActive(next);
  }, [snapshot, active, pending]);

  // Cues retire themselves, so a player who is already coping is not nagged.
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      setSeen((s) => [...s, active.id]);
      setActive(null);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!active) return null;

  return (
    <div className="coach" role="status">
      <span className="coach__text">{active.text}</span>
      <button
        className="coach__dismiss"
        onClick={() => {
          setSeen((s) => [...s, active.id]);
          setActive(null);
        }}
      >
        Got it
      </button>
    </div>
  );
}
