import Phaser from 'phaser';
import type { AgeDef } from '@/data/types';
import { VIEW } from '@/game/config';
import { Rng } from '@/game/sim/rng';

/** A bright, doodled battlefield with a surveyed ground strip. */
export class Backdrop {
  private sky: Phaser.GameObjects.Graphics;
  private far: Phaser.GameObjects.Graphics;
  private mid: Phaser.GameObjects.Graphics;
  private ground: Phaser.GameObjects.Graphics;
  private markers: Phaser.GameObjects.Text[] = [];
  private laneLength: number;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, laneLength: number, age: AgeDef) {
    this.scene = scene;
    this.laneLength = laneLength;

    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(-60);
    this.far = scene.add.graphics().setScrollFactor(0.2).setDepth(-50);
    this.mid = scene.add.graphics().setScrollFactor(0.55).setDepth(-40);
    this.ground = scene.add.graphics().setDepth(-30);

    this.drawMarkers();
    this.setAge(age);
  }

  /** Retints every band. Called on evolve so the era shift is visible. */
  setAge(age: AgeDef): void {
    const [top, bottom] = age.skyline;
    const topC = Phaser.Display.Color.HexStringToColor(top).color;
    const botC = Phaser.Display.Color.HexStringToColor(bottom).color;
    const groundC = Phaser.Display.Color.HexStringToColor(age.ground).color;

    this.sky.clear();
    this.sky.fillGradientStyle(topC, topC, botC, botC, 1);
    this.sky.fillRect(0, 0, VIEW.width, VIEW.groundY + 40);

    this.drawSkyMarks(age);

    // Rounded hills replace the old hard polygon ridges. Repeating them beyond
    // the viewport keeps parallax continuous on the long-field missions.
    this.far.clear();
    this.far.fillStyle(shade(botC, -0.09), 1);
    for (const [x, w, h] of [[95, 560, 280], [565, 670, 340], [1110, 610, 290], [1590, 620, 310]] as const) {
      this.far.fillEllipse(x, VIEW.groundY + 28, w, h);
    }
    this.far.lineStyle(2, 0x5c6c62, 0.26);
    for (const [x, w, h] of [[95, 560, 280], [565, 670, 340], [1110, 610, 290], [1590, 620, 310]] as const) {
      this.far.strokeEllipse(x, VIEW.groundY + 28, w, h);
    }

    this.mid.clear();
    this.mid.fillStyle(shade(groundC, 0.22), 1);
    for (const [x, w, h] of [[0, 470, 200], [380, 520, 225], [860, 600, 210], [1370, 580, 230], [1870, 550, 205]] as const) {
      this.mid.fillEllipse(x, VIEW.groundY + 55, w, h);
    }
    this.mid.lineStyle(2, 0x5b6657, 0.32);
    for (const [x, w, h] of [[0, 470, 200], [380, 520, 225], [860, 600, 210], [1370, 580, 230], [1870, 550, 205]] as const) {
      this.mid.strokeEllipse(x, VIEW.groundY + 55, w, h);
    }

    this.ground.clear();
    // Walking surface: broad colour and a pencil-dark edge.
    this.ground.fillStyle(groundC, 1);
    this.ground.fillRect(-200, VIEW.groundY, this.laneLength + 400, VIEW.height);
    this.ground.fillStyle(shade(groundC, 0.16), 1);
    this.ground.fillRect(-200, VIEW.groundY, this.laneLength + 400, 8);
    this.ground.lineStyle(3, 0x514940, 0.88);
    this.ground.lineBetween(-200, VIEW.groundY, this.laneLength + 200, VIEW.groundY);

    // Survey ticks every 20m, taller every 100m.
    this.ground.lineStyle(1, shade(groundC, -0.45), 0.85);
    for (let x = 0; x <= this.laneLength; x += 20) {
      const tall = x % 100 === 0;
      this.ground.beginPath();
      this.ground.moveTo(x, VIEW.groundY + 8);
      this.ground.lineTo(x, VIEW.groundY + (tall ? 20 : 13));
      this.ground.strokePath();
    }

    const tufts = new Rng(0x51ce);
    this.ground.lineStyle(2, 0x59694a, 0.65);
    for (let x = 25; x < this.laneLength; x += 70) {
      const px = x + tufts.range(-15, 15);
      this.ground.lineBetween(px, VIEW.groundY, px - 4, VIEW.groundY - 10);
      this.ground.lineBetween(px, VIEW.groundY, px + 5, VIEW.groundY - 8);
    }

    for (const label of this.markers) label.setColor(hex(shade(groundC, -0.5)));
  }

  private drawMarkers(): void {
    for (let x = 200; x < this.laneLength; x += 200) {
      const label = this.scene.add
        .text(x, VIEW.groundY + 24, `${x}m`, {
          fontFamily: 'Patrick Hand, cursive',
          fontSize: '14px',
        })
        .setOrigin(0.5, 0)
        .setDepth(-29)
        .setAlpha(0.7);
      this.markers.push(label);
    }
  }

  private drawSkyMarks(age: AgeDef): void {
    const g = this.sky;
    const sun = age.index === 4 ? 0xe6f8ff : age.index === 2 ? 0xffe1a2 : 0xffdf79;
    g.fillStyle(sun, 0.95);
    g.fillCircle(1070, 115, age.index === 4 ? 37 : 46);
    g.lineStyle(3, 0x514940, 0.65);
    g.strokeCircle(1070, 115, age.index === 4 ? 37 : 46);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const inner = age.index === 4 ? 48 : 58;
      const outer = inner + 14;
      g.lineBetween(1070 + Math.cos(a) * inner, 115 + Math.sin(a) * inner,
        1070 + Math.cos(a) * outer, 115 + Math.sin(a) * outer);
    }
    // Cloud puffs deliberately overlap like cut paper, with one loose baseline.
    for (const [x, y, w] of [[170, 125, 150], [620, 85, 120], [890, 170, 105]] as const) {
      g.fillStyle(0xfffaf0, 0.84);
      g.fillEllipse(x - w * 0.22, y + 7, w * 0.7, 31);
      g.fillEllipse(x, y - 4, w * 0.6, 44);
      g.fillEllipse(x + w * 0.28, y + 9, w * 0.55, 28);
      g.lineStyle(2, 0x596361, 0.45);
      g.lineBetween(x - w * 0.47, y + 21, x + w * 0.52, y + 21);
    }
  }

  destroy(): void {
    this.sky.destroy();
    this.far.destroy();
    this.mid.destroy();
    this.ground.destroy();
    for (const m of this.markers) m.destroy();
  }
}

function shade(colour: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(colour);
  const f = amount >= 0 ? 1 - amount : 1 + amount;
  const t = amount >= 0 ? 255 : 0;
  return Phaser.Display.Color.GetColor(
    Math.round(c.red * f + t * (1 - f)),
    Math.round(c.green * f + t * (1 - f)),
    Math.round(c.blue * f + t * (1 - f)),
  );
}

function hex(colour: number): string {
  return `#${colour.toString(16).padStart(6, '0')}`;
}
