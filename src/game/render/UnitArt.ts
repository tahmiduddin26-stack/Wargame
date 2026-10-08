import type Phaser from 'phaser';
import { AGES } from '@/data/ages';
import { UNITS } from '@/data/units';
import type { Faction, UnitDef } from '@/data/types';
import type { ArmySkinId } from '@/data/cosmetics';
import { palette, skeletonFor, type BoneSpec, type TintRole } from './skeleton';

const INK = '#30332f';
const PAPER = '#f7e6bf';
const WOOD = '#af794a';
const STEEL = '#b5bcb5';
const GLOW = '#a6e6da';
const TILE = 128;
const COLUMNS = 16;
/** Transparent padding leaves room for weapons without enlarging body hitboxes. */
const FRAME_HEIGHT = 1.6;
type Colours = Record<TintRole, string>;
type Point = readonly [number, number];

/** A little more presence on a phone; combat dimensions and balance stay in UnitDef. */
export function visualHeight(def: UnitDef): number { return def.height * 1.35; }

/** Hand-authored paths, not generated bitmaps. Paint once, batch every limb thereafter. */
class Pen {
  constructor(readonly c: CanvasRenderingContext2D) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
  }
  shape(points: readonly Point[], fill: string, width = 3.7): void {
    const c = this.c;
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath(); c.fillStyle = fill; c.fill();
    c.strokeStyle = INK; c.lineWidth = width; c.stroke();
  }
  ellipse(x: number, y: number, rx: number, ry: number, fill: string, width = 3.7): void {
    const c = this.c;
    c.beginPath(); c.ellipse(x, y, rx, ry, -0.04, 0, Math.PI * 2);
    c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = width; c.stroke();
  }
  line(points: readonly Point[], colour = INK, width = 2.4): void {
    const c = this.c;
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = colour; c.lineWidth = width; c.stroke();
  }
  round(x: number, y: number, w: number, h: number, fill: string, radius = 4): void {
    const c = this.c;
    c.beginPath(); c.roundRect(x, y, w, h, radius);
    c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = 3.7; c.stroke();
  }
}

function face(p: Pen, b: BoneSpec, def: UnitDef, col: Colours): void {
  const w = b.w * 100, h = b.h * 100;
  const stone = def.age === 'stone';
  p.ellipse(0, 0, w / 2, h / 2, col.skin);
  p.ellipse(w * 0.47, 2, 3.2, 4, col.skin, 2.2);
  // Wide, round heads and two bold brow/eye marks survive downscaling.
  p.line([[5, -2], [5, 5]], INK, 3);
  p.line([[13, -3], [13, 4]], INK, 3);
  p.line([[2, -8], [7, -5]], INK, 2.8);
  p.line([[11, -6], [16, -9]], INK, 2.8);
  if (stone) {
    p.shape([[-20, 3], [-23, -12], [-17, -12], [-20, -23], [-10, -17], [-7, -27],
      [-1, -20], [6, -27], [6, -19], [17, -23], [13, -15], [22, -16], [15, -8],
      [2, -15], [-11, -10], [-13, 4]], col.dark, 3);
    if (def.id === 'slinger') p.line([[-19, -8], [2, -15], [17, -11]], col.cloth, 4);
  } else if (def.id === 'longbowman') {
    p.shape([[-23, -5], [-17, -21], [13, -22], [22, -8], [4, -12]], col.cloth);
    p.line([[-11, -20], [-17, -31], [-8, -29]], PAPER, 3);
  } else if (def.age === 'medieval' || def.id === 'cuirassier') {
    p.shape([[-23, -3], [-19, -21], [0, -28], [18, -17], [20, -6], [2, -12]],
      def.id === 'knight' || def.id === 'cuirassier' ? STEEL : col.cloth);
    p.line([[-16, -13], [-1, -21], [12, -16]], PAPER, 2);
    if (def.id === 'knight' || def.id === 'cuirassier') {
      p.shape([[-22, -4], [-13, -8], [-10, 10], [-18, 14]], STEEL, 2.5);
      p.line([[-5, -25], [0, -32], [13, -30]], col.cloth, 5);
    }
  } else if (def.age === 'gunpowder') {
    if (def.id === 'grenadier') {
      p.round(-18, -31, 35, 24, col.dark, 6);
      p.ellipse(0, -19, 4, 5, col.trim, 2);
    } else {
      p.shape([[-26, -6], [-16, -25], [1, -17], [20, -26], [24, -7], [1, -11]], col.dark);
      p.line([[-18, -13], [1, -18], [18, -13]], col.trim, 2.5);
    }
  } else if (def.age === 'modern') {
    p.shape([[-23, -2], [-20, -19], [-9, -26], [9, -24], [20, -14], [25, -3]], col.cloth);
    p.line([[-16, -16], [-7, -21], [8, -19]], col.trim, 2);
    p.line([[-18, 3], [-12, 12], [-2, 16]], col.dark, 2);
  } else {
    p.shape([[-23, 3], [-22, -17], [-10, -26], [15, -24], [24, -13], [24, 12],
      [7, 21], [-11, 19]], col.metal);
    p.round(-3, -10, 28, 13, col.dark, 3);
    p.line([[2, -4], [18, -5]], GLOW, 3.2);
    p.line([[-17, 4], [-8, 5]], col.cloth, 5);
  }
}

