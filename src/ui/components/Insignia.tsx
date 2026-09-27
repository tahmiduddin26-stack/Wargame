import type { AgeId } from '@/data/types';

/**
 * Small, hand-drawn field silhouettes. They share a 32-unit drawing grid and
 * square-ended strokes so each era feels like part of the same equipment manual.
 * The main contour carries the object; the lighter line is a construction detail.
 */
interface Mark {
  contour: string;
  detail?: string;
}

const UNIT_MARKS: Record<string, Mark> = {
  'clubman': { contour: 'M8 27 21 7 24 5 28 9 26 12 12 28 M7 26l5 3', detail: 'M18 12l6 4 M10 22l5 3' },
  'slinger': { contour: 'M9 26c5-6 9-12 10-18 M19 8c2-3 6-3 8 0 M19 8l-5-3 M10 26l-3 3', detail: 'M22 7l3 3 M14 5l-3-2' },
  'dino-rider': { contour: 'M5 23l5-9 8-3 6 4 4 1-1 5-5 1-4-3-7 2-3 5 M12 22l-2 6 M21 21l1 7', detail: 'M12 13l2-6 4 3 M23 16h1 M5 23l-2 2' },
  'boulder-hurler': { contour: 'M5 27h22 M9 26l13-17 M19 8l7 4 M11 24l-5-5 M21 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z', detail: 'M8 20l8 6 M6 27l-2-4' },
  'spearman': { contour: 'M5 28 24 5l3-2-1 4L8 29 M9 13l-4 4 5 5 5-4', detail: 'M11 12l7 7 M22 8l3 3' },
  'longbowman': { contour: 'M7 4c15 6 15 18 0 24 M7 4v24 M4 16h23 M22 12l5 4-5 4', detail: 'M10 6c8 7 8 13 0 20' },
  'knight': { contour: 'M10 8l5-4 8 4 2 15-6 5H8l-2-5 2-15Z M8 17h17 M12 17v6h11', detail: 'M10 8h13 M16 4v-2 M8 24h17' },
  'trebuchet': { contour: 'M5 27h22 M7 25l8-16 9 16 M9 10l18-5 M10 8l3 5 M22 5l4 5', detail: 'M15 9v18 M5 19l5 6 M23 21l4 6' },
  'musketeer': { contour: 'M4 12h24 M8 11V8h8l2-4h5l-1 8 M7 16h17l3 3-11 1-3 6H8l3-8-7-1Z', detail: 'M10 16l-3-5 M18 12v4 M23 12l3 3' },
  'grenadier': { contour: 'M11 11h11l3 4-2 11H9L7 15l4-4Z M14 10V6h6v4 M20 5l4-2', detail: 'M12 17h8 M16 13v10 M9 26h14' },
  'cuirassier': { contour: 'M4 23l4-11 8-4 8 4 4 6-6 4-5-3-7 3-2 6 M21 21l2 7 M10 10l4-6 5 3', detail: 'M13 8l1 7 M23 14l4 1 M17 19l-2 5' },
  'field-cannon': { contour: 'M4 15h19l5-4v5l-5 3H11 M11 19l-5 8h19 M12 24a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z', detail: 'M5 14l2-4h12 M22 19l3 8' },
  'rifleman': { contour: 'M4 15h21l3-3v5l-4 2H14l-4 8H6l4-10H4Z M17 11h6v4', detail: 'M13 19h6 M21 19l2 6 M6 15V9' },
  'machine-gunner': { contour: 'M3 13h25v5H3Z M10 18l-5 9h5l5-9 M20 18l5 9 M9 10h13v3', detail: 'M6 20h7 M17 21l3 1-3 2 3 1 M5 27h22' },
  'battle-tank': { contour: 'M4 15h24l-2 8H6Z M8 14l3-5h10l4 5 M17 9V5h10 M8 25h16 M9 27h14', detail: 'M8 19h17 M10 23h2 M15 23h2 M20 23h2' },
  'rocket-truck': { contour: 'M3 18h26v7H3Z M7 18l3-11 4 1-2 10 M15 18l3-11 4 1-2 10 M24 18l3-9', detail: 'M7 26h4 M21 26h4 M10 5l1-2 M18 5l1-2 M26 7l1-2' },
  'exo-trooper': { contour: 'M9 7l5-4h6l5 4 2 15-5 6H10l-5-6 2-15Z M10 14h14l-2 7H12Z', detail: 'M13 11h8 M16 21v5 M8 23l5 2 M24 23l-5 2' },
  'railgunner': { contour: 'M3 13h26v6H3Z M10 19l-4 9h6l4-9 M23 10v3 M7 10v3', detail: 'M5 16h21 M17 9h8 M20 19l3 8 M27 14l3 2-3 2' },
  'assault-mech': { contour: 'M7 5h18l3 13-5 4v6h-5v-6h-4v6H9v-6l-5-4Z M10 10h12l-2 7h-8Z', detail: 'M4 12h4 M24 12h4 M14 17h4 M9 23h5 M18 23h5' },
  'ion-battery': { contour: 'M5 26h22 M8 26l4-11h8l4 11 M13 14l3-10 3 10 M8 15h16 M6 9l4-3 M26 9l-4-3', detail: 'M16 4v-2 M10 21h12 M12 15l4 4 4-4' },
};

