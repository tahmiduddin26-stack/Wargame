import Phaser from 'phaser';
import type { DamageKind } from '@/data/types';
import { FEEL, VIEW } from '@/game/config';

const KIND_COLOUR: Record<DamageKind, number> = {
  impact: 0xd8c9a8,
  pierce: 0xf0e4c4,
  blast: 0xe8913a,
  energy: 0x5fe4dc,
};

/**
 * Impact feedback. Everything here is short, additive and pooled: a ring, a
 * spark cluster and a ground scorch. Nothing animates for longer than 400ms,
 * because on a phone the ragdolls are already carrying the drama.
 */
export class Fx {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Layer;
  private ringPool: Phaser.GameObjects.Arc[] = [];
  private sparkPool: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.layer = layer;
  }

  impact(x: number, y: number, blast: number, kind: DamageKind, heavy: boolean): void {
    const colour = KIND_COLOUR[kind];
    const radius = Math.max(10, blast || 14);

    const ring = this.takeRing();
    ring.setPosition(x, y).setRadius(radius * 0.3).setStrokeStyle(2, colour, 0.9).setVisible(true);
    this.scene.tweens.add({
      targets: ring,
      radius: radius,
      alpha: { from: 0.9, to: 0 },
      duration: heavy ? 320 : 190,
      onComplete: () => this.releaseRing(ring),
    });

    const sparks = heavy ? 7 : 3;
    for (let i = 0; i < sparks; i++) {
      const s = this.takeSpark();
      const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
      const dist = Phaser.Math.FloatBetween(radius * 0.6, radius * 1.7);
      s.setPosition(x, y)
        .setFillStyle(colour, 1)
        .setDisplaySize(Phaser.Math.Between(2, 4), Phaser.Math.Between(2, 5))
        .setVisible(true)
        .setAlpha(1);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: Phaser.Math.Between(180, 380),
        ease: 'Quad.Out',
        onComplete: () => this.releaseSpark(s),
      });
    }

    if (heavy) {
      const scorch = this.scene.add
        .ellipse(x, VIEW.groundY + 2, radius * 1.8, radius * 0.5, 0x1a1410, 0.5)
        .setDepth(-28);
      this.layer.add(scorch);
      this.scene.tweens.add({
        targets: scorch,
        alpha: 0,
        duration: 2600,
        onComplete: () => scorch.destroy(),
      });
    }
  }

  /** Direct-fire tracer. Drawn as a short streak, not a full-length beam. */
  tracer(sx: number, sy: number, tx: number, ty: number, kind: DamageKind): void {
    const line = this.scene.add
      .line(0, 0, sx, sy, tx, ty, KIND_COLOUR[kind], 0.55)
      .setOrigin(0)
      .setLineWidth(1.2);
    this.layer.add(line);
    this.scene.tweens.add({
      targets: line,
      alpha: 0,
      duration: 90,
      onComplete: () => line.destroy(),
    });
  }

  muzzle(x: number, y: number, kind: DamageKind): void {
    const flash = this.scene.add.circle(x, y, 5, KIND_COLOUR[kind], 0.9);
    this.layer.add(flash);
    this.scene.tweens.add({
      targets: flash,
      radius: 11,
      alpha: 0,
      duration: 100,
      onComplete: () => flash.destroy(),
    });
  }

  /** Dust kicked up where a corpse lands or a heavy unit steps. */
  dust(x: number, strength = 1): void {
    for (let i = 0; i < 3; i++) {
      const puff = this.scene.add.ellipse(
        x + Phaser.Math.Between(-8, 8),
        VIEW.groundY - 2,
        10 * strength,
        6 * strength,
        0xb0a288,
        0.28,
      );
      this.layer.add(puff);
      this.scene.tweens.add({
        targets: puff,
        y: VIEW.groundY - 18 * strength,
        scaleX: 2.2,
        scaleY: 1.8,
        alpha: 0,
        duration: 520,
        ease: 'Sine.Out',
        onComplete: () => puff.destroy(),
      });
    }
  }

  /** The special: a staggered walk of impacts down the lane. */
  barrage(points: number[], accent: number, onEachImpact: (x: number) => void): void {
    points.forEach((x, i) => {
      this.scene.time.delayedCall(i * 65, () => {
        const streak = this.scene.add
          .rectangle(x, VIEW.groundY - 260, 3, 220, accent, 0.75)
          .setDepth(15);
        this.layer.add(streak);
        this.scene.tweens.add({
          targets: streak,
          y: VIEW.groundY - 60,
          alpha: 0,
          duration: 120,
          onComplete: () => {
            streak.destroy();
            this.impact(x, VIEW.groundY - 16, 90, 'blast', true);
            this.dust(x, 1.8);
            onEachImpact(x);
          },
        });
      });
    });
  }

  shake(big = false): void {
    this.scene.cameras.main.shake(big ? 220 : 90, big ? FEEL.shakeBig : FEEL.shakeSmall);
  }

  private takeRing(): Phaser.GameObjects.Arc {
    const ring = this.ringPool.pop();
    if (ring) return ring;
    const made = this.scene.add.circle(0, 0, 8).setFillStyle(0, 0).setDepth(16);
    this.layer.add(made);
    return made;
  }

  private releaseRing(ring: Phaser.GameObjects.Arc): void {
    ring.setVisible(false).setAlpha(1);
    if (this.ringPool.length < 24) this.ringPool.push(ring);
    else ring.destroy();
  }

  private takeSpark(): Phaser.GameObjects.Rectangle {
    const s = this.sparkPool.pop();
    if (s) return s;
    const made = this.scene.add.rectangle(0, 0, 3, 3, 0xffffff).setDepth(17);
    this.layer.add(made);
    return made;
  }

  private releaseSpark(s: Phaser.GameObjects.Rectangle): void {
    s.setVisible(false).setAlpha(1);
    if (this.sparkPool.length < 60) this.sparkPool.push(s);
    else s.destroy();
  }
}
