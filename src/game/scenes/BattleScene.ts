import Phaser from 'phaser';
import { AGES, ageAt, xpToNextAge } from '@/data/ages';
import { SPECIALS } from '@/data/specials';
import { UNIT_BY_ID } from '@/data/units';
import type { DifficultyId } from '@/data/difficulty';
import { NO_PERKS, type PerkEffects } from '@/data/perks';
import type { Faction, LevelDef } from '@/data/types';
import type { ArmySkinId } from '@/data/cosmetics';
import { audio } from '@/game/audio/Audio';
import { bridge, type HudSnapshot, type LaneBlip } from '@/game/bridge';
import { CAMERA, MATTER_CATEGORY, SIM, VIEW, WORLD } from '@/game/config';
import { Backdrop } from '@/game/render/Backdrop';
import { BaseView } from '@/game/render/BaseView';
import { Fx } from '@/game/render/Fx';
import { createRagdollTextures, RagdollPool } from '@/game/render/RagdollPool';
import { UnitView } from '@/game/render/UnitView';
import { BattleSim } from '@/game/sim/BattleSim';
import { EnemyCommander } from '@/game/sim/EnemyCommander';
import { SURVIVAL_LEVEL, SurvivalDirector } from '@/game/sim/SurvivalDirector';
import type { SimProjectile } from '@/game/sim/types';
import { onlineClient } from '@/multiplayer/client';
import type { OnlineBattleState, OnlineCommand } from '@/multiplayer/protocol';

export interface BattleSceneData {
  level: LevelDef;
  seed?: number;
  difficulty?: DifficultyId;
  /** Resolved armoury multipliers. Player side only. */
  perks?: PerkEffects;
  /** Survival replaces the enemy commander with an authored wave director. */
  survival?: boolean;
  /** Corpse budget, lowered by the "reduced corpses" setting. */
  corpseCap?: number;
  /** Battle speed from settings. Applied on the first frame. */
  speed?: number;
  /** When present, the server owns the simulation and this scene renders snapshots. */
  onlineMatchId?: string;
  /** Local player's visual-only army paint. */
  skinId?: ArmySkinId;
}

const SNAPSHOT_INTERVAL = 0.08;

export class BattleScene extends Phaser.Scene {
  private sim!: BattleSim;
  private ai: EnemyCommander | null = null;
  private waves: SurvivalDirector | null = null;
  private backdrop!: Backdrop;
  private playerBase!: BaseView;
  private enemyBase!: BaseView;
  private ragdolls!: RagdollPool;
  private fx!: Fx;

  private unitLayer!: Phaser.GameObjects.Layer;
  private corpseLayer!: Phaser.GameObjects.Layer;
  private fxLayer!: Phaser.GameObjects.Layer;

  private views = new Map<number, UnitView>();
  private shells = new Map<number, Phaser.GameObjects.Image>();

  private paused = false;
  private speed = 1;
  private snapshotTimer = 0;
  private manualCamera = 0;
  private finished = false;
  private gateWarningPlayed = false;
  private onlineMatchId: string | null = null;
  private stopOnline: (() => void) | null = null;
  private renderedAge = 0;
  private skinId: ArmySkinId = 'field';

  constructor() {
    super('battle');
  }