function torso(p: Pen, b: BoneSpec, def: UnitDef, col: Colours): void {
  const w = b.w * 50, h = b.h * 50;
  const stone = def.age === 'stone';
  p.shape([[-w + 3, -h], [w - 3, -h + 1], [w + 4, h - 2],
    [w * 0.3, h - (stone ? 5 : 0)], [-2, h + 3], [-w - 3, h]], col.cloth);
  if (stone) {
    p.ellipse(-6, 0, 3.1, 4, col.dark, 1.2);
    p.ellipse(7, 7, 3.6, 3, col.dark, 1.2);
    p.line([[-w + 4, -h + 4], [w - 3, h - 4]], col.dark, 2);
  } else if (def.id === 'knight' || def.id === 'cuirassier' || def.age === 'future') {
    p.shape([[-w + 2, -h + 3], [w - 2, -h + 3], [w - 4, 4], [1, h - 3], [-w + 4, 5]],
      def.age === 'future' ? col.metal : STEEL, 2.7);
    p.line([[0, -h + 5], [2, h - 4]], INK, 1.6);
    p.line([[-w + 6, -h + 7], [-w + 5, -2]], PAPER, 1.8);
    if (def.age === 'future') p.line([[-6, -4], [6, -4]], GLOW, 4);
  } else {
    if (def.age === 'gunpowder') {
      p.line([[-w + 4, -h + 2], [w - 2, h - 4]], PAPER, 4.5);
      p.line([[w - 4, -h + 3], [-w + 4, h - 4]], PAPER, 4.5);
    } else if (def.age === 'modern') {
      p.round(-w + 3, -h + 4, w * 2 - 6, h * 1.35, col.dark, 3);
      p.round(-w + 5, 1, w - 7, 7, col.cloth, 1.5);
      p.round(3, 1, w - 7, 7, col.cloth, 1.5);
    } else p.line([[-w + 3, 1], [w, 2]], col.dark, 3);
    p.ellipse(1, 2, 2.4, 2.4, col.trim, 1.2);
  }
  p.line([[-w + 2, h - 5], [-w + 7, h - 9]], INK, 1.2);
}

