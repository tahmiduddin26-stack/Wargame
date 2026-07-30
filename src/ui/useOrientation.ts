import { useEffect, useState } from 'react';

/**
 * Landscape is a hard requirement, not a preference. See OrientationGate for
 * the reasoning; this hook is just the detector.
 *
 * Uses aspect ratio rather than the `orientation` media query because a phone
 * with the keyboard open, or a tablet in split view, reports landscape while
 * being functionally portrait.
 */
export function useIsLandscape(): boolean {
  const [landscape, setLandscape] = useState(() => read());

  useEffect(() => {
    const onChange = () => setLandscape(read());
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
    };
  }, []);

  return landscape;
}

function read(): boolean {
  return window.innerWidth / Math.max(1, window.innerHeight) >= 1.25;
}

/** Best-effort orientation lock. Silently unavailable in most browsers. */
export async function requestLandscapeLock(): Promise<void> {
  const orientation = screen.orientation as
    | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
    | undefined;
  try {
    await orientation?.lock?.('landscape');
  } catch {
    // Browsers reject this outside fullscreen. The gate screen covers it.
  }
}
