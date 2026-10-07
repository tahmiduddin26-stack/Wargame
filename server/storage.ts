import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import type { MatchMode, OnlineBattleRecord, PublicProfile } from '../src/multiplayer/protocol';

export interface StoredProfile extends PublicProfile {
  tokenHash: string;
  friends: string[];
}
export interface Account {
  profileId: string;
  username: string;
  passwordHash: string;
}
interface FinishedMatch {
  id: string;
  mode: MatchMode;
  seed: number;
  left: string;
  right: string;
  winner: string;
  reason: string;
  finishedAt: string;
}

function readProfile(value: unknown): StoredProfile {
  if (!value || typeof value !== 'object') throw new Error('Invalid online profile');
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name ||
      typeof p.code !== 'string' || !/^[A-F0-9]{6}$/.test(p.code) ||
      typeof p.tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(p.tokenHash) ||
      !Array.isArray(p.friends) || !p.friends.every((id) => typeof id === 'string') ||
      !['rating', 'wins', 'losses'].every((key) => typeof p[key] === 'number' && Number.isSafeInteger(p[key]) && (p[key] as number) >= 0)) {
    throw new Error('Invalid online profile; restore the source from a backup before restarting');
  }
  return { id: p.id, name: p.name, code: p.code, tokenHash: p.tokenHash, friends: p.friends as string[], rating: p.rating as number, wins: p.wins as number, losses: p.losses as number };
}

/** One process owns this database. Ratings and both results commit together. */
export class OnlineStorage {
  readonly db: DatabaseSync;
  constructor(path: string, legacyPath?: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, token_hash TEXT NOT NULL UNIQUE, data TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS accounts (
        profile_id TEXT PRIMARY KEY REFERENCES profiles(id), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY, mode TEXT NOT NULL, seed INTEGER NOT NULL, left_id TEXT NOT NULL REFERENCES profiles(id),
        right_id TEXT NOT NULL REFERENCES profiles(id), winner_id TEXT NOT NULL REFERENCES profiles(id),
        reason TEXT NOT NULL, finished_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS results (
        match_id TEXT NOT NULL REFERENCES matches(id), profile_id TEXT NOT NULL REFERENCES profiles(id),
        finished_at TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(match_id, profile_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS results_recent ON results(profile_id, finished_at DESC);
    `);
    if (!this.db.prepare("SELECT value FROM metadata WHERE key = 'legacy-import'").get()) {
      // Parse before writing anything. A corrupt legacy file must never become an empty database.
      try {
        const raw: unknown = legacyPath && existsSync(legacyPath) ? JSON.parse(readFileSync(legacyPath, 'utf8')) : [];
        if (!Array.isArray(raw)) throw new Error('Legacy profile file must be an array');
        const imported = raw.map(readProfile);
        if (new Set(imported.map((p) => p.id)).size !== imported.length) throw new Error('Duplicate legacy profile IDs');
        this.transaction(() => {
          for (const profile of imported) this.writeProfile(profile);
          this.db.prepare("INSERT INTO metadata(key, value) VALUES ('legacy-import', 'complete')").run();
        });
      } catch (error) { this.db.close(); throw error; }
    }
  }

  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private writeProfile(p: StoredProfile): void {
    this.db.prepare(`INSERT INTO profiles(id, code, token_hash, data) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET code = excluded.code, token_hash = excluded.token_hash, data = excluded.data`)
      .run(p.id, p.code, p.tokenHash, JSON.stringify(p));
  }
  profiles(): StoredProfile[] {
    return this.db.prepare('SELECT data FROM profiles').all().map((row) => readProfile(JSON.parse(row.data as string)));
  }
  saveProfiles(...profiles: StoredProfile[]): void {
    this.transaction(() => { for (const profile of profiles) this.writeProfile(profile); });
  }
  account(profileId: string): Account | null {
    const row = this.db.prepare('SELECT profile_id, username, password_hash FROM accounts WHERE profile_id = ?').get(profileId);
    return row ? { profileId: row.profile_id as string, username: row.username as string, passwordHash: row.password_hash as string } : null;
  }
  findAccount(username: string): Account | null {
    const row = this.db.prepare('SELECT profile_id, username, password_hash FROM accounts WHERE username = ?').get(username);
    return row ? { profileId: row.profile_id as string, username: row.username as string, passwordHash: row.password_hash as string } : null;
  }
  register(profile: StoredProfile, username: string, passwordHash: string): boolean {
    return this.transaction(() => {
      const added = this.db.prepare('INSERT OR IGNORE INTO accounts(profile_id, username, password_hash) VALUES (?, ?, ?)')
        .run(profile.id, username, passwordHash).changes === 1;
      if (added) this.writeProfile(profile);
      return added;
    });
  }
  changePassword(profile: StoredProfile, passwordHash: string): void {
    this.transaction(() => {
      this.db.prepare('UPDATE accounts SET password_hash = ? WHERE profile_id = ?').run(passwordHash, profile.id);
      this.writeProfile(profile);
    });
  }
  finishMatch(match: FinishedMatch, profiles: StoredProfile[], results: OnlineBattleRecord[]): boolean {
    return this.transaction(() => {
      if (this.db.prepare('SELECT id FROM matches WHERE id = ?').get(match.id)) return false;
      this.db.prepare('INSERT INTO matches VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(match.id, match.mode, match.seed, match.left, match.right, match.winner, match.reason, match.finishedAt);
      for (const p of profiles) this.writeProfile(p);
      for (let i = 0; i < profiles.length; i++) this.db.prepare('INSERT INTO results VALUES (?, ?, ?, ?)')
        .run(match.id, profiles[i].id, match.finishedAt, JSON.stringify(results[i]));
      return true;
    });
  }
  history(profileId: string): OnlineBattleRecord[] {
    return this.db.prepare('SELECT data FROM results WHERE profile_id = ? ORDER BY finished_at DESC, match_id DESC LIMIT 20')
      .all(profileId).map((row) => JSON.parse(row.data as string) as OnlineBattleRecord);
  }
  async backup(path: string): Promise<void> { await backup(this.db, path); }
  close(): void { this.db.close(); }
}