function weapon(p: Pen, def: UnitDef, col: Colours): void {
  // Each weapon is part of the hand's atlas frame: swings and ragdolls keep it attached.
  switch (def.id) {
    case 'clubman': case 'dino-rider':
      p.shape([[11, 5], [23, -29], [20, -34], [25, -43], [31, -40], [36, -47],
        [43, -41], [39, -34], [44, -31], [28, -21], [16, 8]], WOOD);
      p.line([[29, -32], [35, -40]], INK, 1.7); break;
    case 'slinger':
      p.line([[13, 2], [26, -28], [43, -36], [25, -18], [13, 2]], INK, 2.5);
      p.ellipse(43, -36, 6, 4, '#99988b', 2.2); break;
    case 'spearman':
      p.line([[10, 24], [23, -50]], WOOD, 5);
      p.shape([[18, -47], [26, -62], [29, -45]], STEEL, 2.8); break;
    case 'longbowman': {
      const c = p.c;
      c.beginPath(); c.moveTo(22, -40); c.quadraticCurveTo(51, -9, 22, 22);
      c.strokeStyle = INK; c.lineWidth = 5; c.stroke();
      c.strokeStyle = WOOD; c.lineWidth = 2; c.stroke();
      p.line([[22, -40], [17, -7], [22, 22]], PAPER, 1.6);
      p.line([[3, -7], [53, -7]], INK, 2.3);
      p.shape([[52, -11], [60, -7], [51, -3]], STEEL, 1.7); break;
    }
    case 'knight': case 'cuirassier':
      p.shape([[12, 3], [16, -41], [21, -53], [26, -39], [20, 4]], STEEL, 3.3);
      p.line([[21, -41], [18, -1]], PAPER, 1.5);
      p.line([[7, 3], [27, 5]], col.trim, 5);
      p.line([[16, 7], [15, 18]], col.dark, 5); break;
    case 'grenadier':
      p.ellipse(20, -14, 9, 10, col.dark, 3);
      p.line([[22, -23], [25, -29], [31, -28]], WOOD, 2.5);
      p.line([[31, -33], [31, -29], [35, -31]], col.trim, 2); break;
    default: {
      const future = def.age === 'future';
      const long = def.id === 'railgunner' || def.id === 'musketeer';
      p.shape([[-6, 7], [3, -5], [26, -7], [29, -2], [long ? 61 : 49, -2],
        [long ? 61 : 49, 4], [26, 6], [22, 13], [12, 11], [10, 4]],
        future ? col.metal : col.dark, 3.1);
      if (def.id === 'musketeer') {
        p.line([[-5, 7], [22, 3]], WOOD, 4);
        p.shape([[55, -2], [73, 0], [55, 3]], STEEL, 1.4);
      } else if (future) {
        p.line([[27, 0], [long ? 55 : 43, 0]], GLOW, 3);
        p.round(8, -13, 14, 7, col.dark, 2);
      } else if (def.id === 'machine-gunner') {
        p.round(10, 6, 15, 12, col.trim, 2);
        p.line([[30, -3], [30, -9], [37, -9]], INK, 2);
      }
    }
  }
}

function limb(p: Pen, b: BoneSpec, def: UnitDef, col: Colours): void {
  const w = b.w * 50, h = b.h * 50;
  const leg = b.name.startsWith('leg');
  const mount = def.id === 'dino-rider' || def.id === 'cuirassier';
  if (leg) {
    const bare = def.age === 'stone' && def.id !== 'assault-mech';
    p.shape([[-w + 1, -h], [w - 1, -h], [w + 2, 2], [w - 1, h - 2],
      [-w, h - 1], [-w - 2, 2]], mount ? (def.id === 'dino-rider' ? '#819369' : WOOD) : bare ? col.skin : col.dark);
    p.shape([[-w - 1, h - 5], [w - 1, h - 6], [w + 10, h - 2], [w + 11, h + 3],
      [-w - 2, h + 3]], bare && !mount ? col.skin : col.dark, 3);
    if (def.age === 'future') p.round(-w, -h + 2, w * 2, h, col.metal, 2);
    return;
  }
  const front = b.name === 'armFront';
  if (front) weapon(p, def, col);
  p.shape([[-w, -h], [w, -h + 1], [w + 2, 2], [14, 0], [16, 8], [w - 1, 13],
    [-w - 1, 6]], def.age === 'stone' ? col.skin : col.cloth, 3.1);
  if (def.age !== 'stone') p.ellipse(12, 5, 5.4, 5.2, col.skin, 2.5);
  if (!front && (def.id === 'knight' || def.id === 'spearman')) {
    p.ellipse(-5, 9, 14, 18, WOOD, 3.7);
    p.line([[-11, -2], [-14, 18]], INK, 1.5);
    p.line([[0, -5], [-4, 24]], INK, 1.5);
    p.ellipse(-5, 9, 2.5, 3, col.trim, 1.2);
  }
}

