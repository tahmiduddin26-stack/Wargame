import type { TurretRole, UnitRole } from '@/data/types';

/**
 * Inline SVG marks for the four unit roles and three emplacement roles.
 * Deliberately not emoji: emoji as icons is one of the loudest AI-design tells,
 * and these need to sit on a 24px touch target without a font dependency.
 */

interface Props {
  size?: number;
  className?: string;
}

const box = '0 0 24 24';

export function UnitGlyph({ role, size = 18, className }: Props & { role: UnitRole }) {
  return (
    <svg viewBox={box} width={size} height={size} className={className} aria-hidden="true">
      {role === 'melee' && (
        // Closing chevron: gets in front and stays there.
        <path d="M5 4 L15 12 L5 20 L9 12 Z M12 4 L22 12 L12 20 L16 12 Z" fill="currentColor" />
      )}
      {role === 'ranged' && (
        // Loosed arrow.
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21 L20 4" />
          <path d="M14 4 H20 V10" />
        </g>
      )}
      {role === 'heavy' && (
        // Plated shield.
        <path
          d="M12 2 L21 6 V13 C21 18 12 22 12 22 C12 22 3 18 3 13 V6 Z"
          fill="currentColor"
          opacity="0.9"
        />
      )}
      {role === 'artillery' && (
        // Lobbed trajectory over an obstacle.
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 20 Q12 1 22 20" />
          <path d="M2 21 H22" strokeWidth="1" opacity="0.5" />
        </g>
      )}
    </svg>
  );
}

export function TurretGlyph({ role, size = 18, className }: Props & { role: TurretRole }) {
  return (
    <svg viewBox={box} width={size} height={size} className={className} aria-hidden="true">
      {role === 'rapid' && (
        <g fill="currentColor">
          <rect x="3" y="10" width="12" height="4" />
          <rect x="16" y="11" width="5" height="2" />
          <rect x="4" y="15" width="10" height="5" />
        </g>
      )}
      {role === 'marksman' && (
        <g fill="currentColor">
          <rect x="2" y="11" width="20" height="2.5" />
          <rect x="5" y="14" width="9" height="6" />
          <circle cx="9" cy="8" r="2.5" />
        </g>
      )}
      {role === 'mortar' && (
        <g fill="currentColor">
          <rect x="7" y="4" width="4" height="13" transform="rotate(-28 9 10)" />
          <rect x="3" y="17" width="14" height="4" />
        </g>
      )}
    </svg>
  );
}

/** Coin mark for gold figures. */
export function GoldGlyph({ size = 13, className }: Props) {
  return (
    <svg viewBox={box} width={size} height={size} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M12 7 V17 M9 10 h6 M9 14 h6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Chevron stack for experience. */
export function XpGlyph({ size = 13, className }: Props) {
  return (
    <svg viewBox={box} width={size} height={size} className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M4 13 L12 5 L20 13" />
        <path d="M4 19 L12 11 L20 19" />
      </g>
    </svg>
  );
}

/**
 * Drawn close mark. A unicode multiplication sign standing in for an icon is a
 * different stroke weight and optical size from everything around it.
 */
export function CloseGlyph({ size = 14, className }: Props) {
  return (
    <svg viewBox={box} width={size} height={size} className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="square">
        <path d="M5 5 L19 19" />
        <path d="M19 5 L5 19" />
      </g>
    </svg>
  );
}
