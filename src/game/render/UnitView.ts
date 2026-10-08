import Phaser from 'phaser';
import type { Faction, UnitDef } from '@/data/types';
import type { ArmySkinId } from '@/data/cosmetics';
import { VIEW } from '@/game/config';
import type { SimUnit } from '@/game/sim/types';
import { skeletonFor, type BoneSpec, type UnitPose } from './skeleton';
import { unitImage, visualHeight } from './UnitArt';

interface LiveLimb {
  img: Phaser.GameObjects.Image;
  spec: BoneSpec;
  baseX: number;
  baseY: number;
}

/**
 * The visual for a living unit. Built from the same skeleton the ragdoll uses,
 * so when the unit dies the corpse appears in the pose it was standing in.
 *
 * The rig is authored facing right and mirrored with scaleX for the enemy side,
 * which keeps every offset in the skeleton positive-facing and readable.
 */
export class UnitView {
  readonly container: Phaser.GameObjects.Container;
  private limbs: LiveLimb[] = [];
  private hpBack: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  private def: UnitDef;
  /** Eases 0 to 1 and back on every swing. */
  private swing = 0;
  private lastReload = 0;
  private walkPhase = 0;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    def: UnitDef,
    faction: Faction,
    _accent: number,
    skinId: ArmySkinId = 'field',
  ) {
    this.def = def;
    const spec = skeletonFor(def);
    const H = visualHeight(def);

    this.container = scene.add.container(0, VIEW.groundY);
    this.container.setScale(faction === 'player' ? 1 : -1, 1);

    for (const bone of [...spec.bones].sort((a, b) => a.z - b.z)) {
      const img = unitImage(scene, def, bone, faction, skinId).setPosition(bone.x * H, bone.y * H);
      this.container.add(img);
      this.limbs.push({ img, spec: bone, baseX: bone.x * H, baseY: bone.y * H });
    }

    const barW = Math.max(22, H * 0.7);
    const barY = -H * (def.id === 'dino-rider' || def.id === 'cuirassier' ? 1.32 : 1.18) - 8;
    this.hpBack = scene.add
      .rectangle(0, barY, barW, 4, 0x1a1613)
      .setStrokeStyle(1, 0x000000, 0.5)
      .setVisible(false);
    this.hpFill = scene.add
      .rectangle(-barW / 2, barY, barW, 4, faction === 'player' ? 0xe0aa2e : 0x46a6c8)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.container.add([this.hpBack, this.hpFill]);

    layer.add(this.container);
  }

  sync(u: SimUnit, dt: number): void {
    this.container.x = u.x;
    this.walkPhase = u.phase;

    // Rising edge on the reload timer means a swing just went out.
    if (u.reload > this.lastReload) this.swing = 1;
    this.lastReload = u.reload;
    this.swing = Math.max(0, this.swing - dt * 4.5);

    const H = visualHeight(this.def);
    const walking = !u.engaging;
    const stride = walking ? Math.sin(u.phase) : 0;
    const bob = walking ? Math.abs(Math.cos(u.phase)) * H * 0.02 : 0;
    const jab = Phaser.Math.Easing.Quadratic.Out(this.swing);

    for (const limb of this.limbs) {
      const { name } = limb.spec;
      let rot = 0;
      let dx = 0;
      let dy = 0;

      if (name === 'legFront' || name === 'legBack') {
        rot = stride * (name === 'legFront' ? 0.65 : -0.65);
        dy = -Math.abs(stride) * H * 0.035;
      } else if (name === 'armBack') rot = -stride * 0.35;
      else if (name === 'armFront') {
        const firearm = this.def.age === 'modern' || this.def.age === 'future' || this.def.id === 'musketeer';
        const bow = this.def.id === 'longbowman';
        rot = firearm || bow ? (walking ? stride * 0.045 : -jab * 0.07) : (walking ? stride * 0.18 : -0.2 + jab);
        dx = jab * H * (firearm ? -0.045 : 0.08);
      } else if (name === 'torso') {
        dy = -bob;
        rot = walking ? stride * 0.04 : -jab * 0.12;
      } else if (name === 'head') {
        dy = -bob;
      } else if (name === 'wheelBack' || name === 'wheelFront') {
        // Wheels roll. Cheap detail, immediately legible.
        rot = limb.img.rotation + (walking ? this.def.speed * dt * 0.06 : 0);
        limb.img.setRotation(rot);
        continue;
      } else if (name === 'barrel') {
        rot = -jab * 0.25;
        dx = -jab * H * 0.06;
      }

      limb.img.setRotation(rot);
      limb.img.setPosition(limb.baseX + dx, limb.baseY + dy);
    }

    const ratio = Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1);
    const damaged = ratio < 0.999;
    this.hpBack.setVisible(damaged);
    this.hpFill.setVisible(damaged);
    if (damaged) {
      this.hpFill.width = this.hpBack.width * ratio;
    }
  }

  /** Walk-cycle phase, handed to the ragdoll so the pose carries over. */
  get phase(): number {
    return this.walkPhase;
  }

  /** Include the equipment's current swing, not just an approximate walking pose. */
  get pose(): UnitPose {
    return Object.fromEntries(this.limbs.map(({ img, spec }) => [spec.name,
      { x: img.x, y: img.y, rotation: img.rotation }]));
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
