import type { LevelDef, Faction } from '@/data/types';
import type { GameCommand } from '@/game/bridge';
import type { FactionStats } from '@/game/sim/BattleSim';
import type { Commander, SimEvent, SimProjectile, SimUnit } from '@/game/sim/types';

export type MatchMode = 'friend' | 'random' | 'ranked';
export type OnlineCommand = Extract<GameCommand, { t: 'unit' | 'turret' | 'unlockSlot' | 'scrap' | 'evolve' | 'special' }>;

export const ONLINE_LEVEL: LevelDef = {
  id: 0,
  name: 'DUEL FIELD',
  briefing: 'Two commanders, one lane. Break the opposing gate or hold more ground when time expires.',
  baseHp: 1500,
  startGold: 600,
  income: 10,
  maxAge: 4,
  timeLimit: 360,
  enemy: { aggression: 0, economy: 1, warmup: 0 },
  modifiers: [],
  reward: 0,
};

export interface PublicProfile {
  id: string;
  name: string;
  code: string;
  rating: number;
  wins: number;
  losses: number;
}

export interface FriendProfile extends PublicProfile {
  online: boolean;
}

/** Every state sent to a client is mirrored into its own left-side perspective. */
export interface OnlineBattleState {
  player: Commander;
  enemy: Commander;
  units: SimUnit[];
  projectiles: SimProjectile[];
  events: SimEvent[];
  elapsed: number;
  over: Faction | null;
  decidedBy: 'gate' | 'structure' | 'ground';
  stats: Record<Faction, FactionStats>;
}

export type ClientMessage =
  | { t: 'hello'; token?: string }
  | { t: 'set_name'; name: string }
  | { t: 'friend_add'; code: string }
  | { t: 'challenge'; friendId: string }
  | { t: 'challenge_answer'; fromId: string; accept: boolean }
  | { t: 'queue'; mode: 'random' | 'ranked' }
  | { t: 'cancel_queue' }
  | { t: 'command'; matchId: string; command: OnlineCommand }
  | { t: 'leave'; matchId: string }
  | { t: 'leaderboard' };

export type ServerMessage =
  | { t: 'welcome'; token: string; profile: PublicProfile; friends: FriendProfile[]; leaderboard: PublicProfile[] }
  | { t: 'profile'; profile: PublicProfile; friends: FriendProfile[] }
  | { t: 'leaderboard'; entries: PublicProfile[] }
  | { t: 'queued'; mode: 'random' | 'ranked' }
  | { t: 'invite'; from: PublicProfile }
  | { t: 'notice'; message: string }
  | { t: 'error'; message: string }
  | { t: 'match'; matchId: string; mode: MatchMode; opponent: PublicProfile; seed: number }
  | { t: 'state'; matchId: string; state: OnlineBattleState }
  | { t: 'reject'; reason: 'poor' | 'locked' | 'cooldown' | 'full' }
  | { t: 'result'; matchId: string; won: boolean; mode: MatchMode; reason: string; ratingDelta: number; rating: number };