function mount(p: Pen, def: UnitDef, col: Colours): void {
  const dino = def.id === 'dino-rider';
  const hide = dino ? '#8c9d72' : WOOD;
  p.shape([[-38, -8], [-59, -12], [-49, 8], [-30, 17], [-17, 21], [26, 17],
    [38, 2], [39, -16], [56, -20], [66, -12], [59, 2], [46, 5], [31, -20],
    [-10, -22]], hide);
  if (dino) {
    p.shape([[-35, -15], [-28, -28], [-19, -20], [-12, -30], [-5, -21], [2, -29], [10, -20]], col.dark, 2);
    p.line([[54, -5], [62, -5]], INK, 2);
  } else {
    p.shape([[27, -14], [30, -36], [37, -26], [46, -32], [43, -18]], hide, 2.7);
    p.line([[30, -18], [26, -9], [28, 2]], col.dark, 5);
    p.line([[-38, -10], [-51, -8], [-56, 10]], col.dark, 6);
    p.line([[44, -16], [51, -1], [61, -5]], col.dark, 2);
  }
  p.ellipse(55, -13, 1.9, 2.5, INK, 0);
  p.shape([[-19, -17], [18, -17], [16, 9], [-19, 9]], col.cloth, 2.7);
  p.line([[-20, -9], [15, -8]], col.trim, 3);
}

function vehicle(p: Pen, b: BoneSpec, def: UnitDef, col: Colours): void {
  const siege = def.id === 'boulder-hurler' || def.id === 'trebuchet';
  const cannon = def.id === 'field-cannon';
  const future = def.age === 'future';
  if (b.name.startsWith('wheel')) {
    const r = b.w * 50;
    p.ellipse(0, 0, r, r, siege || cannon ? WOOD : col.dark);
    p.ellipse(0, 0, r * 0.62, r * 0.62, siege || cannon ? '#947052' : col.metal, 2);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.2;
      p.line([[0, 0], [Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8]], INK, 1.8);
    }
    p.ellipse(0, 0, 3, 3, col.trim, 1.5); return;
  }
  if (b.name === 'hull') {
    p.shape([[-47, -11], [35, -13], [48, -1], [45, 15], [-45, 16]], siege || cannon ? WOOD : col.cloth);
    p.line([[-37, -4], [31, -5]], siege ? col.cloth : col.trim, 4);
    p.line([[-37, 7], [-15, 6]], INK, 1.8);
    if (def.id === 'battle-tank') p.round(-46, 10, 92, 17, col.dark, 7);
    if (future) p.line([[-25, 4], [23, 4]], GLOW, 3);
    return;
  }
  if (b.name === 'cabin') {
    if (def.id === 'trebuchet') {
      p.shape([[-25, 18], [1, -43], [27, 18], [15, 18], [1, -14], [-14, 18]], WOOD, 3.3);
      p.ellipse(1, -25, 5, 5, col.trim, 2);
    } else if (def.id === 'boulder-hurler') {
      p.shape([[-22, 20], [-16, -5], [9, -9], [14, 20]], col.cloth, 3);
      p.ellipse(-3, -22, 15, 14, col.skin, 3);
      p.shape([[-19, -24], [-15, -37], [-5, -33], [3, -38], [13, -28], [0, -31]], col.dark, 2.5);
      p.line([[2, -24], [2, -19]], INK, 2.5);
      p.line([[8, -25], [8, -20]], INK, 2.5);
      p.line([[6, 2], [24, -12]], col.skin, 6);
    } else if (def.id === 'rocket-truck') {
      p.shape([[18, -22], [38, -20], [52, -6], [51, 16], [18, 16]], col.cloth);
      p.shape([[23, -16], [36, -15], [43, -7], [23, -5]], '#cfe2dc', 2);
      p.line([[25, 4], [32, 4]], INK, 2);
    } else {
      p.shape([[-20, 13], [-17, -10], [6, -18], [23, -8], [24, 13]], cannon ? col.dark : col.metal);
      p.line([[-9, -5], [10, -6]], future ? GLOW : col.cloth, future ? 6 : 4);
      if (future) p.ellipse(0, -3, 8, 8, GLOW, 2.5);
    }
    return;
  }
  if (siege) {
    p.shape([[-43, 14], [15, -47], [21, -43], [-34, 22]], WOOD, 3.6);
    p.line([[-36, 14], [-47, 0], [-49, -15]], INK, 2);
    p.shape([[-55, -20], [-44, -24], [-37, -15], [-43, -7], [-54, -9]], '#aaa293', 2.8);
    p.round(7, -49, 19, 16, col.cloth, 2);
  } else if (def.id === 'rocket-truck') {
    for (let i = 0; i < 3; i++) {
      const y = i * 9;
      p.shape([[-43, 5 + y], [-6, -22 + y], [0, -17 + y], [-36, 11 + y]], col.dark, 2.5);
      p.shape([[-8, -23 + y], [1, -26 + y], [0, -15 + y]], col.trim, 1.8);
    }
  } else {
    p.shape([[-26, -8], [24, -6], [26, -10], [40, -10], [40, 7], [25, 8], [23, 4], [-26, 6]],
      cannon ? col.dark : col.metal, 3.7);
    if (future) for (const x of [-15, -2, 11, 28]) p.round(x, -11, 6, 21, GLOW, 2);
    else p.line([[-18, -4], [19, -3]], STEEL, 1.8);
  }
}

