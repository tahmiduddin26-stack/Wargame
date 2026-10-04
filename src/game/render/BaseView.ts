import Phaser from 'phaser';
import type { AgeDef, Faction } from '@/data/types';
import { armySkin, type ArmySkinId } from '@/data/cosmetics';
import { VIEW, WORLD } from '@/game/config';
import type { Commander } from '@/game/sim/types';

const SLOT_Y = [-0.9, -0.78, -0.66, -0.54];
const INK = 0x2d302e;
type Point = readonly [number, number];

function shape(g: Phaser.GameObjects.Graphics, points: readonly Point[], fill: number, width = 3): void {
  g.fillStyle(fill, 1);
  g.lineStyle(width, INK, 1);
  g.beginPath();
  g.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) g.lineTo(...points[i]);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

function sketch(g: Phaser.GameObjects.Graphics, points: readonly Point[], width = 2, alpha = 0.72): void {
  g.lineStyle(width, INK, alpha);
  g.beginPath();
  g.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) g.lineTo(...points[i]);
  g.strokePath();
}

/**
 * The gate: structure, four emplacement mounts and a structure bar. Redrawn on
 * evolve rather than swapped, so the same object carries through the match.
 *
 * Empty-but-unlocked mounts are drawn as an open bracket and sealed ones as a
 * hatched plate. A player should be able to glance at the enemy gate and count
 * how many guns are pointed at them.
 */
export class BaseView {
  private scene: Phaser.Scene;
  private faction: Faction;
  private skinId: ArmySkinId;
  private g: Phaser.GameObjects.Graphics;
  private mounts: Phaser.GameObjects.Graphics;
  private hpBack: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  private hpText: Phaser.GameObjects.Text;
  private ageRibbon: Phaser.GameObjects.Text;
  private x: number;
  private dir: number;
  private lastSignature = '';

