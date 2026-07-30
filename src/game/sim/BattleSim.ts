import { AGES, AGE_COUNT } from '@/data/ages';
import { SPECIALS } from '@/data/specials';
import { SLOT_UNLOCK_COST, TURRET_BY_ID, TURRET_SLOTS, turretsForAge } from '@/data/turrets';
import { UNIT_BY_ID } from '@/data/units';
import type { AgeId, DamageKind, Faction, LevelDef, UnitDef } from '@/data/types';
import { ECON, SIM, VIEW, WORLD } from '@/game/config';
import { Rng } from './rng';
import type {
  Commander,
  ProjectileTarget,
  PurchaseResult,
  SimEvent,
  SimProjectile,
  SimUnit,
} from './types';

const AGE_INDEX: Record<AgeId, number> = AGES.reduce(
  (acc, a) => {
    acc[a.id] = a.index;
    return acc;
  },
  {} as Record<AgeId, number>,
);

/** Reach at or below this counts as a melee swing: instant, no projectile. */
const MELEE_REACH = 60;

export interface FactionStats {
  kills: number;
  losses: number;
  goldSpent: number;
  baseDamage: number;
  peakAge: number;
}

/**
 * Headless battle simulation. Fixed timestep, no rendering, no Phaser. The
 * scene reads `units`/`projectiles` to draw and drains `events` to spawn
 * ragdolls and effects. The enemy AI drives it through the same public
 * methods the player's UI does.
 */
export class BattleSim {
  readonly level: LevelDef;
  readonly laneLength: number;
  readonly maxAgeIndex: number;

  player: Commander;
  enemy: Commander;
  units: SimUnit[] = [];
  projectiles: SimProjectile[] = [];
  /** Drained by the renderer every frame. */
  events: SimEvent[] = [];
  over: Faction | null = null;
  elapsed = 0;

  stats: Record<Faction, FactionStats> = {
    player: { kills: 0, losses: 0, goldSpent: 0, baseDamage: 0, peakAge: 0 },
    enemy: { kills: 0, losses: 0, goldSpent: 0, baseDamage: 0, peakAge: 0 },
  };

  private rng: Rng;
  private nextUid = 1;
  private nextPid = 1;
  private accumulator = 0;

  constructor(level: LevelDef, seed = 1337) {
    this.level = level;
    this.rng = new Rng(seed);
    this.maxAgeIndex = Math.min(level.maxAge, AGE_COUNT - 1);

    const wide = level.modifiers.includes('artillery-duel');
    this.laneLength = Math.round(WORLD.laneLength * (wide ? WORLD.wideLaneScale : 1));

    const income = ECON.baseIncome + level.income;
    this.player = this.makeCommander('player', WORLD.baseInset, income, level.startGold);
    // The enemy's war chest scales with its economy setting too. Handing an
    // "economy 0.5" commander the same opening gold as the player made the early
    // missions far harder than their difficulty numbers claimed.
    this.enemy = this.makeCommander(
      'enemy',
      this.laneLength - WORLD.baseInset,
      income * level.enemy.economy,
      Math.round(level.startGold * level.enemy.economy),
    );

    if (level.modifiers.includes('no-turrets')) {
      this.player.unlockedSlots = 0;
      this.enemy.unlockedSlots = 0;
    }
  }

  private makeCommander(
    faction: Faction,
    baseX: number,
    income: number,
    startGold: number,
  ): Commander {
    const maxHp = Math.round(this.level.baseHp * AGES[0].baseArmour);
    return {
      faction,
      gold: startGold,
      xp: 0,
      ageIndex: 0,
      baseHp: maxHp,
      baseMaxHp: maxHp,
      baseX,
      queue: [],
      gateTimer: 0,
      cooldowns: {},
      slots: new Array(TURRET_SLOTS).fill(null),
      unlockedSlots: 2,
      specialCd: 0,
      income,
    };
  }

  // ------------------------------------------------------------ public helpers

  commander(faction: Faction): Commander {
    return faction === 'player' ? this.player : this.enemy;
  }

  opponent(faction: Faction): Commander {
    return faction === 'player' ? this.enemy : this.player;
  }

  /** +1 for the player (walks right), -1 for the enemy (walks left). */
  static dir(faction: Faction): number {
    return faction === 'player' ? 1 : -1;
  }

