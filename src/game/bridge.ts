import type { Faction, UnitRole } from '@/data/types';
import type { FactionStats } from '@/game/sim/BattleSim';

/**
 * The one seam between Phaser and React.
 *
 * React never reaches into the scene and the scene never touches React state.
 * Commands go down a queue, a throttled snapshot comes back up. That keeps the
 * 60fps sim off React's render path, which is the whole reason the HUD is DOM
 * and the battlefield is canvas.
 */

export interface LaneBlip {
  x: number;
  faction: Faction;
  role: UnitRole;
  /** 0..1 */
  hp: number;
}

export interface HudSnapshot {
  gold: number;
  xp: number;
  ageIndex: number;
  /** XP still owed for the next age, or null at the cap. */
  xpToNext: number | null;
  nextAgeXp: number | null;
  canEvolve: boolean;

  baseHp: number;
  baseMaxHp: number;
  enemyBaseHp: number;
  enemyBaseMaxHp: number;
  enemyAgeIndex: number;

  specialCd: number;
  specialMax: number;

  queue: string[];
  cooldowns: Record<string, number>;
  slots: (string | null)[];
  unlockedSlots: number;

  fieldCount: number;
  enemyFieldCount: number;
  maxField: number;

  blips: LaneBlip[];
  playerFront: number;
  enemyFront: number;
  laneLength: number;
  cameraX: number;
  cameraSpan: number;

  elapsed: number;
  /** True in Survival: the clock counts waves, not a mission limit. */
  survival: boolean;
  /** Waves released so far. This is the Survival score. */
  wave: number;
  /** Seconds until the next wave lands. */
  waveCountdown: number;
  /** Enemy hitpoint/damage multiplier in Survival. 1 outside it. */
  veterancy: number;
  /** Seconds left on the mission clock. */
  timeLeft: number;
  timeLimit: number;
  /** Income multiplier from match escalation. 1 for the opening minute. */
  escalation: number;
  paused: boolean;
  over: Faction | null;
  /** How the match ended: a fallen gate, structure on the clock, or ground held. */
  decidedBy: 'gate' | 'structure' | 'ground';
  stats: Record<Faction, FactionStats>;
}

export type GameCommand =
  | { t: 'unit'; id: string }
  | { t: 'turret'; slot: number; id: string }
  | { t: 'unlockSlot'; slot: number }
  | { t: 'scrap'; slot: number }
  | { t: 'evolve' }
  | { t: 'special' }
  | { t: 'pause'; on: boolean }
  | { t: 'lookAt'; x: number }
  | { t: 'speed'; factor: number };

export type RejectReason = 'poor' | 'locked' | 'cooldown' | 'full';

type SnapshotListener = (snapshot: HudSnapshot) => void;
type RejectListener = (reason: RejectReason) => void;

class GameBridge {
  private commands: GameCommand[] = [];
  private snapshotListeners = new Set<SnapshotListener>();
  private rejectListeners = new Set<RejectListener>();

  /** React -> scene. */
  send(command: GameCommand): void {
    this.commands.push(command);
  }

  /** Scene -> drains everything queued since the last frame. */
  drain(): GameCommand[] {
    if (!this.commands.length) return [];
    const out = this.commands;
    this.commands = [];
    return out;
  }

  onSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  publish(snapshot: HudSnapshot): void {
    for (const listener of this.snapshotListeners) listener(snapshot);
  }

  /** Lets the HUD buzz a button that could not be afforded. */
  onReject(listener: RejectListener): () => void {
    this.rejectListeners.add(listener);
    return () => this.rejectListeners.delete(listener);
  }

  reject(reason: RejectReason): void {
    for (const listener of this.rejectListeners) listener(reason);
  }

  reset(): void {
    this.commands = [];
  }
}

export const bridge = new GameBridge();
