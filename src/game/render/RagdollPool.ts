import Phaser from 'phaser';
import type { DamageKind, Faction, UnitDef } from '@/data/types';
import { MATTER_CATEGORY, RAGDOLL, VIEW } from '@/game/config';
import { palette, skeletonFor, type BoneSpec, type SkeletonSpec } from './skeleton';

interface Limb {
  body: MatterJS.BodyType;
  img: Phaser.GameObjects.Image;
  spec: BoneSpec;
}

interface Corpse {
  limbs: Limb[];
  constraints: MatterJS.ConstraintType[];
  /** Seconds since death. */
  age: number;
  faction: Faction;
}

export interface RagdollRequest {
  x: number;
  def: UnitDef;
  faction: Faction;
  /** -1 or 1: direction the killing blow came from. */
  dirX: number;
  /** Roughly 0.3 to 3. Overkill throws further. */
  force: number;
  kind: DamageKind;
  /** Current age accent, used for limb trim. */
  accent: number;
  /** Walk-cycle phase at the moment of death, so the pose carries over. */
  phase: number;
}

/**
 * Matter-backed corpses.
 *
 * Living units are NOT physics bodies. Simulating 50 constrained ragdolls on a
 * mid-range phone is not viable, and full physics would make combat
 * non-deterministic. So the sim stays kinematic and a unit converts to a real
 * jointed ragdoll at the instant it dies, inheriting its position, facing and
 * the force of the blow that killed it. That is where all the visual payoff is
 * anyway, and it costs nothing while the unit is alive.
 *
 * The pool is hard-capped; the oldest corpse is recycled when it overflows.
 */
