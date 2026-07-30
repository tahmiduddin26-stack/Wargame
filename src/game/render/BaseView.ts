import Phaser from 'phaser';
import type { AgeDef, Faction } from '@/data/types';
import { VIEW, WORLD } from '@/game/config';
import type { Commander } from '@/game/sim/types';

const SLOT_Y = [-0.9, -0.78, -0.66, -0.54];

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
  private g: Phaser.GameObjects.Graphics;
  private mounts: Phaser.GameObjects.Graphics;
  private hpBack: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  private hpText: Phaser.GameObjects.Text;
  private ageRibbon: Phaser.GameObjects.Text;
  private x: number;
  private dir: number;
  private lastSignature = '';

  constructor(scene: Phaser.Scene, faction: Faction, x: number, age: AgeDef) {
    this.scene = scene;
    this.faction = faction;
    this.x = x;
    this.dir = faction === 'player' ? 1 : -1;

    this.g = scene.add.graphics().setDepth(-10);
    this.mounts = scene.add.graphics().setDepth(-9);

    const barW = 132;
    const barY = VIEW.groundY - WORLD.baseHeight - 30;
    this.hpBack = scene.add
      .rectangle(x, barY, barW, 9, 0x14110e)
      .setStrokeStyle(1, 0x000000, 0.6)
      .setDepth(20);
    this.hpFill = scene.add
      .rectangle(x - barW / 2, barY, barW, 9, faction === 'player' ? 0xd9a227 : 0xb04a3a)
      .setOrigin(0, 0.5)
      .setDepth(21);
    this.hpText = scene.add
      .text(x, barY - 15, '', {
        fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
        fontSize: '12px',
        color: '#e9e2d4',
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.ageRibbon = scene.add
      .text(x, barY + 16, '', {
        fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
        fontSize: '10px',
        color: '#9d9182',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.drawStructure(age);
  }

  /** Structure silhouette. Shape steps up with the age. */
  private drawStructure(age: AgeDef): void {
    const g = this.g;
    const H = WORLD.baseHeight;
    const halfW = WORLD.baseHalfWidth;
    const accent = Phaser.Display.Color.HexStringToColor(age.accent).color;
    const wall = this.faction === 'player' ? 0x554b3e : 0x4a3c3a;
    const dark = this.faction === 'player' ? 0x392f26 : 0x2f2523;

    g.clear();
    const left = this.x - halfW;
    const top = VIEW.groundY - H;

    // Main body.
    g.fillStyle(wall, 1);
    g.fillRect(left, top + H * 0.22, halfW * 2, H * 0.78);
    // Shadowed rear third, gives the block some form.
    g.fillStyle(dark, 1);
    g.fillRect(this.dir > 0 ? left : this.x, top + H * 0.22, halfW, H * 0.78);

    if (age.index === 0) {
      // Hide-and-timber lean-to.
      g.fillStyle(wall, 1);
      g.fillTriangle(left - 8, top + H * 0.24, this.x, top - 6, this.x + halfW + 8, top + H * 0.24);
    } else if (age.index === 1) {
      // Crenellated parapet.
      g.fillStyle(wall, 1);
      for (let i = 0; i < 5; i++) {
        g.fillRect(left + i * (halfW * 2 / 5), top + H * 0.1, halfW * 2 / 9, H * 0.14);
      }
      g.fillRect(left, top + H * 0.2, halfW * 2, H * 0.06);
    } else if (age.index === 2) {
      // Bastion with a sloped glacis.
      g.fillStyle(wall, 1);
      g.fillTriangle(left - 14, top + H * 0.26, left + 10, top + H * 0.06, left + 30, top + H * 0.26);
      g.fillRect(left, top + H * 0.16, halfW * 2, H * 0.1);
    } else if (age.index === 3) {
      // Reinforced concrete block with an antenna.
      g.fillStyle(wall, 1);
      g.fillRect(left - 6, top + H * 0.14, halfW * 2 + 12, H * 0.12);
      g.lineStyle(2, dark, 1);
      g.lineBetween(this.x + this.dir * 20, top + H * 0.14, this.x + this.dir * 26, top - 34);
    } else {
      // Shield pylons.
      g.fillStyle(accent, 0.85);
      g.fillRect(left + 4, top - 26, 6, H * 0.34);
      g.fillRect(this.x + halfW - 10, top - 26, 6, H * 0.34);
      g.fillStyle(wall, 1);
      g.fillRect(left - 4, top + H * 0.12, halfW * 2 + 8, H * 0.14);
    }

    // Gate mouth on the lane-facing side.
    g.fillStyle(0x1a1512, 1);
    const gateW = 26;
    const gx = this.dir > 0 ? this.x + halfW - gateW : this.x - halfW;
    g.fillRect(gx, VIEW.groundY - H * 0.36, gateW, H * 0.36);

    // Hazard chevrons at the gate. The one deliberate flourish.
    g.fillStyle(accent, 0.9);
    for (let i = 0; i < 3; i++) {
      const cy = VIEW.groundY - H * 0.34 + i * 9;
      g.fillRect(gx + 3, cy, gateW - 6, 3);
    }

    // Foundation line.
    g.fillStyle(dark, 1);
    g.fillRect(left - 10, VIEW.groundY - 4, halfW * 2 + 20, 8);

    this.ageRibbon.setText(age.name.toUpperCase().replace(' AGE', ''));
    this.ageRibbon.setColor(age.accent);
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
    this.hpFill.setFillStyle(ratio < 0.25 ? 0xd0452f : this.faction === 'player' ? 0xd9a227 : 0xb04a3a);
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
        // Sealed: hatched plate.
        g.lineStyle(1, 0x2b241d, 0.9);
        for (let k = -8; k <= 8; k += 4) {
          g.lineBetween(mx - 9 + k, my + 9, mx + 9 + k, my - 9);
        }
        continue;
      }

      if (!slot) {
        // Open mount: empty bracket.
        g.lineStyle(1, 0x6d6252, 0.9);
        g.strokeRect(mx - 9, my - 7, 18, 14);
        continue;
      }

      // Built. Barrel length hints at the role.
      const barrel = slot.def.role === 'marksman' ? 26 : slot.def.role === 'mortar' ? 12 : 18;
      const pitch = slot.def.role === 'mortar' ? -0.6 : -0.08;
      g.fillStyle(0x3d352b, 1);
      g.fillRect(mx - 10, my - 6, 20, 14);
      g.fillStyle(accent, 1);
      g.fillRect(mx - 8, my - 8, 16, 5);
      g.lineStyle(4, 0x2a241d, 1);
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
