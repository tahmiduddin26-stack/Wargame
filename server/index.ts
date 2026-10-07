import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { existsSync, createReadStream, statSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { BattleSim } from '../src/game/sim/BattleSim';
import { SIM } from '../src/game/config';
import { NO_PERKS } from '../src/data/perks';
import { ONLINE_LEVEL, type ClientMessage, type FriendProfile, type OnlineBattleState, type OnlineCommand, type PublicProfile, type ServerMessage, type MatchMode } from '../src/multiplayer/protocol';
import { canPairRanked } from '../src/multiplayer/ranks';
import type { Faction } from '../src/data/types';
import type { SimEvent, SimProjectile } from '../src/game/sim/types';
import type { TLSSocket } from 'node:tls';
import { OnlineStorage, type StoredProfile } from './storage';
import { AccountLimiter, hashPassword, username, validPassword, verifyPassword } from './accounts';

interface Match {
  id: string;
  mode: MatchMode;
  seed: number;
  left: string;
  right: string;
  sim: BattleSim;
  timer: ReturnType<typeof setInterval>;
  ticks: number;
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
const dataFile = resolve(process.env.MULTIPLAYER_DATA_FILE ?? resolve(projectRoot, '.data', 'multiplayer.json'));
const databaseFile = resolve(process.env.MULTIPLAYER_DB_FILE ?? dataFile.replace(/\.json$/i, '') + '.sqlite');
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';

const storage = new OnlineStorage(databaseFile, dataFile);
const profiles = new Map(storage.profiles().map((p) => [p.id, p]));
const accountLimiter = new AccountLimiter();
const sockets = new Map<string, WebSocket>();
const queues: Record<'random' | 'ranked', string[]> = { random: [], ranked: [] };
const queuedAt = new Map<string, number>();
const invites = new Map<string, string>();
const matches = new Map<string, Match>();
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingResults = new Map<string, { result: Extract<ServerMessage, { t: 'result' }>; expires: number }>();
const configuredGrace = Number(process.env.RECONNECT_GRACE_MS ?? 15000);
const reconnectGrace = Number.isFinite(configuredGrace) ? Math.max(1000, Math.min(60000, configuredGrace)) : 15000;

function clearDisconnect(id: string): void {
  const timer = disconnectTimers.get(id);
  if (timer) clearTimeout(timer);
  disconnectTimers.delete(id);
}

function sendMatch(match: Match, id: string): void {
  const rival = id === match.left ? match.right : match.left;
  send(sockets.get(id), { t: 'match', matchId: match.id, mode: match.mode, opponent: publicProfile(profiles.get(rival)!), seed: match.seed });
  send(sockets.get(id), { t: 'state', matchId: match.id, state: battleState(match, id) });
}

function save(...changed: StoredProfile[]): void { storage.saveProfiles(...changed); }
function send(socket: WebSocket | undefined, msg: ServerMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}
function publicProfile(p: StoredProfile): PublicProfile {
  const { id, name, code, rating, wins, losses } = p;
  return { id, name, code, rating, wins, losses };
}
function friendsOf(p: StoredProfile): FriendProfile[] {
  return p.friends.flatMap((id) => {
    const friend = profiles.get(id);
    return friend ? [{ ...publicProfile(friend), online: sockets.has(id) }] : [];
  });
}
function leaderboard(): PublicProfile[] {
  return [...profiles.values()].filter((p) => p.wins + p.losses > 0).sort((a, b) => b.rating - a.rating || b.wins - a.wins).slice(0, 50).map(publicProfile);
}
function profileUpdate(id: string): void {
  const p = profiles.get(id);
  if (p) send(sockets.get(id), { t: 'profile', profile: publicProfile(p), friends: friendsOf(p) });
}
function updateFriendPresence(id: string): void {
  const p = profiles.get(id);
  if (p) for (const friendId of p.friends) profileUpdate(friendId);
}
function matchFor(id: string): Match | undefined {
  return [...matches.values()].find((m) => m.left === id || m.right === id);
}
function removeFromQueues(id: string): void {
  queuedAt.delete(id);
  for (const q of Object.values(queues)) {
    const index = q.indexOf(id);
    if (index >= 0) q.splice(index, 1);
  }
}
function clearInvites(id: string): void {
  invites.delete(id);
  for (const [target, sender] of invites) if (sender === id) invites.delete(target);
}
function pairQueues(): void {
  for (const mode of ['random', 'ranked'] as const) {
    const q = queues[mode];
    for (let i = 0; i < q.length; i++) {
      const left = q[i];
      if (!sockets.has(left) || matchFor(left)) { removeFromQueues(left); i--; continue; }
      const leftRating = profiles.get(left)?.rating ?? 1000;
      const rival = q.slice(i + 1).find((right) => {
        if (!sockets.has(right) || matchFor(right)) return false;
        if (mode === 'random') return true;
        const waited = Math.max(Date.now() - (queuedAt.get(left) ?? Date.now()), Date.now() - (queuedAt.get(right) ?? Date.now()));
        return canPairRanked(leftRating, profiles.get(right)?.rating ?? 1000, waited);
      });
      if (rival) { startMatch(left, rival, mode); i--; }
    }
  }
}
function swap(f: Faction): Faction { return f === 'player' ? 'enemy' : 'player'; }

function mirroredEvent(ev: SimEvent, length: number): SimEvent {
  switch (ev.t) {
    case 'spawn': return { ...ev, faction: swap(ev.faction) };
    case 'death': return { ...ev, faction: swap(ev.faction), x: length - ev.x, dirX: -ev.dirX };
    case 'shot': return { ...ev, sx: length - ev.sx };
    case 'impact': case 'melee': return { ...ev, x: length - ev.x };
    case 'baseHit': return { ...ev, faction: swap(ev.faction), x: length - ev.x };
    case 'evolve': return { ...ev, faction: swap(ev.faction) };
    case 'special': return { ...ev, faction: swap(ev.faction), points: ev.points.map((x) => length - x) };
    case 'over': return { ...ev, winner: swap(ev.winner) };
    case 'travelEnd': return ev;
  }
}
function mirroredProjectile(p: SimProjectile, length: number): SimProjectile {
  return {
    ...p, sx: length - p.sx, tx: length - p.tx, hostileTo: swap(p.hostileTo),
    target: p.target.kind === 'base' ? { kind: 'base', faction: swap(p.target.faction) } : p.target,
  };
}
function battleState(match: Match, viewer: string): OnlineBattleState {
  const s = match.sim;
  const common = { elapsed: s.elapsed, decidedBy: s.decidedBy };
  if (viewer === match.left) return {
    ...common, player: s.player, enemy: s.enemy, units: s.units,
    projectiles: s.projectiles, events: s.events, over: s.over, stats: s.stats,
  };
  const length = s.laneLength;
  return {
    ...common,
    player: { ...s.enemy, faction: 'player', baseX: length - s.enemy.baseX },
    enemy: { ...s.player, faction: 'enemy', baseX: length - s.player.baseX },
    units: s.units.map((u) => ({ ...u, faction: swap(u.faction), x: length - u.x, shove: -u.shove })),
    projectiles: s.projectiles.map((p) => mirroredProjectile(p, length)),
    events: s.events.map((ev) => mirroredEvent(ev, length)),
    over: s.over ? swap(s.over) : null,
    stats: { player: s.stats.enemy, enemy: s.stats.player },
  };
}
function broadcastState(match: Match): void {
  for (const id of [match.left, match.right]) {
    send(sockets.get(id), { t: 'state', matchId: match.id, state: battleState(match, id) });
  }
  match.sim.clearEvents();
}
function finishMatch(match: Match, winner: string, reason: string): void {
  if (!matches.delete(match.id)) return;
  clearInterval(match.timer);
  const loser = winner === match.left ? match.right : match.left;
  clearDisconnect(winner); clearDisconnect(loser);
  const winProfile = { ...profiles.get(winner)! };
  const loseProfile = { ...profiles.get(loser)! };
  let winDelta = 0;
  let loseDelta = 0;
  if (match.mode === 'ranked') {
    const expected = 1 / (1 + 10 ** ((loseProfile.rating - winProfile.rating) / 400));
    const award = Math.max(1, Math.round(32 * (1 - expected)));
    const oldLoserRating = loseProfile.rating;
    winProfile.rating += award;
    loseProfile.rating = Math.max(100, loseProfile.rating - award);
    winDelta = award;
    loseDelta = loseProfile.rating - oldLoserRating;
    winProfile.wins++;
    loseProfile.losses++;
  }
  const finishedAt = new Date().toISOString();
  const records = [winner, loser].map((id) => {
    const won = id === winner;
    const stats = match.sim.stats[id === match.left ? 'player' : 'enemy'];
    const rival = profiles.get(won ? loser : winner)!;
    return {
      matchId: match.id, finishedAt, opponent: { id: rival.id, name: rival.name }, won, mode: match.mode, reason,
      ratingDelta: won ? winDelta : loseDelta, rating: won ? winProfile.rating : loseProfile.rating,
      seconds: match.sim.elapsed, kills: stats.kills, losses: stats.losses, peakAge: stats.peakAge,
    };
  });
  if (!storage.finishMatch({ ...match, winner, reason, finishedAt }, [winProfile, loseProfile], records)) return;
  profiles.set(winner, winProfile); profiles.set(loser, loseProfile);
  for (const [index, id] of [winner, loser].entries()) {
    const { finishedAt: _finishedAt, opponent: _opponent, ...record } = records[index];
    const result: Extract<ServerMessage, { t: 'result' }> = { t: 'result', ...record };
    if (sockets.get(id)?.readyState === WebSocket.OPEN) send(sockets.get(id), result);
    else pendingResults.set(id, { result, expires: Date.now() + 10 * 60 * 1000 });
    send(sockets.get(id), { t: 'history', entries: storage.history(id) });
  }
  profileUpdate(winner);
  profileUpdate(loser);
  if (match.mode === 'ranked') for (const socket of sockets.values()) send(socket, { t: 'leaderboard', entries: leaderboard() });
}
function startMatch(left: string, right: string, mode: MatchMode): void {
  removeFromQueues(left); removeFromQueues(right);
  invites.delete(left); invites.delete(right);
  const seed = randomInt(1, 2 ** 30);
  const match: Match = { id: randomUUID(), mode, seed, left, right, sim: new BattleSim(ONLINE_LEVEL, seed, 'normal', NO_PERKS), timer: null!, ticks: 0 };
  matches.set(match.id, match);
  send(sockets.get(left), { t: 'match', matchId: match.id, mode, opponent: publicProfile(profiles.get(right)!), seed });
  send(sockets.get(right), { t: 'match', matchId: match.id, mode, opponent: publicProfile(profiles.get(left)!), seed });
  broadcastState(match);
  match.timer = setInterval(() => {
    if (!matches.has(match.id)) return;
    match.sim.advance(SIM.step);
    match.ticks++;
    if (match.ticks % 6 === 0 || match.sim.over) broadcastState(match);
    if (match.sim.over) finishMatch(match, match.sim.over === 'player' ? left : right, match.sim.decidedBy);
  }, 1000 / 60);
}
function applyCommand(match: Match, id: string, cmd: OnlineCommand): void {
  const faction: Faction = id === match.left ? 'player' : 'enemy';
  const sim = match.sim;
  let result: 'ok' | 'poor' | 'locked' | 'cooldown' | 'full' = 'locked';
  if (cmd.t === 'unit' && typeof cmd.id === 'string') result = sim.queueUnit(faction, cmd.id);
  if (cmd.t === 'turret' && Number.isInteger(cmd.slot) && cmd.slot >= 0 && cmd.slot < 4 && typeof cmd.id === 'string') result = sim.buildTurret(faction, cmd.slot, cmd.id);
  if (cmd.t === 'unlockSlot' && Number.isInteger(cmd.slot) && cmd.slot >= 0 && cmd.slot < 4) result = sim.unlockSlot(faction, cmd.slot);
  if (cmd.t === 'scrap' && Number.isInteger(cmd.slot) && cmd.slot >= 0 && cmd.slot < 4) result = sim.scrapTurret(faction, cmd.slot);
  if (cmd.t === 'evolve') result = sim.evolve(faction);
  if (cmd.t === 'special') result = sim.fireSpecial(faction);
  if (result !== 'ok') send(sockets.get(id), { t: 'reject', reason: result });
}
function issueProfile(token?: string): { profile: StoredProfile; token: string } {
  if (token) {
    const hash = createHash('sha256').update(token).digest('hex');
    const existing = [...profiles.values()].find((p) => p.tokenHash === hash);
    if (existing) return { profile: existing, token };
  }
  const freshToken = randomBytes(32).toString('base64url');
  let code: string;
  do code = randomBytes(3).toString('hex').toUpperCase();
  while ([...profiles.values()].some((p) => p.code === code));
  const profile: StoredProfile = { id: randomUUID(), name: `Commander ${code.slice(0, 3)}`, code, rating: 1000, wins: 0, losses: 0, friends: [], tokenHash: createHash('sha256').update(freshToken).digest('hex') };
  profiles.set(profile.id, profile);
  save(profile);
  return { profile, token: freshToken };
}
function rotateToken(profile: StoredProfile): { profile: StoredProfile; token: string } {
  const token = randomBytes(32).toString('base64url');
  return { profile: { ...profile, tokenHash: createHash('sha256').update(token).digest('hex') }, token };
}

const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, players: sockets.size, matches: matches.size })); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  let pathname: string;
  try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  const path = resolve(distRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (path !== distRoot && !path.startsWith(distRoot + sep)) { res.writeHead(403); res.end(); return; }
  const candidate = existsSync(path) && statSync(path).isFile();
  if (!candidate && extname(path)) { res.writeHead(404); res.end(); return; }
  const file = candidate ? path : resolve(distRoot, 'index.html');
  if (!existsSync(file)) { res.writeHead(503); res.end('Build the client first: npm run build'); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': extname(file) === '.html' || file.endsWith('sw.js') ? 'no-cache' : file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
});
const loopback = (address: string) => ['localhost', '127.0.0.1', '::1', '[::1]', '::ffff:127.0.0.1'].includes(address);
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean));
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024, verifyClient: ({ origin, req }: { origin: string; req: IncomingMessage }) => {
  if (!origin) return true; // Non-browser protocol clients authenticate with their own credentials.
  if (allowedOrigins.size) return allowedOrigins.has(origin);
  try {
    const page = new URL(origin);
    const target = new URL(`http://${req.headers.host}`);
    return /^https?:$/.test(page.protocol) && (page.host === target.host || loopback(page.hostname) && loopback(target.hostname));
  } catch { return false; }
} });
const alive = new WeakSet<WebSocket>();
wss.on('connection', (socket, request) => {
  alive.add(socket);
  socket.on('pong', () => alive.add(socket));
  let id: string | null = null;
  let accountBusy = false;
  const authTimeout = setTimeout(() => { if (!id) socket.close(4001, 'Connect first'); }, 10000);
  let commandsThisSecond = 0;
  let messagesThisSecond = 0;
  const rateReset = setInterval(() => { commandsThisSecond = 0; messagesThisSecond = 0; }, 1000);
  function bindProfile(issued: { profile: StoredProfile; token: string }): void {
    if (id && id !== issued.profile.id) {
      const departed = id;
      sockets.delete(departed); removeFromQueues(departed);
      clearInvites(departed); updateFriendPresence(departed);
    }
    id = issued.profile.id;
    clearTimeout(authTimeout); clearDisconnect(id);
    const old = sockets.get(id);
    if (old && old !== socket) old.close(4000, 'Signed in elsewhere');
    sockets.set(id, socket);
    const account = storage.account(id);
    send(socket, { t: 'welcome', token: issued.token, profile: publicProfile(issued.profile), friends: friendsOf(issued.profile), leaderboard: leaderboard(), reconnectGraceMs: reconnectGrace, account: account ? { username: account.username } : null });
    send(socket, { t: 'history', entries: storage.history(id) });
    const ongoing = matchFor(id);
    if (ongoing) {
      sendMatch(ongoing, id);
      send(sockets.get(ongoing.left === id ? ongoing.right : ongoing.left), { t: 'notice', message: 'Your opponent rejoined the battle.' });
    } else {
      send(socket, { t: 'session_idle' });
      const pending = pendingResults.get(id);
      if (pending && pending.expires > Date.now()) send(socket, pending.result);
      pendingResults.delete(id);
    }
    updateFriendPresence(id);
  }
  async function accountAction(msg: Extract<ClientMessage, { t: 'account_register' | 'account_login' | 'account_password' | 'account_logout' }>): Promise<void> {
    if (!id || accountBusy) return;
    const secure = (request.socket as TLSSocket).encrypted || loopback(request.socket.remoteAddress ?? '') ||
      process.env.TRUST_PROXY_TLS === '1' && request.headers['x-forwarded-proto'] === 'https';
    if (!secure) { send(socket, { t: 'account_error', message: 'Accounts require a secure HTTPS connection.' }); return; }
    const sourceId = id;
    if (matchFor(sourceId) || queuedAt.has(sourceId)) {
      send(socket, { t: 'account_error', message: 'Finish your battle or cancel your search before changing accounts.' }); return;
    }
    const profile = profiles.get(sourceId)!;
    const current = storage.account(sourceId);
    const name = msg.t === 'account_register' || msg.t === 'account_login' ? username(msg.username) : current?.username ?? sourceId;
    const forwardedIp = request.headers['x-forwarded-for'];
    const clientIp = process.env.TRUST_PROXY_TLS === '1' && request.headers['x-forwarded-proto'] === 'https' &&
      typeof forwardedIp === 'string' && isIP(forwardedIp) ? forwardedIp : request.socket.remoteAddress ?? 'unknown';
    if (msg.t !== 'account_logout' && !accountLimiter.allow(clientIp, name ?? 'invalid')) {
      send(socket, { t: 'account_error', message: 'Too many account attempts. Try again in 15 minutes.' }); return;
    }
    clearInvites(sourceId);
    accountBusy = true;
    // The socket may be closed or superseded while scrypt runs off the event loop.
    const stillCurrent = () => id === sourceId && sockets.get(sourceId) === socket && socket.readyState === WebSocket.OPEN;
    try {
      if (msg.t === 'account_logout') {
        if (!current) throw new Error('Create an account before signing out, so you can return to this commander.');
        const rotated = rotateToken(profile);
        save(rotated.profile); profiles.set(sourceId, rotated.profile);
        bindProfile(issueProfile());
        send(socket, { t: 'account_status', account: null, message: 'Signed out. You are playing as a new guest.' });
      } else if (msg.t === 'account_register') {
        if (current) throw new Error('This commander already has an account.');
        if (!name) throw new Error('Username needs 3–24 letters, numbers or underscores.');
        if (!validPassword(msg.password)) throw new Error('Use a password between 15 and 128 characters.');
        const hash = await hashPassword(msg.password);
        if (!stillCurrent()) return;
        const issued = rotateToken(profile);
        if (!storage.register(issued.profile, name, hash)) throw new Error('That username is unavailable. Choose another.');
        profiles.set(sourceId, issued.profile); bindProfile(issued);
        send(socket, { t: 'account_status', account: { username: name }, message: 'Account created. Sign in on another device to recover this commander.' });
      } else if (msg.t === 'account_login') {
        if (!name || !validPassword(msg.password)) throw new Error('Username or password is incorrect.');
        const target = storage.findAccount(name);
        const verified = await verifyPassword(msg.password, target?.passwordHash);
        if (!stillCurrent()) return;
        if (!target || !verified || storage.account(target.profileId)?.passwordHash !== target.passwordHash) throw new Error('Username or password is incorrect.');
        const issued = rotateToken(profiles.get(target.profileId)!);
        save(issued.profile); profiles.set(issued.profile.id, issued.profile);
        bindProfile(issued);
        send(socket, { t: 'account_status', account: { username: name }, message: 'Signed in. Your online rating, friends and battle record are restored.' });
      } else {
        if (!current) throw new Error('Create an account first.');
        if (!validPassword(msg.password)) throw new Error('Use a password between 15 and 128 characters.');
        if (!validPassword(msg.currentPassword)) throw new Error('Current password is incorrect.');
        const verified = await verifyPassword(msg.currentPassword, current.passwordHash);
        if (!stillCurrent()) return;
        if (!verified) throw new Error('Current password is incorrect.');
        const hash = await hashPassword(msg.password);
        if (!stillCurrent()) return;
        const issued = rotateToken(profile);
        storage.changePassword(issued.profile, hash); profiles.set(sourceId, issued.profile);
        bindProfile(issued);
        send(socket, { t: 'account_status', account: { username: current.username }, message: 'Password changed. Previous device sessions are no longer valid.' });
      }
    } catch (error) {
      if (stillCurrent()) send(socket, { t: 'account_error', message: error instanceof Error && !('code' in error) ? error.message : 'Account service is unavailable. Try again shortly.' });
    } finally { accountBusy = false; }
  }
  socket.on('message', (raw) => {
    if (id && sockets.get(id) !== socket) return;
    if (++messagesThisSecond > 80) return;
    let msg: ClientMessage;
    try { msg = JSON.parse(raw.toString()) as ClientMessage; } catch { return; }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    if (msg.t === 'hello') {
      if (id) return;
      const token = typeof msg.token === 'string' && msg.token.length <= 128 ? msg.token : undefined;
      bindProfile(issueProfile(token));
      return;
    }
    if (!id) { send(socket, { t: 'error', message: 'Connect first.' }); return; }
    if (msg.t === 'account_register' || msg.t === 'account_login' || msg.t === 'account_password' || msg.t === 'account_logout') {
      void accountAction(msg); return;
    }
    if (accountBusy) return;
    const profile = profiles.get(id)!;
    if (msg.t === 'set_name') {
      const name = String(msg.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 20);
      if (name.length < 2) { send(socket, { t: 'error', message: 'Name must be at least 2 characters.' }); return; }
      profile.name = name; save(profile); profileUpdate(id); updateFriendPresence(id);
    } else if (msg.t === 'friend_add') {
      const target = [...profiles.values()].find((p) => p.code === String(msg.code ?? '').trim().toUpperCase());
      if (!target || target.id === id) { send(socket, { t: 'error', message: 'Friend code not found.' }); return; }
      if (!profile.friends.includes(target.id)) { profile.friends.push(target.id); target.friends.push(id); save(profile, target); }
      profileUpdate(id); profileUpdate(target.id);
      send(socket, { t: 'notice', message: `${target.name} added to friends.` });
    } else if (msg.t === 'challenge') {
      const target = profiles.get(msg.friendId);
      if (!target || !profile.friends.includes(target.id) || !sockets.has(target.id) || matchFor(id) || matchFor(target.id)) {
        send(socket, { t: 'error', message: 'That friend is offline or already in a battle.' }); return;
      }
      invites.set(target.id, id);
      send(sockets.get(target.id), { t: 'invite', from: publicProfile(profile) });
      send(socket, { t: 'notice', message: `Challenge sent to ${target.name}.` });
    } else if (msg.t === 'challenge_answer') {
      if (invites.get(id) !== msg.fromId) return;
      invites.delete(id);
      if (msg.accept && sockets.has(msg.fromId) && !matchFor(id) && !matchFor(msg.fromId)) startMatch(msg.fromId, id, 'friend');
      else send(sockets.get(msg.fromId), { t: 'notice', message: `${profile.name} declined the challenge.` });
    } else if (msg.t === 'queue') {
      if (matchFor(id)) return;
      if (msg.mode !== 'random' && msg.mode !== 'ranked') return;
      removeFromQueues(id);
      const q = queues[msg.mode];
      if (!q) return;
      q.push(id);
      queuedAt.set(id, Date.now());
      send(socket, { t: 'queued', mode: msg.mode });
      pairQueues();
    } else if (msg.t === 'cancel_queue') {
      removeFromQueues(id); send(socket, { t: 'notice', message: 'Match search cancelled.' });
    } else if (msg.t === 'command') {
      if (++commandsThisSecond > 40) return;
      const match = matchFor(id);
      if (match?.id === msg.matchId && msg.command && typeof msg.command === 'object') applyCommand(match, id, msg.command);
    } else if (msg.t === 'leave') {
      const match = matchFor(id);
      if (match?.id === msg.matchId) finishMatch(match, match.left === id ? match.right : match.left, 'forfeit');
    } else if (msg.t === 'leaderboard') {
      send(socket, { t: 'leaderboard', entries: leaderboard() });
    } else if (msg.t === 'history') {
      send(socket, { t: 'history', entries: storage.history(id) });
    }
  });
  socket.on('close', () => {
    clearTimeout(authTimeout);
    clearInterval(rateReset);
    if (!id || sockets.get(id) !== socket) return;
    sockets.delete(id); removeFromQueues(id); clearInvites(id);
    const match = matchFor(id);
    if (match) {
      const departed = id;
      disconnectTimers.set(departed, setTimeout(() => {
        disconnectTimers.delete(departed);
        if (!sockets.has(departed) && matches.has(match.id)) finishMatch(match, match.left === departed ? match.right : match.left, 'disconnect');
      }, reconnectGrace));
      send(sockets.get(match.left === id ? match.right : match.left), { t: 'notice', message: 'Your opponent disconnected. The battle continues while they reconnect.' });
    }
    updateFriendPresence(id);
  });
  socket.on('error', () => { /* A bad peer only loses its own connection. */ });
});
setInterval(() => {
  for (const socket of wss.clients) {
    if (!alive.has(socket)) { socket.terminate(); continue; }
    alive.delete(socket); socket.ping();
  }
  for (const [id, pending] of pendingResults) if (pending.expires <= Date.now()) pendingResults.delete(id);
}, 15000);
setInterval(pairQueues, 1000);
server.listen(port, host, () => console.log(`Multiplayer ready at http://${host}:${port}`));