  create(data: BattleSceneData): void {
    this.skinId = data.skinId ?? 'field';
    const survival = !!data.survival;
    this.onlineMatchId = data.onlineMatchId ?? null;
    this.sim = new BattleSim(
      survival ? SURVIVAL_LEVEL : data.level,
      data.seed ?? 1337,
      data.difficulty ?? 'normal',
      data.perks ?? NO_PERKS,
    );
    if (this.onlineMatchId) {
      this.ai = null;
      this.waves = null;
    } else if (survival) {
      this.waves = new SurvivalDirector(this.sim, (data.seed ?? 1337) ^ 0x77a1);
      this.ai = null;
    } else {
      this.ai = new EnemyCommander(this.sim, (data.seed ?? 1337) ^ 0x5f3a);
      this.waves = null;
    }
    this.finished = false;
    this.gateWarningPlayed = false;
    this.paused = false;
    this.speed = this.onlineMatchId ? 1 : (data.speed ?? 1);
    this.matter.world.engine.timing.timeScale = this.speed;

    createRagdollTextures(this);

    this.corpseLayer = this.add.layer().setDepth(6);
    this.unitLayer = this.add.layer().setDepth(10);
    this.fxLayer = this.add.layer().setDepth(18);

    this.buildMatterWorld();

    // Later missions deploy mid-war, so everything opens in the sim's ages.
    const myAge = this.sim.player.ageIndex;
    this.renderedAge = myAge;
    this.backdrop = new Backdrop(this, this.sim.laneLength, AGES[myAge]);
    this.playerBase = new BaseView(this, 'player', this.sim.player.baseX, AGES[myAge], this.skinId);
    this.enemyBase = new BaseView(this, 'enemy', this.sim.enemy.baseX, AGES[this.sim.enemy.ageIndex]);
    this.ragdolls = new RagdollPool(this, this.corpseLayer, data.corpseCap);
    this.fx = new Fx(this, this.fxLayer);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.sim.laneLength, VIEW.height);
    cam.scrollX = Math.max(0, this.sim.player.baseX - VIEW.width * 0.3);

    this.setupCameraDrag();
    this.exposeQaHandle();

    audio.unlock();
    audio.startBed(this.sim.player.ageIndex);

    // Both events, because destroying the game from React does not reliably
    // route through SHUTDOWN.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());

