/** Visual-only army paints. They never enter BattleSim or the server protocol. */
export type ArmySkinId = 'field' | 'ember' | 'goldleaf' | 'iron';

export interface ArmySkin {
  id: ArmySkinId;
  name: string;
  note: string;
  cost: number;
  cloth: number;
  trim: number;
  metal: number;
  dark: number;
  fortPaper: number;
  fortMid: number;
  fortShade: number;
  fortLight: number;
}

export const ARMY_SKINS: readonly ArmySkin[] = [
  {
    id: 'field', name: 'Field Notes', note: 'The original warm-paper army.', cost: 0,
    cloth: 0xdc8955, trim: 0xe8a745, metal: 0xc7b88f, dark: 0x58463e,
    fortPaper: 0xf5d58c, fortMid: 0xe5aa67, fortShade: 0xba7952, fortLight: 0xffeabc,
  },
  {
    id: 'ember', name: 'Ember March', note: 'Red coats and smoke-stained ramparts.', cost: 220,
    cloth: 0xc75e4d, trim: 0xffce74, metal: 0xc9ad8c, dark: 0x633d38,
    fortPaper: 0xf3c9aa, fortMid: 0xd87962, fortShade: 0x9f5549, fortLight: 0xffe6c9,
  },
  {
    id: 'goldleaf', name: 'Goldleaf', note: 'Sunny flags and gilded armour.', cost: 450,
    cloth: 0xd3a541, trim: 0xffe18a, metal: 0xd8bb65, dark: 0x64503b,
    fortPaper: 0xf5dfa1, fortMid: 0xdcb55c, fortShade: 0xa37b42, fortLight: 0xfff0bf,
  },
  {
    id: 'iron', name: 'Black Iron', note: 'Charcoal kit with bright copper marks.', cost: 800,
    cloth: 0x625650, trim: 0xffae56, metal: 0x9c9080, dark: 0x393835,
    fortPaper: 0xb9a58c, fortMid: 0x806c60, fortShade: 0x574b45, fortLight: 0xd8c6a6,
  },
];

export const ARMY_SKIN_BY_ID: Record<ArmySkinId, ArmySkin> = Object.fromEntries(
  ARMY_SKINS.map((skin) => [skin.id, skin]),
) as Record<ArmySkinId, ArmySkin>;

export function armySkin(id: ArmySkinId): ArmySkin {
  return ARMY_SKIN_BY_ID[id] ?? ARMY_SKIN_BY_ID.field;
}