function paintPart(c: CanvasRenderingContext2D, b: BoneSpec, def: UnitDef, col: Colours): void {
  const p = new Pen(c);
  if (b.name === 'head') face(p, b, def, col);
  else if (b.name === 'torso') torso(p, b, def, col);
  else if (b.name.startsWith('leg') || b.name.startsWith('arm')) limb(p, b, def, col);
  else if (b.name === 'hull' && (def.id === 'dino-rider' || def.id === 'cuirassier')) mount(p, def, col);
  else vehicle(p, b, def, col);
}

/** One ~8 MB atlas per paint, shared by living soldiers and their corpses. */
function ensureAtlas(scene: Phaser.Scene, faction: Faction, skin: ArmySkinId): string {
  const key = `doodle-army-${faction === 'enemy' ? 'enemy' : skin}`;
  if (scene.textures.exists(key)) return key;
  const parts = UNITS.flatMap((def) => skeletonFor(def).bones.map((bone) => ({ def, bone })));
  const texture = scene.textures.createCanvas(key, COLUMNS * TILE, Math.ceil(parts.length / COLUMNS) * TILE);
  if (!texture) throw new Error(`Unable to create unit atlas ${key}`);
  const c = texture.context;
  parts.forEach(({ def, bone }, i) => {
    const x = (i % COLUMNS) * TILE, y = Math.floor(i / COLUMNS) * TILE;
    const accent = Number.parseInt(AGES.find((age) => age.id === def.age)!.accent.slice(1), 16);
    const colours = palette(faction, accent, skin);
    const col = Object.fromEntries(Object.entries(colours).map(([role, colour]) => [role, `#${colour.toString(16).padStart(6, '0')}`])) as Colours;
    c.save();
    c.beginPath(); c.rect(x + 1, y + 1, TILE - 2, TILE - 2); c.clip();
    c.translate(x + TILE / 2, y + TILE / 2);
    c.scale(TILE / (FRAME_HEIGHT * 100), TILE / (FRAME_HEIGHT * 100));
    paintPart(c, bone, def, col);
    c.restore();
    texture.add(`${def.id}:${bone.name}`, 0, x, y, TILE, TILE);
  });
  texture.refresh();
  return key;
}

export function unitImage(scene: Phaser.Scene, def: UnitDef, bone: BoneSpec, faction: Faction,
  skin: ArmySkinId = 'field'): Phaser.GameObjects.Image {
  const key = ensureAtlas(scene, faction, skin);
  const size = FRAME_HEIGHT * visualHeight(def);
  return scene.add.image(0, 0, key, `${def.id}:${bone.name}`).setDisplaySize(size, size);
}