    if (this.onlineMatchId) {
      this.stopOnline = onlineClient.onBattle((state) => this.applyOnlineState(state), this.onlineMatchId);
    }
  }

  private applyOnlineState(state: OnlineBattleState): void {
    if (this.tornDown) return;
    this.sim.player = state.player;
    this.sim.enemy = state.enemy;
    this.sim.units = state.units;
    this.sim.projectiles = state.projectiles;
    this.sim.events = [...state.events];
    this.sim.elapsed = state.elapsed;
    this.sim.over = state.over;
    this.sim.decidedBy = state.decidedBy;
    this.sim.stats = state.stats;
    this.drainEvents();
    this.syncUnits(SNAPSHOT_INTERVAL);
    this.syncShells();
    this.playerBase.sync(this.sim.player, ageAt(this.sim.player.ageIndex));
    this.enemyBase.sync(this.sim.enemy, ageAt(this.sim.enemy.ageIndex));
    if (this.renderedAge !== this.sim.player.ageIndex) {
      this.renderedAge = this.sim.player.ageIndex;
      this.backdrop.setAge(ageAt(this.renderedAge));
      audio.setBedAge(this.renderedAge);
    }
    this.updateCamera(SNAPSHOT_INTERVAL);
    this.publish();
  }

  private buildMatterWorld(): void {
    const lane = this.sim.laneLength;
    const groundOpts: MatterJS.IChamferableBodyDefinition = {
      isStatic: true,
      friction: 0.9,
      collisionFilter: { category: MATTER_CATEGORY.ground, mask: 0xffffffff, group: 0 },
    };
    // Floor: top edge sits exactly on the walking line.
    this.matter.add.rectangle(lane / 2, VIEW.groundY + 40, lane + 1200, 80, groundOpts);
    // Soft walls so corpses pile up at the gates instead of sliding to infinity.
    this.matter.add.rectangle(-30, VIEW.groundY - 200, 60, 500, groundOpts);
    this.matter.add.rectangle(lane + 30, VIEW.groundY - 200, 60, 500, groundOpts);
    this.matter.world.setBounds(-400, -600, lane + 800, VIEW.height + 1400);
  }

  /**
   * Read-only counters on `window.__aow`, for QA and the browser smoke test.
   * Corpse and Matter body counts are not visible in the DOM (they live on the
   * canvas), so without this there is no way to assert from outside that the
   * ragdoll pool is actually running and being recycled rather than leaking.
   */
  private exposeQaHandle(): void {
    // Every getter tolerates a torn-down scene: destroying the Phaser game from
    // React nulls the Matter world without necessarily firing SHUTDOWN first.
    const live = () => !!this.sim && !!this.matter?.world?.localWorld;
    (window as unknown as Record<string, unknown>).__aow = {
      live,
      corpses: () => (live() ? this.ragdolls.count : 0),
      ragdollSpawns: () => (live() ? this.ragdolls.spawned : 0),
      kills: () => (live() ? [this.sim.stats.player.kills, this.sim.stats.enemy.kills] : [0, 0]),
      units: () => (live() ? this.sim.units.length : 0),
      matterBodies: () =>
        live()
          ? this.matter.composite.allBodies(
              this.matter.world.localWorld as unknown as MatterJS.CompositeType,
            ).length
          : 0,
      elapsed: () => (live() ? this.sim.elapsed : 0),
      ages: () => (live() ? [this.sim.player.ageIndex, this.sim.enemy.ageIndex] : [0, 0]),
      gates: () => (live() ? [this.sim.player.baseHp, this.sim.enemy.baseHp] : [0, 0]),
    };
  }

  private setupCameraDrag(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const dx = pointer.prevPosition.x - pointer.position.x;
      if (Math.abs(dx) < 0.5) return;
      this.cameras.main.scrollX += dx / this.cameras.main.zoom;
      this.manualCamera = CAMERA.manualHoldTime;
    });
  }

  update(_time: number, delta: number): void {
    const raw = Math.min(delta / 1000, 0.05);
    const dt = raw * this.speed;

    this.handleCommands();

    if (this.onlineMatchId) {
      this.ragdolls.update(raw);
      return;
    }

    if (!this.paused && !this.finished) {
      this.sim.advance(dt);
      this.ai?.update(dt);
      this.waves?.update(dt);
      this.drainEvents();
      this.syncUnits(dt);
      this.syncShells();
      this.playerBase.sync(this.sim.player, ageAt(this.sim.player.ageIndex));
      this.enemyBase.sync(this.sim.enemy, ageAt(this.sim.enemy.ageIndex));
      this.updateCamera(raw);
    }

    this.ragdolls.update(raw);

    this.snapshotTimer -= raw;
    if (this.snapshotTimer <= 0) {
      this.snapshotTimer = SNAPSHOT_INTERVAL;
      this.publish();
      // Tension is how far the enemy has pushed toward your gate.
      const span = Math.max(1, this.sim.enemy.baseX - this.sim.player.baseX);
      const pushed = (this.sim.enemy.baseX - this.sim.frontLine('enemy')) / span;
      audio.setTension(Phaser.Math.Clamp(1 - pushed * 1.6, 0, 1));
    }
  }

  private handleCommands(): void {
    for (const cmd of bridge.drain()) {
      if (this.onlineMatchId) {
        if (cmd.t === 'lookAt') {
          this.cameras.main.scrollX = cmd.x - VIEW.width / 2;
          this.manualCamera = CAMERA.manualHoldTime;
        } else if (cmd.t !== 'pause' && cmd.t !== 'speed') {
          onlineClient.command(this.onlineMatchId, cmd as OnlineCommand);
          if (cmd.t === 'unit') audio.order();
        }
        continue;
      }
      switch (cmd.t) {
        case 'unit': {
          const r = this.sim.queueUnit('player', cmd.id);
          if (r !== 'ok') bridge.reject(r);
          else audio.order();
          break;
        }
        case 'turret': {
          const r = this.sim.buildTurret('player', cmd.slot, cmd.id);
          if (r !== 'ok') bridge.reject(r);
          else {
            audio.construction(this.panAt(this.sim.player.baseX));
            this.fx.construction(this.sim.player.baseX, 0xe0aa2e);
          }
          break;
        }
        case 'unlockSlot': {
          const r = this.sim.unlockSlot('player', cmd.slot);
          if (r !== 'ok') bridge.reject(r);
          else {
            audio.construction(this.panAt(this.sim.player.baseX));
            this.fx.construction(this.sim.player.baseX, 0xe0aa2e);
          }
          break;
        }
        case 'scrap':
          this.sim.scrapTurret('player', cmd.slot);
          break;
        case 'evolve': {
          const r = this.sim.evolve('player');
          if (r !== 'ok') bridge.reject(r);
          break;
        }
        case 'special': {
          const r = this.sim.fireSpecial('player');
          if (r !== 'ok') bridge.reject(r);
          break;
        }
        case 'pause':
          this.setPaused(cmd.on);
          break;
        case 'speed':
          this.speed = cmd.factor;
          this.matter.world.engine.timing.timeScale = cmd.factor;
          break;
        case 'lookAt':
          this.cameras.main.scrollX = cmd.x - VIEW.width / 2;
          this.manualCamera = CAMERA.manualHoldTime;
          break;
      }
    }
  }

  private setPaused(on: boolean): void {
    this.paused = on;
    if (on) this.matter.world.pause();
    else this.matter.world.resume();
  }

  private drainEvents(): void {
    for (const ev of this.sim.events) {
      switch (ev.t) {
        case 'spawn': {
          const def = UNIT_BY_ID[ev.defId];
          if (!def) break;
          audio.spawn(this.panAt(this.sim.commander(ev.faction).baseX));
          const accent = Phaser.Display.Color.HexStringToColor(
            ageAt(this.sim.commander(ev.faction).ageIndex).accent,
          ).color;
          if (!this.views.has(ev.uid)) this.views.set(ev.uid, new UnitView(this, this.unitLayer, def, ev.faction, accent, this.skinId));
          break;
        }

        case 'death': {
          const view = this.views.get(ev.uid);
          const def = UNIT_BY_ID[ev.defId];
          const accent = Phaser.Display.Color.HexStringToColor(
            ageAt(this.sim.commander(ev.faction).ageIndex).accent,
          ).color;
          if (def) {
            this.ragdolls.spawn({
              x: ev.x,
              def,
              faction: ev.faction,
              dirX: ev.dirX,
              force: ev.force,
              kind: ev.kind,
              accent,
              skinId: this.skinId,
              phase: view ? view.phase : 0,
            });
          }
          view?.destroy();
          this.views.delete(ev.uid);
          this.fx.dust(ev.x, def?.chassis ? 2 : 1);
          break;
        }

        case 'shot':
          this.fx.muzzle(ev.sx, ev.sy, ev.kind);
          if (this.isOnScreen(ev.sx)) audio.shot(ev.kind, ev.arc, this.panAt(ev.sx));
          if (!ev.arc) {
            const p = this.sim.projectiles.find((q) => q.pid === ev.pid);
            if (p) this.fx.tracer(p.sx, p.sy, p.tx, p.ty, p.kind);
          }
          break;

        case 'impact':
          this.fx.impact(ev.x, ev.y, ev.blast, ev.kind, ev.heavy);
          if (this.isOnScreen(ev.x)) {
            if (ev.blast > 0) audio.explosion(ev.blast, this.panAt(ev.x));
            else audio.hit(ev.kind, ev.heavy, this.panAt(ev.x));
          }
          if (ev.blast > 0) {
            this.ragdolls.shockwave(ev.x, ev.blast * 1.6, ev.blast / 90);
            if (this.isOnScreen(ev.x)) this.fx.shake(ev.blast > 80);
          }
          break;

        case 'melee':
          this.fx.impact(ev.x, ev.y, ev.heavy ? 18 : 10, ev.kind, false);
          if (this.isOnScreen(ev.x)) audio.hit(ev.kind, ev.heavy, this.panAt(ev.x));
          break;

        case 'baseHit': {
          const view = ev.faction === 'player' ? this.playerBase : this.enemyBase;
          view.flash();
          if (this.isOnScreen(ev.x)) {
            audio.gateHit(this.panAt(ev.x));
            this.fx.gateDamage(ev.x, ev.amount);
          }
          if (ev.faction === 'player' && !this.gateWarningPlayed && this.sim.player.baseHp < this.sim.player.baseMaxHp * 0.25) {
            this.gateWarningPlayed = true;
            audio.warning();
          }
          if (ev.amount > 200 && this.isOnScreen(ev.x)) this.fx.shake(false);
          break;
        }

        case 'evolve': {
          const age = ageAt(ev.ageIndex);
          const view = ev.faction === 'player' ? this.playerBase : this.enemyBase;
          view.refreshAge(age);
          this.fx.evolve(this.sim.commander(ev.faction).baseX, Phaser.Display.Color.HexStringToColor(age.accent).color);
          if (ev.faction === 'player') {
            this.backdrop.setAge(age);
            this.cameras.main.flash(240, 240, 226, 200, false);
            audio.evolve();
            audio.setBedAge(ev.ageIndex);
          }
          break;
        }

        case 'special': {
          const c = this.sim.commander(ev.faction);
          const accent = Phaser.Display.Color.HexStringToColor(ageAt(c.ageIndex).accent).color;
          const impulse = SPECIALS[ageAt(c.ageIndex).id].impulse;
          this.fx.barrage(ev.points, accent, (x) => {
            this.ragdolls.shockwave(x, 150, impulse * 1.4);
          });
          this.fx.shake(true);
          audio.special();
          break;
        }

        case 'over':
          this.finishBattle(ev.winner);
          break;
      }
    }
    this.sim.clearEvents();
  }

  private finishBattle(winner: Faction): void {
    if (this.finished) return;
    this.finished = true;
    audio.result(winner === 'player');
    const loser = winner === 'player' ? this.enemyBase : this.playerBase;
    this.cameras.main.shake(400, 0.009);
    this.cameras.main.zoomTo(1.08, 500, 'Sine.easeInOut');
    loser.flash();
    // Let the last ragdolls settle before the debrief slides in.
    this.time.delayedCall(900, () => this.publish());
  }

  private syncUnits(dt: number): void {
    for (const u of this.sim.units) {
      if (!this.views.has(u.uid)) {
        const accent = Phaser.Display.Color.HexStringToColor(
          ageAt(this.sim.commander(u.faction).ageIndex).accent,
        ).color;
        this.views.set(u.uid, new UnitView(this, this.unitLayer, u.def, u.faction, accent, this.skinId));
      }
      this.views.get(u.uid)?.sync(u, dt);
    }
    // Any view whose unit vanished without a death event (end of match sweep).
    if (this.views.size > this.sim.units.length) {
      const alive = new Set(this.sim.units.map((u) => u.uid));
      for (const [uid, view] of this.views) {
        if (!alive.has(uid)) {
          view.destroy();
          this.views.delete(uid);
        }
      }
    }
  }

  private syncShells(): void {
    const live = new Set<number>();
    for (const p of this.sim.projectiles) {
      live.add(p.pid);
      let img = this.shells.get(p.pid);
      if (!img) {
        img = this.add
          .image(p.sx, p.sy, 'rd-quad')
          .setDisplaySize(p.arcH > 0 ? 8 : 11, p.arcH > 0 ? 8 : 2.5)
          .setTintFill(shellTint(p))
          .setDepth(14);
        this.fxLayer.add(img);
        this.shells.set(p.pid, img);
      }
      const { x, y, angle } = shellTransform(p);
      img.setPosition(x, y).setRotation(angle);
    }
    for (const [pid, img] of this.shells) {
      if (!live.has(pid)) {
        img.destroy();
        this.shells.delete(pid);
      }
    }
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    this.manualCamera = Math.max(0, this.manualCamera - dt);
    if (this.manualCamera > 0) return;

    // Frame the point of contact, biased slightly toward the player's side.
    const mine = this.sim.frontLine('player');
    const theirs = this.sim.frontLine('enemy');
    const focus = mine + (theirs - mine) * 0.45;
    const want = Phaser.Math.Clamp(
      focus - VIEW.width / 2,
      0,
      Math.max(0, this.sim.laneLength - VIEW.width),
    );
    cam.scrollX += (want - cam.scrollX) * CAMERA.followLerp;
  }

  /** -1..1 across the viewport. Beyond the edges it clamps rather than wraps. */
  private panAt(x: number): number {
    const cam = this.cameras.main;
    return Phaser.Math.Clamp(((x - cam.scrollX) / VIEW.width) * 2 - 1, -1, 1);
  }

  private isOnScreen(x: number): boolean {
    const cam = this.cameras.main;
    return x > cam.scrollX - 80 && x < cam.scrollX + VIEW.width + 80;
  }

  private publish(): void {
    const sim = this.sim;
    const p = sim.player;
    const e = sim.enemy;
    const age = ageAt(p.ageIndex);
    const nextAge = AGES[p.ageIndex + 1] ?? null;

    const blips: LaneBlip[] = sim.units.map((u) => ({
      x: u.x,
      faction: u.faction,
      role: u.def.role,
      hp: u.maxHp > 0 ? u.hp / u.maxHp : 0,
    }));

    const snapshot: HudSnapshot = {
      gold: Math.floor(p.gold),
      xp: Math.floor(p.xp),
      ageIndex: p.ageIndex,
      xpToNext: xpToNextAge(p.ageIndex, p.xp),
      nextAgeXp: nextAge ? nextAge.evolveXp : null,
      canEvolve: sim.canEvolve('player'),

      baseHp: Math.max(0, Math.ceil(p.baseHp)),
      baseMaxHp: p.baseMaxHp,
      enemyBaseHp: Math.max(0, Math.ceil(e.baseHp)),
      enemyBaseMaxHp: e.baseMaxHp,
      enemyAgeIndex: e.ageIndex,

      specialCd: p.specialCd,
      specialMax: SPECIALS[age.id].cooldown,

      queue: [...p.queue],
      cooldowns: { ...p.cooldowns },
      slots: p.slots.map((s) => s?.def.id ?? null),
      unlockedSlots: p.unlockedSlots,

      fieldCount: sim.fieldCount('player'),
      enemyFieldCount: sim.fieldCount('enemy'),
      maxField: SIM.maxUnitsPerSide,

      blips,
      playerFront: sim.frontLine('player'),
      enemyFront: sim.frontLine('enemy'),
      playerGround: p.ground,
      enemyGround: e.ground,
      laneLength: sim.laneLength,
      cameraX: this.cameras.main.scrollX,
      cameraSpan: VIEW.width,

      elapsed: sim.elapsed,
      survival: !!this.waves,
      wave: this.waves?.waveNumber ?? 0,
      waveCountdown: this.waves?.countdown ?? 0,
      veterancy: sim.enemy.buff,
      timeLeft: sim.timeLeft,
      timeLimit: sim.level.timeLimit,
      escalation: sim.escalation,
      paused: this.paused,
      over: this.finished ? sim.over : null,
      decidedBy: sim.decidedBy,
      stats: sim.stats,
    };

    bridge.publish(snapshot);
  }

  private tornDown = false;

  private teardown(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.stopOnline?.();
    this.stopOnline = null;
    audio.stopBed();
    // The handle points at a scene whose Matter world is about to be null, so it
    // goes with the scene.
    delete (window as unknown as Record<string, unknown>).__aow;
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    for (const img of this.shells.values()) img.destroy();
    this.shells.clear();
    this.ragdolls?.clear();
    this.backdrop?.destroy();
    this.playerBase?.destroy();
    this.enemyBase?.destroy();
  }
}