  constructor(scene: Phaser.Scene, faction: Faction, x: number, age: AgeDef, skinId: ArmySkinId = 'field') {
    this.scene = scene;
    this.faction = faction;
    this.skinId = skinId;
    this.x = x;
    this.dir = faction === 'player' ? 1 : -1;

    // Every fort is drawn in local coordinates, then mirrored for the enemy.
    // Its door and gun mounts therefore always face the lane.
    this.g = scene.add.graphics().setPosition(x, VIEW.groundY).setScale(this.dir, 1).setDepth(-10);
    this.mounts = scene.add.graphics().setDepth(-9);

    const barW = 132;
    const barY = VIEW.groundY - WORLD.baseHeight - 30;
    this.hpBack = scene.add
      .rectangle(x, barY, barW, 9, 0xfff5da)
      .setStrokeStyle(2, 0x2d302e, 1)
      .setDepth(20);
    this.hpFill = scene.add
      .rectangle(x - barW / 2, barY, barW, 9, faction === 'player' ? 0xffc55c : 0x8ec9df)
      .setOrigin(0, 0.5)
      .setDepth(21);
    this.hpText = scene.add
      .text(x, barY - 15, '', {
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: '15px',
        color: '#2d302e',
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.ageRibbon = scene.add
      .text(x, barY + 16, '', {
        fontFamily: 'Patrick Hand, cursive',
        fontSize: '15px',
        color: '#394642',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.drawStructure(age);
  }

  /** Five hand-built silhouettes. None is a roofed house with a new prop on top. */
  private drawStructure(age: AgeDef): void {
    const g = this.g;
    const paint = armySkin(this.skinId);
    const accent = this.faction === 'player' && this.skinId !== 'field'
      ? paint.trim : Phaser.Display.Color.HexStringToColor(age.accent).color;
    const paper = this.faction === 'player' ? paint.fortPaper : 0xb6dce1;
    const mid = this.faction === 'player' ? paint.fortMid : 0x7eb7c6;
    const shade = this.faction === 'player' ? paint.fortShade : 0x5a8fa0;
    const light = this.faction === 'player' ? paint.fortLight : 0xe0f3ed;

    g.clear();
    // A faint pencil baseline keeps the paper-cut fort planted in the lane.
    sketch(g, [[-72, 1], [-29, 2], [26, 1], [70, 2]], 3, 0.62);

    if (age.index === 0) this.drawStone(g, paper, mid, shade, light, accent);
    else if (age.index === 1) this.drawMedieval(g, paper, mid, shade, light, accent);
    else if (age.index === 2) this.drawGunpowder(g, paper, mid, shade, light, accent);
    else if (age.index === 3) this.drawModern(g, paper, mid, shade, light, accent);
    else this.drawFuture(g, paper, mid, shade, light, accent);

    this.drawGate(g, age.index, accent);

    this.ageRibbon.setText(age.name.toUpperCase().replace(' AGE', ''));
    this.ageRibbon.setColor(age.accent);
  }

  private drawStone(g: Phaser.GameObjects.Graphics, paper: number, mid: number, shade: number, light: number, accent: number): void {
    // A rough palisade grows out of a heap of individually outlined rocks.
    for (const [x, y, h] of [[-49, -160, 92], [-31, -177, 107], [-11, -166, 93], [13, -181, 107], [34, -168, 102], [51, -154, 95]] as const) {
      shape(g, [[x - 8, y + h], [x - 8, y + 9], [x, y], [x + 8, y + 10], [x + 8, y + h]], mid, 2);
      sketch(g, [[x - 3, y + 22], [x - 2, y + 52]], 1, 0.42);
    }
    shape(g, [[-66, -2], [-62, -58], [-53, -78], [-32, -89], [-12, -82], [7, -97], [29, -88], [49, -78], [63, -52], [66, 0]], paper);
    for (const [x, y, w] of [[-48, -29, 31], [-25, -47, 29], [5, -37, 33], [31, -53, 30], [-41, -67, 23], [18, -75, 27]] as const) {
      g.fillStyle(x % 2 ? mid : light, 1);
      g.fillEllipse(x, y, w, 18);
      g.lineStyle(2, INK, 0.8);
      g.strokeEllipse(x, y, w, 18);
    }
    shape(g, [[-60, -90], [-52, -101], [45, -99], [53, -91], [51, -83], [-58, -82]], shade, 2);
    sketch(g, [[-55, -86], [-23, -87], [13, -86], [47, -88]], 1, 0.52);
    // Lashed cross brace and a deliberately crooked tribal mark.
    sketch(g, [[-46, -146], [-18, -91], [24, -146]], 3);
    sketch(g, [[-40, -126], [-33, -130], [-28, -124]], 2);
    shape(g, [[-58, -156], [-31, -149], [-56, -140]], accent, 2);
    sketch(g, [[-57, -156], [-57, -111]], 2);
  }

  private drawMedieval(g: Phaser.GameObjects.Graphics, paper: number, mid: number, shade: number, light: number, accent: number): void {
    // A crenellated keep, with a continuous broken wall instead of a roof.
    shape(g, [[-62, 0], [-58, -151], [-50, -153], [-50, -177], [-37, -178], [-36, -158], [-24, -158], [-23, -181], [-7, -180], [-7, -160], [7, -160], [8, -182], [25, -181], [25, -160], [38, -159], [39, -178], [55, -177], [55, -153], [61, -150], [63, 0]], paper);
    shape(g, [[-58, -128], [-40, -133], [44, -132], [60, -127], [60, -115], [-59, -116]], mid, 2);
    for (const y of [-111, -83, -54, -27]) {
      sketch(g, [[-56, y], [-22, y - 1], [12, y], [35, y - 1]], 1, 0.48);
    }
    for (const [x, y] of [[-34, -110], [4, -110], [32, -83], [-19, -82], [8, -54], [-38, -26], [22, -26]] as const) {
      sketch(g, [[x, y], [x + 1, y + 18]], 1, 0.45);
    }
    shape(g, [[-39, -154], [-39, -186], [-34, -188], [-34, -155]], shade, 2);
    shape(g, [[-34, -186], [-3, -178], [-32, -168]], accent, 2);
    // Narrow arrow slit, plus small pencil imperfections in the masonry.
    shape(g, [[-31, -100], [-28, -108], [-25, -100], [-25, -69], [-31, -69]], shade, 2);
    sketch(g, [[-49, -142], [-44, -145], [-39, -142]], 1);
    sketch(g, [[8, -145], [16, -148]], 1);
    g.fillStyle(light, 1);
    g.fillCircle(-48, -42, 3);
  }

  private drawGunpowder(g: Phaser.GameObjects.Graphics, paper: number, mid: number, shade: number, light: number, accent: number): void {
    // Low earthen rampart and a separate timber gun post: no castle-height wall.
    shape(g, [[-69, 0], [-63, -61], [-53, -87], [24, -86], [31, -101], [32, -164], [39, -174], [53, -174], [60, -160], [60, -103], [66, -85], [69, 0]], paper);
    shape(g, [[-69, 0], [-63, -61], [-53, -87], [-40, -84], [-34, 0]], mid, 2);
    shape(g, [[-53, -87], [26, -87], [31, -100], [26, -106], [-52, -105], [-58, -97]], shade, 2);
    // Staggered sandbags make the low defensive line readable in silhouette.
    for (const [x, y] of [[-43, -105], [-22, -105], [0, -105], [19, -105], [-32, -116], [-10, -116], [11, -116]] as const) {
      g.fillStyle((x + y) % 2 ? light : mid, 1);
      g.fillEllipse(x, y, 22, 12);
      g.lineStyle(2, INK, 0.9);
      g.strokeEllipse(x, y, 22, 12);
    }
    shape(g, [[31, -101], [32, -164], [39, -174], [53, -174], [60, -160], [60, -103]], mid, 2);
    sketch(g, [[34, -108], [57, -157]], 2, 0.6);
    sketch(g, [[56, -108], [34, -157]], 2, 0.6);
    sketch(g, [[32, -164], [60, -164]], 3);
    // Short cannon on the post, with a powder barrel tucked behind the bank.
    shape(g, [[23, -173], [30, -179], [56, -179], [66, -174], [56, -168], [31, -168]], shade, 2);
    sketch(g, [[26, -176], [52, -176]], 1, 0.6);
    shape(g, [[-46, -14], [-48, -43], [-38, -51], [-23, -49], [-20, -15]], shade, 2);
    sketch(g, [[-47, -31], [-21, -32]], 2);
    sketch(g, [[-46, -42], [-24, -42]], 2);
    shape(g, [[-60, -132], [-34, -127], [-58, -116]], accent, 2);
    sketch(g, [[-59, -132], [-59, -90]], 2);
  }

  private drawModern(g: Phaser.GameObjects.Graphics, paper: number, mid: number, shade: number, light: number, accent: number): void {
    // A low concrete pillbox and a narrow observation tower on the lane side.
    shape(g, [[-68, 0], [-67, -68], [-58, -88], [15, -88], [24, -104], [30, -156], [37, -169], [55, -169], [62, -151], [62, -87], [68, -67], [68, 0]], paper);
    shape(g, [[-68, 0], [-67, -68], [-58, -88], [-41, -88], [-42, 0]], mid, 2);
    shape(g, [[-59, -87], [16, -87], [25, -105], [19, -115], [-54, -115], [-64, -104]], shade, 2);
    shape(g, [[-43, -103], [5, -103], [7, -96], [-44, -96]], INK, 1);
    shape(g, [[29, -157], [37, -169], [55, -169], [62, -151], [60, -94], [27, -94]], mid, 2);
    shape(g, [[34, -153], [53, -153], [55, -139], [32, -139]], INK, 1);
    sketch(g, [[32, -162], [57, -161]], 2);
    // A field radio and a small dish break the bunker outline at the rear.
    sketch(g, [[-23, -115], [-22, -166]], 2);
    sketch(g, [[-36, -159], [-22, -169], [-8, -159]], 3);
    sketch(g, [[-32, -158], [-21, -162], [-12, -158]], 1);
    g.fillStyle(accent, 1);
    g.fillCircle(-22, -169, 3);
    // Brush-like camo swipes and concrete joints stay below the observation slit.
    sketch(g, [[-31, -72], [-22, -78], [-9, -73]], 5, 0.42);
    sketch(g, [[-28, -50], [-13, -55]], 5, 0.42);
    sketch(g, [[-26, -27], [-18, -32], [-9, -28]], 4, 0.42);
    sketch(g, [[5, -88], [6, -57]], 1, 0.5);
    for (const [x, y] of [[-55, -98], [13, -98], [32, -125], [56, -125]] as const) {
      g.fillStyle(light, 1);
      g.fillCircle(x, y, 2.5);
      g.lineStyle(1, INK, 0.75);
      g.strokeCircle(x, y, 2.5);
    }
  }

  private drawFuture(g: Phaser.GameObjects.Graphics, paper: number, mid: number, shade: number, light: number, accent: number): void {
    // Open shield frame and a hand-inked energy core, with no solid roof.
    shape(g, [[-67, 0], [-65, -81], [-58, -111], [-52, -106], [-44, -35], [-35, -17], [36, -17], [51, -49], [57, -119], [63, -109], [68, -74], [69, 0]], mid);
    shape(g, [[-56, -110], [-48, -173], [-32, -180], [-25, -171], [-38, -74]], paper);
    shape(g, [[47, -173], [57, -117], [47, -70], [34, -76], [34, -169]], paper);
    shape(g, [[-46, -31], [45, -31], [53, -16], [49, 0], [-52, 0]], shade, 2);
    g.fillStyle(light, 1);
    g.fillCircle(0, -106, 37);
    g.lineStyle(3, INK, 0.9);
    g.strokeCircle(0, -106, 37);
    g.lineStyle(2, accent, 1);
    g.strokeCircle(0, -106, 29);
    shape(g, [[-4, -128], [15, -109], [3, -88], [-16, -103]], accent, 2);
    sketch(g, [[-58, -141], [-68, -153], [-61, -167]], 2);
    sketch(g, [[43, -177], [55, -187], [61, -175]], 2);
    sketch(g, [[-25, -63], [-13, -56], [10, -58], [25, -64]], 2, 0.6);
  }

  private drawGate(g: Phaser.GameObjects.Graphics, ageIndex: number, accent: number): void {
    // The opening keeps the same hit edge but changes material with the age.
    if (ageIndex === 0) {
      shape(g, [[35, 0], [36, -39], [40, -51], [48, -57], [59, -52], [65, -38], [66, 0]], 0x554c40, 3);
      sketch(g, [[37, -55], [44, -63], [54, -64], [64, -55]], 3);
      sketch(g, [[40, -3], [41, -37], [45, -47]], 2, 0.6);
    } else if (ageIndex === 1) {
      shape(g, [[36, 0], [36, -51], [42, -62], [51, -68], [61, -62], [65, -51], [65, 0]], INK, 2);
      shape(g, [[40, 0], [40, -48], [45, -57], [51, -60], [60, -54], [61, -47], [61, 0]], 0x665845, 1);
      for (const x of [44, 51, 58]) sketch(g, [[x, -55], [x, -2]], 2, 0.8);
      sketch(g, [[40, -31], [61, -31]], 2);
    } else if (ageIndex === 2) {
      shape(g, [[37, 0], [37, -57], [63, -57], [63, 0]], 0x594b3c, 2);
      for (const y of [-47, -31, -15]) sketch(g, [[39, y], [62, y]], 2, 0.65);
      sketch(g, [[38, -54], [62, -3]], 3);
      g.fillStyle(accent, 1);
      g.fillCircle(58, -29, 2.5);
    } else if (ageIndex === 3) {
      shape(g, [[35, 0], [35, -60], [64, -60], [64, 0]], INK, 2);
      shape(g, [[39, -2], [39, -55], [60, -55], [60, -2]], 0x61716c, 1);
      for (const y of [-42, -29, -16]) sketch(g, [[41, y], [58, y]], 2, 0.9);
      shape(g, [[40, -50], [45, -50], [58, -34], [58, -28]], accent, 1);
    } else {
      shape(g, [[34, 0], [35, -61], [42, -71], [57, -70], [65, -59], [66, 0]], INK, 2);
      shape(g, [[40, -1], [41, -57], [47, -63], [55, -62], [60, -55], [61, -1]], accent, 1);
      sketch(g, [[48, -59], [48, -5]], 1, 0.55);
      sketch(g, [[55, -59], [55, -5]], 1, 0.55);
    }
  }

  sync(c: Commander, age: AgeDef): void {
    // Only redraw the structure when something structural actually changed.
    const signature = `${age.index}|${c.unlockedSlots}|${c.slots.map((s) => s?.def.id ?? '-').join(',')}`;
    if (signature !== this.lastSignature) {
      if (!this.lastSignature.startsWith(`${age.index}|`)) this.drawStructure(age);
      this.drawMounts(c, age);
      this.lastSignature = signature;
    }

    const ratio = Phaser.Math.Clamp(c.baseHp / c.baseMaxHp, 0, 1);
    this.hpFill.width = this.hpBack.width * ratio;
    this.hpText.setText(`${Math.ceil(Math.max(0, c.baseHp))}`);
    // Critical structure goes red on both sides: that is danger, not identity.
    this.hpFill.setFillStyle(
      ratio < 0.25 ? 0xd45b4a : this.faction === 'player' ? 0xffc55c : 0x8ec9df,
    );
  }

  private drawMounts(c: Commander, age: AgeDef): void {
    const g = this.mounts;
    const H = WORLD.baseHeight;
    const accent = Phaser.Display.Color.HexStringToColor(age.accent).color;
    g.clear();

    for (let i = 0; i < c.slots.length; i++) {
      const mx = this.x + this.dir * (WORLD.baseHalfWidth - 16 - i * 2);
      const my = VIEW.groundY + SLOT_Y[i] * H;
      const slot = c.slots[i];

      if (i >= c.unlockedSlots) {
        // Sealed plate, with short pencil hatches contained inside its frame.
        g.fillStyle(0xfff5da, 0.55);
        g.fillRect(mx - 8, my - 8, 16, 16);
        g.lineStyle(1.5, INK, 0.85);
        g.strokeRect(mx - 8, my - 8, 16, 16);
        for (const k of [-4, 0, 4]) g.lineBetween(mx + k - 3, my + 5, mx + k + 3, my - 5);
        continue;
      }

      if (!slot) {
        // Open mount: empty bracket.
        g.lineStyle(2, 0x2d302e, 0.9);
        g.strokeRect(mx - 9, my - 7, 18, 14);
        continue;
      }

      // Built. Barrel length hints at the role.
      const barrel = slot.def.role === 'marksman' ? 26 : slot.def.role === 'mortar' ? 12 : 18;
      const pitch = slot.def.role === 'mortar' ? -0.6 : -0.08;
      g.fillStyle(0x2d302e, 1);
      g.fillRect(mx - 10, my - 6, 20, 14);
      g.fillStyle(accent, 1);
      g.fillRect(mx - 8, my - 8, 16, 5);
      g.lineStyle(4, 0x2d302e, 1);
      g.lineBetween(
        mx,
        my - 3,
        mx + this.dir * barrel * Math.cos(pitch),
        my - 3 + barrel * Math.sin(pitch),
      );
    }
  }

  /** Called on evolve so the silhouette changes with the era. */
  refreshAge(age: AgeDef): void {
    this.drawStructure(age);
    this.lastSignature = '';
  }

  flash(): void {
    this.scene.tweens.add({
      targets: this.g,
      alpha: { from: 0.45, to: 1 },
      duration: 110,
    });
  }

  destroy(): void {
    this.g.destroy();
    this.mounts.destroy();
    this.hpBack.destroy();
    this.hpFill.destroy();
    this.hpText.destroy();
    this.ageRibbon.destroy();
  }
}