  fieldCount(faction: Faction): number {
    let n = 0;
    for (const u of this.units) if (u.faction === faction && !u.dead) n++;
    return n;
  }

  /**
   * Income multiplier from match escalation. Ramps from 1 to ECON.escalationMax
   * so a stalled grind eventually turns into pushes neither front line can hold.
   * See the note in config.ts for why this exists.
   */
  get escalation(): number {
    const { escalationStart, escalationFull, escalationMax } = ECON;
    if (this.elapsed <= escalationStart) return 1;
    const t = Math.min(1, (this.elapsed - escalationStart) / (escalationFull - escalationStart));
    return 1 + t * (escalationMax - 1);
  }

  /** Frontmost friendly position, or the gate if nothing is deployed. */
  frontLine(faction: Faction): number {
    const dir = BattleSim.dir(faction);
    let best = this.commander(faction).baseX;
    for (const u of this.units) {
      if (u.faction !== faction || u.dead) continue;
      if ((u.x - best) * dir > 0) best = u.x;
    }
    return best;
  }

  canEvolve(faction: Faction): boolean {
    const c = this.commander(faction);
    if (c.ageIndex >= this.maxAgeIndex) return false;
    const next = AGES[c.ageIndex + 1];
    return !!next && c.xp >= next.evolveXp;
  }

  unitAvailable(faction: Faction, defId: string): boolean {
    const def = UNIT_BY_ID[defId];
    if (!def) return false;
    return AGE_INDEX[def.age] <= this.commander(faction).ageIndex;
  }

  // -------------------------------------------------------------- commands

  queueUnit(faction: Faction, defId: string): PurchaseResult {
    const c = this.commander(faction);
    const def = UNIT_BY_ID[defId];
    if (!def || AGE_INDEX[def.age] > c.ageIndex) return 'locked';
    if (c.queue.length >= SIM.maxQueue) return 'full';
    if ((c.cooldowns[defId] ?? 0) > 0) return 'cooldown';
    if (c.gold < def.gold) return 'poor';

    c.gold -= def.gold;
    c.cooldowns[defId] = def.cooldown;
    c.queue.push(defId);
    this.stats[faction].goldSpent += def.gold;
    return 'ok';
  }

  unlockSlot(faction: Faction, slotIndex: number): PurchaseResult {
    const c = this.commander(faction);
    if (this.level.modifiers.includes('no-turrets')) return 'locked';
    if (slotIndex !== c.unlockedSlots || slotIndex >= TURRET_SLOTS) return 'locked';
    const cost = SLOT_UNLOCK_COST[slotIndex];
    if (c.gold < cost) return 'poor';
    c.gold -= cost;
    c.unlockedSlots += 1;
    this.stats[faction].goldSpent += cost;
    return 'ok';
  }

  buildTurret(faction: Faction, slotIndex: number, turretId: string): PurchaseResult {
    const c = this.commander(faction);
    if (slotIndex >= c.unlockedSlots) return 'locked';
    const def = TURRET_BY_ID[turretId];
    if (!def || AGE_INDEX[def.age] > c.ageIndex) return 'locked';
    if (c.gold < def.gold) return 'poor';
    c.gold -= def.gold;
    c.slots[slotIndex] = { def, reload: 1 / def.rate };
    this.stats[faction].goldSpent += def.gold;
    return 'ok';
  }

  /** Refunds half, for swapping a role that is not answering what you face. */
  scrapTurret(faction: Faction, slotIndex: number): PurchaseResult {
    const c = this.commander(faction);
    const slot = c.slots[slotIndex];
    if (!slot) return 'locked';
    c.gold += Math.floor(slot.def.gold * 0.5);
    c.slots[slotIndex] = null;
    return 'ok';
  }

