import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** True when the visitor has asked for reduced motion. Re-reads on change. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Eases a displayed figure toward its real value.
 *
 * Gold arrives in lumps: a kill pays loot instantly, an emplacement takes a
 * chunk. Snapping between those values reads as a glitch, and it also makes it
 * hard to tell a large payment from a small one. Easing over ~250ms turns each
 * change into something with a size you can feel.
 *
 * Runs on requestAnimationFrame and stops the moment it arrives, so an idle HUD
 * costs nothing.
 */
export function useTweenedNumber(target: number, durationMs = 260): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(target);
      return;
    }
    // A jump this large is a new match, not a payment. Do not animate it.
    if (Math.abs(target - display) > Math.max(4000, target * 0.9)) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }

    fromRef.current = display;
    startRef.current = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      // Exponential ease-out: fast commit, soft landing.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // `display` is deliberately excluded: including it restarts the tween on
    // every frame it produces, which never converges.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, reduced]);

  return display;
}

/**
 * Reports the direction a value just moved, for a moment, so a figure can tint
 * itself green or red without changing size and reflowing a tabular column.
 */
export function useChangeFlash(value: number, holdMs = 420): 'up' | 'down' | null {
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const next = value > prev.current ? 'up' : 'down';
    prev.current = value;
    setDir(next);
    const timer = window.setTimeout(() => setDir(null), holdMs);
    return () => window.clearTimeout(timer);
  }, [value, holdMs]);

  return dir;
}

/**
 * True for `holdMs` after `value` changes. Used to hang a one-shot animation
 * class on an element that is otherwise driven by a steady stream of snapshots.
 */
export function useJustChanged(value: unknown, holdMs = 700): boolean {
  const [hot, setHot] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    prev.current = value;
    setHot(true);
    const timer = window.setTimeout(() => setHot(false), holdMs);
    return () => window.clearTimeout(timer);
  }, [value, holdMs]);

  return hot;
}

/**
 * Measured width of an element, kept current through resize.
 *
 * The lane strip needs this: blips have to move with `translateX` in pixels
 * rather than a `left` percentage, because animating `left` on two dozen
 * elements at twelve samples a second is exactly the layout thrash the motion
 * rules forbid.
 */
export function useMeasuredWidth<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