export class RagdollPool {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Layer;
  private corpses: Corpse[] = [];
  /** Lowered by the "reduced corpses" setting on weaker devices. */
  private maxActive: number;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    maxActive: number = RAGDOLL.maxActive,
  ) {
    this.scene = scene;
    this.layer = layer;
    this.maxActive = Math.max(4, maxActive);
  }

  /** Lifetime spawn count. Exposed for the browser smoke test. */
  spawned = 0;

  get count(): number {
    return this.corpses.length;
  }

  spawn(req: RagdollRequest): void {
    if (this.corpses.length >= this.maxActive) {
      this.destroyCorpse(this.corpses.shift()!);
    }

    const spec = skeletonFor(req.def);
    const H = req.def.height;
    const colours = palette(req.faction, req.accent);
    const facing = req.faction === 'player' ? 1 : -1;
    const feetY = VIEW.groundY;

    const limbs: Limb[] = [];
    const byName = new Map<string, MatterJS.BodyType>();

    for (const bone of spec.bones) {
      const bx = req.x + bone.x * H * facing;
      const by = feetY + bone.y * H;
      const w = Math.max(3, bone.w * H);
      const h = Math.max(3, bone.h * H);

      const body =
        bone.shape === 'disc'
          ? this.scene.matter.add.circle(bx, by, w / 2, this.bodyOptions(bone))
          : this.scene.matter.add.rectangle(bx, by, w, h, this.bodyOptions(bone));

      // A little pose carry-over: limbs that were mid-stride start rotated.
      if (bone.name.startsWith('leg') || bone.name.startsWith('arm')) {
        const swing = Math.sin(req.phase + (bone.name.endsWith('Back') ? Math.PI : 0)) * 0.5;
        this.scene.matter.body.setAngle(body, swing);
      }

      const img = this.scene.add
        .image(bx, by, bone.texture ?? (bone.shape === 'disc' ? 'rd-disc' : 'rd-quad'))
        .setDisplaySize(w, h)
        .setTintFill(colours[bone.tint])
        .setDepth(bone.z);
      this.layer.add(img);

      limbs.push({ body, img, spec: bone });
      byName.set(bone.name, body);
    }

    const constraints = this.linkJoints(spec, byName, H, facing);

    // Launch. Velocity rather than force: predictable across frame rates.
    const power = Phaser.Math.Clamp(req.force, 0.25, 3);
    const lift = req.kind === 'blast' || req.kind === 'energy' ? 1.5 : 1;
    for (const limb of limbs) {
      const jitter = Phaser.Math.FloatBetween(0.75, 1.3);
      this.scene.matter.body.setVelocity(limb.body, {
        x: req.dirX * power * 3.4 * jitter,
        y: -power * 2.6 * lift * jitter,
      });
      this.scene.matter.body.setAngularVelocity(
        limb.body,
        req.dirX * Phaser.Math.FloatBetween(0.05, 0.22) * power,
      );
    }

    this.corpses.push({ limbs, constraints, age: 0, faction: req.faction });
    this.spawned++;
  }

  private bodyOptions(bone: BoneSpec): MatterJS.IChamferableBodyDefinition {
    return {
      density: bone.density ?? 0.001,
      friction: 0.7,
      frictionAir: 0.012,
      restitution: 0.12,
      sleepThreshold: RAGDOLL.sleepThreshold,
      collisionFilter: {
        category: MATTER_CATEGORY.ragdoll,
        // Corpses hit the ground and each other. Never the living.
        mask: MATTER_CATEGORY.ground | MATTER_CATEGORY.ragdoll,
        group: 0,
      },
    };
  }

  private linkJoints(
    spec: SkeletonSpec,
    byName: Map<string, MatterJS.BodyType>,
    H: number,
    facing: number,
  ): MatterJS.ConstraintType[] {
    const out: MatterJS.ConstraintType[] = [];
    for (const joint of spec.joints) {
      const a = byName.get(joint.a);
      const b = byName.get(joint.b);
      if (!a || !b) continue;
      const c = this.scene.matter.add.constraint(a, b, 0, joint.stiffness ?? RAGDOLL.jointStiffness, {
        pointA: { x: joint.ax * H * facing, y: joint.ay * H },
        pointB: { x: joint.bx * H * facing, y: joint.by * H },
        damping: 0.1,
        render: { visible: false },
      });
      out.push(c);
    }
    return out;
  }

  /** Extra shove, e.g. a special landing next to a pile of corpses. */
  shockwave(x: number, radius: number, power: number): void {
    for (const corpse of this.corpses) {
      for (const limb of corpse.limbs) {
        const dx = limb.body.position.x - x;
        const dy = limb.body.position.y - VIEW.groundY;
        const d = Math.hypot(dx, dy);
        if (d > radius) continue;
        const falloff = 1 - d / radius;
        this.scene.matter.body.setVelocity(limb.body, {
          x: limb.body.velocity.x + Math.sign(dx || 1) * power * falloff * 4,
          y: limb.body.velocity.y - power * falloff * 5,
        });
      }
    }
  }

  update(dtSeconds: number): void {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const corpse = this.corpses[i];
      corpse.age += dtSeconds;

      const fadeStart = RAGDOLL.lifetime - RAGDOLL.fadeTime;
      const alpha =
        corpse.age <= fadeStart
          ? 1
          : Math.max(0, 1 - (corpse.age - fadeStart) / RAGDOLL.fadeTime);

      let offscreen = true;
      for (const limb of corpse.limbs) {
        const { position, angle } = limb.body;
        limb.img.setPosition(position.x, position.y);
        limb.img.setRotation(angle);
        if (alpha < 1) limb.img.setAlpha(alpha);
        if (position.y < VIEW.groundY + 600) offscreen = false;
      }

      if (alpha <= 0 || offscreen) {
        this.destroyCorpse(corpse);
        this.corpses.splice(i, 1);
      }
    }
  }

  private destroyCorpse(corpse: Corpse): void {
    for (const c of corpse.constraints) this.scene.matter.world.removeConstraint(c);
    for (const limb of corpse.limbs) {
      this.scene.matter.world.remove(limb.body);
      limb.img.destroy();
    }
  }

  clear(): void {
    for (const corpse of this.corpses) this.destroyCorpse(corpse);
    this.corpses.length = 0;
  }
}

/**
 * One white quad and one white disc, tinted per limb at runtime. Keeping every
 * bone on two textures means the whole corpse layer batches into a couple of
 * draw calls, which is what makes 20-plus ragdolls viable on a phone.
 */
export function createRagdollTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('rd-quad')) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 16, 16);
    g.generateTexture('rd-quad', 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists('rd-disc')) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1).fillCircle(16, 16, 16);
    g.generateTexture('rd-disc', 32, 32);
    g.destroy();
  }
}
