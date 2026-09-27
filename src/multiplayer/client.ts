import { useSyncExternalStore } from 'react';
import type { ClientMessage, FriendProfile, MatchMode, OnlineBattleState, OnlineCommand, PublicProfile, ServerMessage } from './protocol';

export interface OnlineMatchInfo {
  matchId: string;
  mode: MatchMode;
  opponent: PublicProfile;
  seed: number;
}
export interface OnlineResult {
  matchId: string;
  won: boolean;
  mode: MatchMode;
  reason: string;
  ratingDelta: number;
  rating: number;
}
export interface OnlineView {
  connection: 'offline' | 'connecting' | 'online';
  profile: PublicProfile | null;
  friends: FriendProfile[];
  leaderboard: PublicProfile[];
  queue: 'random' | 'ranked' | null;
  invite: PublicProfile | null;
  match: OnlineMatchInfo | null;
  result: OnlineResult | null;
  message: string;
}

const TOKEN_KEY = 'aow.online.token.v1';
function endpoint(): string {
  const configured = import.meta.env.VITE_MULTIPLAYER_URL as string | undefined;
  if (configured) return configured;
  if (!location.host || !/^https?:$/.test(location.protocol)) return '';
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.DEV ? `${location.hostname}:8787` : location.host;
  return `${scheme}//${host}/ws`;
}

class OnlineClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private battleListeners = new Set<(state: OnlineBattleState) => void>();
  private reconnectTimer: number | null = null;
  private lastBattle: { matchId: string; state: OnlineBattleState } | null = null;
  private view: OnlineView = {
    connection: 'offline', profile: null, friends: [], leaderboard: [], queue: null,
    invite: null, match: null, result: null, message: '',
  };

  snapshot = (): OnlineView => this.view;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  onBattle(listener: (state: OnlineBattleState) => void, matchId: string): () => void {
    this.battleListeners.add(listener);
    if (this.lastBattle?.matchId === matchId) listener(this.lastBattle.state);
    return () => this.battleListeners.delete(listener);
  }
  private update(patch: Partial<OnlineView>): void {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) return;
    const url = endpoint();
    if (!url) { this.update({ message: 'Set VITE_MULTIPLAYER_URL to your game server.', connection: 'offline' }); return; }
    this.update({ connection: 'connecting', message: '' });
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => this.send({ t: 'hello', token: localStorage.getItem(TOKEN_KEY) ?? undefined });
    socket.onmessage = (event) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(event.data as string) as ServerMessage; } catch { return; }
      this.handle(msg);
    };
    socket.onerror = () => this.update({ message: 'Could not reach the multiplayer server.' });
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.lastBattle = null;
      this.update({ connection: 'offline', queue: null, match: null, message: 'Connection lost. Reconnecting…' });
      this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.connect(); }, 2500);
    };
  }
  private handle(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome':
        localStorage.setItem(TOKEN_KEY, msg.token);
        this.update({ connection: 'online', profile: msg.profile, friends: msg.friends, leaderboard: msg.leaderboard, message: '' });
        break;
      case 'profile': this.update({ profile: msg.profile, friends: msg.friends }); break;
      case 'leaderboard': this.update({ leaderboard: msg.entries }); break;
      case 'queued': this.update({ queue: msg.mode, message: `Searching for a ${msg.mode === 'random' ? 'casual' : 'ranked'} opponent…` }); break;
      case 'invite': this.update({ invite: msg.from }); break;
      case 'notice': case 'error': this.update({ message: msg.message, queue: msg.message.includes('cancelled') ? null : this.view.queue }); break;
      case 'match':
        this.lastBattle = null;
        this.update({ match: msg, result: null, queue: null, invite: null, message: '' });
        break;
      case 'state':
        if (this.view.match?.matchId !== msg.matchId) return;
        this.lastBattle = { matchId: msg.matchId, state: msg.state };
        for (const listener of this.battleListeners) listener(msg.state);
        break;
      case 'reject':
        this.update({ message: `Order refused: ${msg.reason}.` });
        break;
      case 'result':
        this.update({ result: msg, queue: null });
        break;
    }
  }
  send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
  }
  setName(name: string): void { this.send({ t: 'set_name', name }); }
  addFriend(code: string): void { this.send({ t: 'friend_add', code }); }
  challenge(friendId: string): void { this.send({ t: 'challenge', friendId }); }
  answerInvite(fromId: string, accept: boolean): void {
    this.update({ invite: null });
    this.send({ t: 'challenge_answer', fromId, accept });
  }
  queue(mode: 'random' | 'ranked'): void { this.send({ t: 'queue', mode }); }
  cancelQueue(): void { this.update({ queue: null, message: '' }); this.send({ t: 'cancel_queue' }); }
  command(matchId: string, command: OnlineCommand): void { this.send({ t: 'command', matchId, command }); }
  leave(matchId: string): void { this.send({ t: 'leave', matchId }); }
  returnToLobby(): void { this.lastBattle = null; this.update({ match: null }); }
  clearMatch(): void { this.lastBattle = null; this.update({ match: null, result: null }); }
  requestLeaderboard(): void { this.send({ t: 'leaderboard' }); }
  disconnect(): void {
    if (this.reconnectTimer != null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(); this.socket = null;
  }
}

export const onlineClient = new OnlineClient();
export function useOnline(): OnlineView { return useSyncExternalStore(onlineClient.subscribe, onlineClient.snapshot); }