  evolve(faction: Faction): PurchaseResult {
    if (!this.canEvolve(faction)) return 'locked';
    const c = this.commander(faction);
    c.ageIndex += 1;

    // Reinforce the gate and heal by the amount the upgrade added.
    const nextMax = Math.round(this.level.baseHp * AGES[c.ageIndex].baseArmour);
    c.baseHp += nextMax - c.baseMaxHp;
    c.baseMaxHp = nextMax;

    // Emplacements come with you, upgraded to the same role in the new age and
    // free of charge, exactly as in the original. This is what makes "fill your
    // mounts before you age up" the right play rather than a trap: stripping
    // them instead left the player undefended at the worst possible moment and
    // made evolving a losing move.
    const nextTurrets = turretsForAge(AGES[c.ageIndex].id);
    for (let i = 0; i < c.slots.length; i++) {
      const existing = c.slots[i];
      if (!existing) continue;
      const upgrade = nextTurrets.find((t) => t.role === existing.def.role);
      if (upgrade) c.slots[i] = { def: upgrade, reload: 1 / upgrade.rate };
    }

    // A fresh age brings a fresh special, and unit cooldowns start clean.
    c.specialCd = 0;
    c.cooldowns = {};
    this.stats[faction].peakAge = c.ageIndex;

    this.events.push({ t: 'evolve', faction, ageIndex: c.ageIndex });
    return 'ok';
  }

  fireSpecial(faction: Faction): PurchaseResult {
    const c = this.commander(faction);
    if (c.specialCd > 0) return 'cooldown';
    const def = SPECIALS[AGES[c.ageIndex].id];
    c.specialCd = def.cooldown;

    // Centre the barrage on wherever the fighting actually is.
    const dir = BattleSim.dir(faction);
    const contact = this.frontLine(this.opponent(faction).faction);
    const window = 380 + def.strikes * 26;
    const points: number[] = [];
    for (let i = 0; i < def.strikes; i++) {
      const spread = (i / Math.max(1, def.strikes - 1) - 0.5) * window;
      const jitter = this.rng.range(-26, 26);
      const x = clamp(contact + spread + jitter + dir * 60, 40, this.laneLength - 40);
      points.push(x);
    }

    for (const x of points) {
      this.explode(x, def.damage, def.blast, 'blast', faction, def.impulse);
    }
    this.events.push({ t: 'special', faction, points });
    return 'ok';
  }

  // ------------------------------------------------------------------- stepping

  /** Feeds real frame time into the fixed-step sim. */
  advance(dtSeconds: number): void {
    if (this.over) return;
    this.accumulator += Math.min(dtSeconds, SIM.step * SIM.maxCatchUpSteps);
    let guard = 0;
    while (this.accumulator >= SIM.step && guard < SIM.maxCatchUpSteps && !this.over) {
      this.accumulator -= SIM.step;
      this.step();
      guard++;
    }
  }

  private step(): void {
    const dt = SIM.step;
    this.elapsed += dt;

    const escalation = this.escalation;
    for (const c of [this.player, this.enemy]) {
      c.gold += c.income * escalation * dt;
      c.specialCd = Math.max(0, c.specialCd - dt);
      for (const key of Object.keys(c.cooldowns)) {
        if (c.cooldowns[key] > 0) c.cooldowns[key] = Math.max(0, c.cooldowns[key] - dt);
      }
      this.runGate(c, dt);
      this.runTurrets(c, dt);
    }

    this.moveAndFight('player', dt);
    this.moveAndFight('enemy', dt);
    this.stepProjectiles(dt);
    this.sweepDead();
    this.checkOver();
  }

  private runGate(c: Commander, dt: number): void {
    c.gateTimer -= dt;
    if (c.gateTimer > 0 || c.queue.length === 0) return;
    if (this.fieldCount(c.faction) >= SIM.maxUnitsPerSide) return;

    const defId = c.queue.shift()!;
    const def = UNIT_BY_ID[defId];
    if (!def) return;
    const dir = BattleSim.dir(c.faction);
    const unit: SimUnit = {
      uid: this.nextUid++,
      def,
      faction: c.faction,
      x: c.baseX + dir * (WORLD.baseHalfWidth + 16),
      hp: def.hp,
      maxHp: def.hp,
      reload: 1 / def.rate,
      engaging: false,
      phase: this.rng.range(0, Math.PI * 2),
      dead: false,
      shove: 0,
    };
    this.units.push(unit);
    c.gateTimer = SIM.gateInterval;
    this.events.push({ t: 'spawn', uid: unit.uid, faction: c.faction, defId });
  }