/** Parabolic path so lobbed shots land exactly on the target every time. */
function shellTransform(p: SimProjectile): { x: number; y: number; angle: number } {
  const t = Phaser.Math.Clamp(p.t, 0, 1);
  const x = p.sx + (p.tx - p.sx) * t;
  const y = p.sy + (p.ty - p.sy) * t - p.arcH * 4 * t * (1 - t);
  // Slope from the analytic derivative, so the shell noses over at apex.
  const dx = p.tx - p.sx;
  const dy = p.ty - p.sy - p.arcH * 4 * (1 - 2 * t);
  return { x, y, angle: Math.atan2(dy, dx) };
}

function shellTint(p: SimProjectile): number {
  switch (p.kind) {
    case 'energy':
      return 0x5fe4dc;
    case 'blast':
      return 0xe8913a;
    case 'pierce':
      return 0xf0e4c4;
    default:
      return 0xcbb894;
  }
}

/**
 * Phaser game config. Landscape, fitted, Matter enabled.
 *
 * No `scene` entry on purpose: the caller adds BattleScene with the level data,
 * because an autostarted scene would reach `create()` before it had a level.
 */
export function battleGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: VIEW.width,
    height: VIEW.height,
    backgroundColor: '#a2d0df',
    antialias: true,
    powerPreference: 'high-performance',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: VIEW.width,
      height: VIEW.height,
    },
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: 1.15 },
        enableSleeping: true,
        debug: false,
      },
    },
    fps: { target: 60, forceSetTimeOut: false },
  };
}

export const WORLD_REF = WORLD;
