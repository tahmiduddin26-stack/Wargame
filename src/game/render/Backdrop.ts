import Phaser from 'phaser';
import type { AgeDef } from '@/data/types';
import { VIEW } from '@/game/config';
import { Rng } from '@/game/sim/rng';

/**
 * Three parallax bands plus a surveyed ground strip. Drawn procedurally so the
 * game is playable before any art exists; each band is a single Graphics object
 * with a scroll factor, which is cheap enough to leave running on a phone.
 *
 * The metre markings along the lane are not decoration. Reach is the whole game
 * and being able to read "my trebuchet covers 300m" off the ground matters.
 */
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

    // Far ridge line. Same seed every time so the terrain is stable.
    const rngFar = new Rng(0xa17c);
    this.far.clear();
    this.far.fillStyle(shade(botC, -0.28), 1);
    this.ridge(this.far, rngFar, VIEW.width * 1.4, VIEW.groundY - 40, 130, 9);

    const rngMid = new Rng(0x51ce);
    this.mid.clear();
    this.mid.fillStyle(shade(groundC, -0.34), 1);
    this.ridge(this.mid, rngMid, VIEW.width * 1.9, VIEW.groundY + 6, 74, 16);

    this.ground.clear();
    // Walking surface.
    this.ground.fillStyle(groundC, 1);
    this.ground.fillRect(-200, VIEW.groundY, this.laneLength + 400, VIEW.height);
    // Compacted top band so the ground line reads sharply.
    this.ground.fillStyle(shade(groundC, 0.16), 1);
    this.ground.fillRect(-200, VIEW.groundY, this.laneLength + 400, 5);
    this.ground.fillStyle(shade(groundC, -0.3), 1);
    this.ground.fillRect(-200, VIEW.groundY + 5, this.laneLength + 400, 2);

    // Survey ticks every 20m, taller every 100m.
    this.ground.lineStyle(1, shade(groundC, -0.45), 0.85);
    for (let x = 0; x <= this.laneLength; x += 20) {
      const tall = x % 100 === 0;
      this.ground.beginPath();
      this.ground.moveTo(x, VIEW.groundY + 8);
      this.ground.lineTo(x, VIEW.groundY + (tall ? 20 : 13));
      this.ground.strokePath();
    }

    for (const label of this.markers) label.setColor(hex(shade(groundC, -0.5)));
  }

  private drawMarkers(): void {
    for (let x = 200; x < this.laneLength; x += 200) {
      const label = this.scene.add
        .text(x, VIEW.groundY + 24, `${x}m`, {
          fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
          fontSize: '11px',
        })
        .setOrigin(0.5, 0)
        .setDepth(-29)
        .setAlpha(0.7);
      this.markers.push(label);
    }
  }

  /** Jagged silhouette band, used for both parallax ridges. */
  private ridge(
    g: Phaser.GameObjects.Graphics,
    rng: Rng,
    width: number,
    baseY: number,
    amplitude: number,
    steps: number,
  ): void {
    const pts: Phaser.Types.Math.Vector2Like[] = [{ x: -100, y: VIEW.height }];
    const dx = (width + 200) / steps;
    for (let i = 0; i <= steps; i++) {
      pts.push({ x: -100 + i * dx, y: baseY - rng.range(amplitude * 0.25, amplitude) });
    }
    pts.push({ x: width + 100, y: VIEW.height });
    g.fillPoints(pts as Phaser.Geom.Point[], true, true);
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