  private runTurrets(c: Commander, dt: number): void {
    const dir = BattleSim.dir(c.faction);
    const muzzleY = VIEW.groundY - WORLD.baseHeight * 0.72;
    for (const slot of c.slots) {
      if (!slot) continue;
      slot.reload -= dt;
      if (slot.reload > 0) continue;

      const originX = c.baseX + dir * WORLD.baseHalfWidth;
      const target = this.nearestEnemyUnit(c.faction, originX, slot.def.range, dir);
      if (!target) continue;

      slot.reload = 1 / slot.def.rate;
      this.launch({
        sx: originX,
        sy: muzzleY,
        tx: target.x,
        ty: VIEW.groundY - target.def.height * 0.5,
        damage: slot.def.damage,
        blast: slot.def.blast,
        kind: slot.def.damageKind,
        hostileTo: this.opponent(c.faction).faction,
        target: { kind: 'unit', uid: target.uid },
        arc: slot.def.role === 'mortar',
        impulse: slot.def.role === 'mortar' ? 0.5 : 0.1,
      });
    }
  }

  private moveAndFight(faction: Faction, dt: number): void {
    const dir = BattleSim.dir(faction);
    const foe = this.opponent(faction);
    const gateEdge = foe.baseX - dir * WORLD.baseHalfWidth;
    const ownGate = this.commander(faction).baseX;

    // Frontmost first, so each unit queues behind the one ahead of it.
    const line = this.units
      .filter((u) => u.faction === faction && !u.dead)
      .sort((a, b) => (b.x - a.x) * dir);

    let blockAt: number | null = null;

    for (const u of line) {
      if (u.shove !== 0) {
        const applied = u.shove * 0.3;
        u.x += applied;
        u.shove -= applied;
        if (Math.abs(u.shove) < 0.05) u.shove = 0;
      }

      u.reload = Math.max(0, u.reload - dt);

      const prey = this.nearestEnemyUnit(faction, u.x, u.def.range, dir);
      const baseDist = Math.abs(gateEdge - u.x);
      const baseInReach = baseDist <= u.def.range;

      if (prey) {
        u.engaging = true;
        if (u.reload <= 0) this.attackUnit(u, prey);
      } else if (baseInReach) {
        u.engaging = true;
        if (u.reload <= 0) this.attackBase(u, foe.faction, gateEdge);
      } else {
        u.engaging = false;
        let next = u.x + dir * u.def.speed * dt;
        if (blockAt !== null && (next - blockAt) * dir > 0) next = blockAt;
        // Never walk into the enemy gate or back through your own.
        const forwardLimit = gateEdge - dir * 4;
        if ((next - forwardLimit) * dir > 0) next = forwardLimit;
        if ((next - ownGate) * dir < 0) next = ownGate;
        u.phase += Math.abs(next - u.x) * 0.05;
        u.x = next;
      }

      blockAt = u.x - dir * SIM.spacing;
    }
  }

  /** Nearest live enemy ahead of `fromX` within `range`. */
  private nearestEnemyUnit(
    faction: Faction,
    fromX: number,
    range: number,
    dir: number,
  ): SimUnit | null {
    let best: SimUnit | null = null;
    let bestDist = Infinity;
    for (const u of this.units) {
      if (u.dead || u.faction === faction) continue;
      const rel = (u.x - fromX) * dir;
      // A small negative window lets a unit finish off something beside it.
      if (rel < -14) continue;
      const dist = Math.abs(u.x - fromX);
      if (dist <= range && dist < bestDist) {
        bestDist = dist;
        best = u;
      }
    }
    return best;
  }

  private attackUnit(u: SimUnit, prey: SimUnit): void {
    u.reload = 1 / u.def.rate;
    const dir = BattleSim.dir(u.faction);
    const heavy = u.def.role === 'heavy' || u.def.role === 'artillery';

    if (u.def.range <= MELEE_REACH) {
      const impactY = VIEW.groundY - prey.def.height * 0.55;
      this.events.push({ t: 'melee', x: prey.x, y: impactY, kind: u.def.damageKind, heavy });
      if (u.def.blast > 0) {
        this.explode(prey.x, u.def.damage, u.def.blast, u.def.damageKind, u.faction, heavy ? 0.6 : 0.2);
      } else {
        this.hurtUnit(prey, u.def.damage, u.faction, dir, heavy ? 0.8 : 0.15, u.def.damageKind);
        if (heavy) prey.shove += dir * SIM.knockback;
      }
      return;
    }

    this.launch({
      sx: u.x + dir * 16,
      sy: VIEW.groundY - u.def.height * 0.78,
      tx: prey.x,
      ty: VIEW.groundY - prey.def.height * 0.5,
      damage: u.def.damage,
      blast: u.def.blast,
      kind: u.def.damageKind,
      hostileTo: prey.faction,
      target: { kind: 'unit', uid: prey.uid },
      arc: u.def.role === 'artillery',
      impulse: u.def.role === 'artillery' ? 0.7 : 0.15,
    });
  }