const TURRET_MARKS: Record<string, Mark> = {
  'rock-chucker': { contour: 'M5 26h22 M9 26V15h11l7-5 M19 15l-3-6 M23 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z' },
  'spear-post': { contour: 'M6 26h18 M10 26V9l4-5 4 5v17 M10 13h13l5-3-2 5-3-2', detail: 'M14 9v16' },
  'log-drop': { contour: 'M5 25h21 M7 22l14-11 6 8-14 8Z M8 9h16v5', detail: 'M11 20l6 4 M16 16l6 4' },
  'arrow-slit': { contour: 'M6 27V7h20v20 M10 17h12 M10 9h12v12H10Z M4 18h23', detail: 'M16 10v11 M23 15l4 3-4 3' },
  'ballista': { contour: 'M4 12l8-6 3 10-3 9-8-5 M28 12l-8-6-3 10 3 9 8-5 M4 16h24', detail: 'M13 25h7 M16 16v11' },
  'pitch-catapult': { contour: 'M5 26h23 M9 26l10-15 7 15 M7 13l19-8 M22 5l4 6 M5 15l4 3', detail: 'M12 21h11 M19 11l2-4' },
  'swivel-gun': { contour: 'M4 11h24v6H4Z M10 17v9h12v-9 M6 26h20 M12 8h8v3', detail: 'M7 14h18 M16 17v9' },
  'long-nine': { contour: 'M3 12h25v6H3Z M10 18l-5 9h22l-5-9 M8 10h15', detail: 'M7 15h19 M13 19v8 M21 19v8' },
  'howitzer-pit': { contour: 'M3 26h26 M6 24l5-7 5 3 6-11 5 3-7 14 M9 7h14', detail: 'M11 17l4-8 M6 24h20' },
  'auto-cannon': { contour: 'M3 10h25v3H3Z M3 15h25v3H3Z M10 18v8h12v-8 M7 26h18', detail: 'M12 7h8v3 M16 18v8' },
  'atgm-nest': { contour: 'M4 26h24 M6 15h20v11H6Z M9 13h14v3 M3 18h26', detail: 'M16 10v5 M12 20h8 M16 18v6' },
  'mortar-battery': { contour: 'M4 27h24 M7 22l11-14 5 4-10 13 M15 25h11', detail: 'M18 8l3-4 M22 12l4-3 M10 21l6 4' },
  'pulse-array': { contour: 'M5 27h22 M11 27V14h10v13 M8 13l8-9 8 9 M5 16l3-4 M27 16l-3-4', detail: 'M16 4v-2 M16 15v12 M11 20h10' },
  'rail-turret': { contour: 'M5 27h22 M12 27l2-21h4l2 21 M10 10h12 M9 17h14', detail: 'M16 6V2 M14 22h4 M7 20l4-3 M25 20l-4-3' },
  'graviton-well': { contour: 'M4 27h24 M8 27l4-14h8l4 14 M7 13l9-10 9 10 M11 19h10', detail: 'M16 3v-2 M13 13l3 5 3-5 M9 24h14' },
};

const SPECIAL_MARKS: Record<AgeId, Mark> = {
  stone: { contour: 'M4 25h24 M6 23l6-12 6 5 6-11 4 18 M9 18l5 4 M18 16l4 7', detail: 'M13 5l3 4 M23 3l3 2' },
  medieval: { contour: 'M6 5l5 20 M16 3v23 M26 5l-5 20 M5 21l6 4 2-6 M13 21l3 5 3-5 M19 19l2 6 6-4', detail: 'M11 9l3-4 M22 10l3-5' },
  gunpowder: { contour: 'M5 27h22 M8 20l6-9 6 9 M16 8l5-5 M7 7l4 3 M24 8l3 4', detail: 'M12 23h8 M16 11v12 M20 4l2 3' },
  modern: { contour: 'M4 17l10-4 3-9 3 9 10 4-10 2-3 9-3-9Z', detail: 'M8 26l3-4 M24 26l-3-4 M16 8v14' },
  future: { contour: 'M5 5h22 M9 9h14 M13 13h6 M16 14v14 M9 24l7 4 7-4', detail: 'M5 5l5 6 M27 5l-5 6 M13 18h6' },
};

function Insignia({ mark, size, className }: { mark: Mark; size: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path d={mark.contour} stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
      {mark.detail && <path d={mark.detail} stroke="currentColor" strokeWidth="1" opacity="0.7" />}
    </svg>
  );
}

export function UnitInsignia({ id, size = 32, className }: { id: string; size?: number; className?: string }) {
  return <Insignia mark={UNIT_MARKS[id] ?? UNIT_MARKS.clubman} size={size} className={className} />;
}

export function TurretInsignia({ id, size = 24, className }: { id: string; size?: number; className?: string }) {
  return <Insignia mark={TURRET_MARKS[id] ?? TURRET_MARKS['rock-chucker']} size={size} className={className} />;
}

export function SpecialInsignia({ age, size = 24, className }: { age: AgeId; size?: number; className?: string }) {
  return <Insignia mark={SPECIAL_MARKS[age]} size={size} className={className} />;
}
