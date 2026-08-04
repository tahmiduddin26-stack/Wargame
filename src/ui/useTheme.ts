import { useEffect, useSyncExternalStore } from 'react';
import { useGame } from '@/state/store';

export type Theme = 'dark' | 'light';

/**
 * The stylesheet is one set of tokens with a `[data-theme='light']` override, so
 * switching finish is a single attribute on <html> and nothing remounts. That
 * matters more here than in a normal app: the battle screen owns a Phaser canvas
 * that must survive any change to the chrome around it.
 *
 * The page background lives on <html>, outside `.stage`, because the letterbox
 * bars either side of the 16:9 field are part of the panel too.
 */
export function useTheme(): Theme {
  const pref = useGame((s) => s.settings.theme);
  const systemDark = usePrefersDark();
  const theme: Theme = pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // Tells the browser which way to render scrollbars and any native control.
    root.style.colorScheme = theme;

    /*
     * Native shell and mobile browser chrome. Read the resolved token rather
     * than repeating the hex, so the two can never drift apart.
     */
    const page = getComputedStyle(root).getPropertyValue('--steel-900').trim();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (page && meta) meta.setAttribute('content', page);
  }, [theme]);

  return theme;
}

/**
 * Only consulted while the preference is 'auto', but the hook itself always
 * subscribes: a conditional subscription is a rules-of-hooks violation and the
 * listener costs nothing.
 */
function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

function query(): MediaQueryList {
  return window.matchMedia('(prefers-color-scheme: dark)');
}

function subscribe(onChange: () => void): () => void {
  const mql = query();
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return query().matches;
}