  private attackBase(u: SimUnit, foe: Faction, gateEdge: number): void {
    u.reload = 1 / u.def.rate;
    const dir = BattleSim.dir(u.faction);

    if (u.def.range <= MELEE_REACH) {
      this.hurtBase(foe, u.def.damage, u.faction, gateEdge);
      this.events.push({
        t: 'melee',
        x: gateEdge,
        y: VIEW.groundY - WORLD.baseHeight * 0.4,
        kind: u.def.damageKind,
        heavy: u.def.role === 'heavy',
      });
      return;
    }

    this.launch({
      sx: u.x + dir * 16,
      sy: VIEW.groundY - u.def.height * 0.78,
      tx: gateEdge,
      ty: VIEW.groundY - WORLD.baseHeight * 0.45,
      damage: u.def.damage,
      blast: u.def.blast,
      kind: u.def.damageKind,
      hostileTo: foe,
      target: { kind: 'base', faction: foe },
      arc: u.def.role === 'artillery',
      impulse: 0.4,
    });
  }

  private launch(opts: {
    sx: number;
    sy: number;
    tx: number;
    ty: number;
    damage: number;
    blast: number;
    kind: DamageKind;
    hostileTo: Faction;
    target: ProjectileTarget;
    arc: boolean;
    impulse: number;
  }): void {
    const dist = Math.hypot(opts.tx - opts.sx, opts.ty - opts.sy);
    const speed = opts.arc ? SIM.arcSpeed : SIM.boltSpeed;
    const p: SimProjectile = {
      pid: this.nextPid++,
      sx: opts.sx,
      sy: opts.sy,
      tx: opts.tx,
      ty: opts.ty,
      t: 0,
      dur: Math.max(0.06, dist / speed),
      arcH: opts.arc ? clamp(dist * 0.4, 46, 190) : 0,
      damage: opts.damage,
      blast: opts.blast,
      kind: opts.kind,
      hostileTo: opts.hostileTo,
      target: opts.target,
      impulse: opts.impulse,
    };
    this.projectiles.push(p);
    this.events.push({ t: 'shot', pid: p.pid, sx: p.sx, sy: p.sy, kind: p.kind, arc: opts.arc });
  }

  private stepProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt / p.dur;
      if (p.t < 1) continue;

      this.projectiles.splice(i, 1);
      this.events.push({ t: 'travelEnd', pid: p.pid });

      const attacker: Faction = p.hostileTo === 'player' ? 'enemy' : 'player';

      if (p.target.kind === 'base') {
        const gateEdge =
          this.commander(p.target.faction).baseX -
          BattleSim.dir(attacker) * WORLD.baseHalfWidth;
        this.hurtBase(p.target.faction, p.damage, attacker, gateEdge);
        this.events.push({
          t: 'impact',
          x: p.tx,
          y: p.ty,
          blast: Math.max(p.blast, 22),
          kind: p.kind,
          heavy: p.blast > 0,
        });
        continue;
      }

      if (p.blast > 0) {
        this.explode(p.tx, p.damage, p.blast, p.kind, attacker, p.impulse);
        this.events.push({ t: 'impact', x: p.tx, y: p.ty, blast: p.blast, kind: p.kind, heavy: true });
        continue;
      }

      const hit =
        this.units.find((u) => u.uid === (p.target as { uid: number }).uid && !u.dead) ??
        this.nearestEnemyUnit(attacker, p.tx, 26, BattleSim.dir(attacker));

      this.events.push({
        t: 'impact',
        x: p.tx,
        y: p.ty,
        blast: 0,
        kind: p.kind,
        heavy: false,
      });
      if (hit) {
        this.hurtUnit(hit, p.damage, attacker, BattleSim.dir(attacker), p.impulse, p.kind);
      }
    }
  }

  /** Splash damage centred on a lane position. */
  private explode(
    x: number,
    damage: number,
    blast: number,
    kind: DamageKind,
    attacker: Faction,
    impulse: number,
  ): void {
    const dir = BattleSim.dir(attacker);
    for (const u of this.units) {
      if (u.dead || u.faction === attacker) continue;
      const d = Math.abs(u.x - x);
      if (d > blast) continue;
      // Full damage at the centre, 40% at the rim.
      const falloff = 1 - 0.6 * (d / blast);
      const away = u.x >= x ? 1 : -1;
      this.hurtUnit(u, damage * falloff, attacker, away * Math.abs(dir), impulse, kind);
      u.shove += away * SIM.knockback * impulse;
    }
  }

  private hurtUnit(
    target: SimUnit,
    amount: number,
    attacker: Faction,
    dirX: number,
    impulse: number,
    kind: DamageKind,
  ): void {
    if (target.dead) return;
    target.hp -= amount;
    if (target.hp > 0) return;

    target.dead = true;
    const c = this.commander(attacker);
    c.xp += target.def.bounty;
    c.gold += target.def.loot * ECON.lootScale;
    this.stats[attacker].kills += 1;
    this.stats[target.faction].losses += 1;

    // Overkill throws the corpse further. This is the whole point of ragdolls.
    const lethality = clamp(amount / target.maxHp, 0.3, 2.6);
    const force = lethality * (1 + impulse) * (2.4 / (1.4 + target.def.mass));

    this.events.push({
      t: 'death',
      uid: target.uid,
      defId: target.def.id,
      faction: target.faction,
      x: target.x,
      dirX: dirX >= 0 ? 1 : -1,
      force,
      kind,
    });
  }

  private hurtBase(faction: Faction, amount: number, attacker: Faction, atX: number): void {
    const c = this.commander(faction);
    if (c.baseHp <= 0) return;
    const dealt = Math.min(amount, c.baseHp);
    c.baseHp -= dealt;
    this.stats[attacker].baseDamage += dealt;
    this.commander(attacker).xp += (dealt / 100) * ECON.baseDamageXp;
    this.events.push({ t: 'baseHit', faction, amount: dealt, x: atX });
  }

  private sweepDead(): void {
    for (let i = this.units.length - 1; i >= 0; i--) {
      if (this.units[i].dead) this.units.splice(i, 1);
    }
  }

  /** Seconds left on the mission clock. */
  get timeLeft(): number {
    return Math.max(0, this.level.timeLimit - this.elapsed);
  }

  private checkOver(): void {
    if (this.over) return;
    if (this.enemy.baseHp <= 0) {
      this.finish('player');
      return;
    }
    if (this.player.baseHp <= 0) {
      this.finish('enemy');
      return;
    }
    if (this.elapsed < this.level.timeLimit) return;

    // Clock ran out. Structure first, then ground held. The second criterion
    // matters more than it looks: most timed-out matches end with both gates
    // untouched, and without it every one of those would quietly go to the
    // enemy no matter how hard the player had been pushing.
    const mine = this.player.baseHp / this.player.baseMaxHp;
    const theirs = this.enemy.baseHp / this.enemy.baseMaxHp;

    if (Math.abs(mine - theirs) > 0.005) {
      this.decidedBy = 'structure';
      this.finish(mine > theirs ? 'player' : 'enemy');
      return;
    }

    const mid = this.laneLength / 2;
    const myPush = this.frontLine('player') - mid;
    const theirPush = mid - this.frontLine('enemy');
    this.decidedBy = 'ground';
    this.finish(myPush >= theirPush ? 'player' : 'enemy');
  }

  /** How the match was settled. Shown in the debrief. */
  decidedBy: 'gate' | 'structure' | 'ground' = 'gate';

  private finish(winner: Faction): void {
    this.over = winner;
    this.events.push({ t: 'over', winner });
  }

  /** Called by the renderer once it has drained the frame's events. */
  clearEvents(): void {
    if (this.events.length) this.events.length = 0;
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function unitDef(id: string): UnitDef | undefined {
  return UNIT_BY_ID[id];
}
