import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { OnlinePeer } from './helpers/online-peer.mjs';

const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port; await new Promise((done) => probe.close(done));
const root = resolve('.shots', `accounts-${randomUUID()}`); mkdirSync(root, { recursive: true });
const databaseFile = resolve(root, 'online.sqlite');
const url = `ws://127.0.0.1:${port}/ws`;
const clients = [];
let server;
async function start() {
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MULTIPLAYER_DATA_FILE: resolve(root, 'legacy.json'), MULTIPLAYER_DB_FILE: databaseFile }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('Test server did not start')), 15000);
    server.stdout.on('data', (data) => { if (data.toString().includes('Multiplayer ready')) { clearTimeout(timer); done(); } });
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Test server exited ${code}`)); });
    server.once('error', reject);
  });
}
async function stop() { if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; } }
async function connect(token) {
  const peer = new OnlinePeer(url); clients.push(peer);
  const welcome = await peer.open(token); return { peer, welcome };
}
const login = async (peer, username, password) => {
  peer.send({ t: 'account_login', username, password });
  const welcome = await peer.take((m) => m.t === 'welcome');
  await peer.take((m) => m.t === 'account_status'); return welcome;
};
const password = 'A long sketch commander passphrase';
const changedPassword = 'A different sketch commander passphrase';
try {
  await start();
  const a = await connect(); const b = await connect();
  a.peer.send({ t: 'set_name', name: 'Recovered Commander' });
  await a.peer.take((m) => m.t === 'profile' && m.profile.name === 'Recovered Commander');
  a.peer.send({ t: 'friend_add', code: b.welcome.profile.code });
  await a.peer.take((m) => m.t === 'profile' && m.friends.length === 1);
  a.peer.send({ t: 'queue', mode: 'ranked' }); b.peer.send({ t: 'queue', mode: 'ranked' });
  const battle = await a.peer.take((m) => m.t === 'match'); await b.peer.take((m) => m.t === 'match');
  b.peer.send({ t: 'leave', matchId: battle.matchId });
  const result = await a.peer.take((m) => m.t === 'result');
  await b.peer.take((m) => m.t === 'result');
  assert.equal(result.rating, 1016);
  a.peer.send({ t: 'account_register', username: 'AccountOne', password: 'short' });
  assert((await a.peer.take((m) => m.t === 'account_error')).message.includes('15'));
  a.peer.send({ t: 'account_register', username: ' AccountOne ', password });
  const registered = await a.peer.take((m) => m.t === 'welcome');
  await a.peer.take((m) => m.t === 'account_status');
  assert.equal(registered.profile.id, a.welcome.profile.id);
  assert.equal(registered.profile.rating, 1016);
  assert.equal(registered.profile.code, a.welcome.profile.code);
  assert.equal(registered.friends[0].id, b.welcome.profile.id);
  assert.equal(registered.account.username, 'accountone');
  assert.notEqual(registered.token, a.welcome.token, 'creating an account must rotate the guest session');
  b.peer.send({ t: 'account_register', username: 'accountone', password });
  await b.peer.take((m) => m.t === 'account_error');
  const c = await connect();
  c.peer.send({ t: 'account_login', username: 'accountone', password: 'A completely wrong long passphrase' });
  assert.equal((await c.peer.take((m) => m.t === 'account_error')).message, 'Username or password is incorrect.');
  const replaced = once(a.peer.ws, 'close');
  const recovered = await login(c.peer, 'ACCOUNTONE', password);
  assert.equal((await replaced)[0], 4000);
  assert.equal(recovered.profile.id, registered.profile.id);
  assert.equal(recovered.profile.rating, 1016);
  assert.notEqual(recovered.token, registered.token);
  const history = await c.peer.take((m) => m.t === 'history' && m.entries.length === 1);
  assert.equal(history.entries[0].matchId, battle.matchId);
  assert.equal(history.entries[0].opponent.id, b.welcome.profile.id);
  assert.equal(history.entries[0].won, true);
  b.peer.send({ t: 'leaderboard' });
  const board = await b.peer.take((m) => m.t === 'leaderboard' && m.entries.some((p) => p.id === registered.profile.id));
  assert(!JSON.stringify(board).includes('accountone'), 'private account names must not appear on the leaderboard');
  c.peer.send({ t: 'queue', mode: 'random' }); await c.peer.take((m) => m.t === 'queued');
  c.peer.send({ t: 'account_logout' });
  assert((await c.peer.take((m) => m.t === 'account_error')).message.includes('cancel'));
  b.peer.send({ t: 'queue', mode: 'random' });
  const ongoing = await c.peer.take((m) => m.t === 'match'); await b.peer.take((m) => m.t === 'match');
  c.peer.send({ t: 'account_logout' });
  assert((await c.peer.take((m) => m.t === 'account_error')).message.includes('Finish'));
  const d = await connect();
  const oldClose = once(c.peer.ws, 'close');
  const takeover = await login(d.peer, 'accountone', password);
  assert.equal((await oldClose)[0], 4000);
  assert.equal((await d.peer.take((m) => m.t === 'match')).matchId, ongoing.matchId, 'password login must rejoin the same active battle');
  b.peer.send({ t: 'leave', matchId: ongoing.matchId });
  await d.peer.take((m) => m.t === 'result' && m.matchId === ongoing.matchId);
  await b.peer.take((m) => m.t === 'result' && m.matchId === ongoing.matchId);
  d.peer.send({ t: 'leave', matchId: ongoing.matchId });
  d.peer.send({ t: 'account_password', currentPassword: 'Another incorrect long passphrase', password: changedPassword });
  assert.equal((await d.peer.take((m) => m.t === 'account_error')).message, 'Current password is incorrect.');
  d.peer.send({ t: 'account_password', currentPassword: password, password: changedPassword });
  const updated = await d.peer.take((m) => m.t === 'welcome'); await d.peer.take((m) => m.t === 'account_status');
  assert.notEqual(updated.token, takeover.token);
  const e = await connect();
  e.peer.send({ t: 'account_login', username: 'accountone', password });
  await e.peer.take((m) => m.t === 'account_error');
  const signedIn = await login(e.peer, 'accountone', changedPassword);
  e.peer.send({ t: 'account_logout' });
  const guest = await e.peer.take((m) => m.t === 'welcome'); await e.peer.take((m) => m.t === 'account_status');
  assert.equal(guest.account, null); assert.notEqual(guest.profile.id, signedIn.profile.id);
  const expired = await connect(signedIn.token);
  assert.notEqual(expired.welcome.profile.id, signedIn.profile.id, 'logout must invalidate the remembered account session');
  await stop();
  const db = new DatabaseSync(databaseFile, { readOnly: true });
  assert.equal(db.prepare('SELECT count(*) AS n FROM matches').get().n, 2);
  assert.equal(db.prepare('SELECT count(*) AS n FROM results').get().n, 4);
  assert(!JSON.stringify(db.prepare('SELECT * FROM accounts').all()).includes(password));
  db.close();
  await start();
  const afterRestart = await connect();
  const restored = await login(afterRestart.peer, 'accountone', changedPassword);
  assert.equal(restored.profile.id, registered.profile.id);
  assert.equal(restored.profile.rating, 1016);
  assert.equal(restored.profile.wins, 1);
  assert.equal(restored.friends[0].id, b.welcome.profile.id);
  const retained = await afterRestart.peer.take((m) => m.t === 'history' && m.entries.length === 2);
  assert.deepEqual(new Set(retained.entries.map((r) => r.matchId)), new Set([battle.matchId, ongoing.matchId]));
  const forbidden = new OnlinePeer(url, { origin: 'https://unrelated.example' }); clients.push(forbidden);
  await assert.rejects(() => forbidden.open(), /401/, 'unrelated browser origins must be rejected');
  // The successful restart login consumed one attempt; 11 more fill the IP budget.
  for (let attempt = 0; attempt < 11; attempt++) {
    afterRestart.peer.send({ t: 'account_login', username: 'nonexistent', password: 'short' });
    assert.equal((await afterRestart.peer.take((m) => m.t === 'account_error')).message, 'Username or password is incorrect.');
  }
  const limited = await connect();
  limited.peer.send({ t: 'account_login', username: 'accountone', password: changedPassword });
  assert((await limited.peer.take((m) => m.t === 'account_error')).message.includes('Too many'), 'new sockets must not bypass account attempt limits');
  console.log('Commander accounts passed: guest upgrade, private credentials, sign-in/takeover, active-match recovery, password change, logout revocation, durable rating and both match records after server restart.');
} finally {
  for (const peer of clients) peer.close();
  await stop();
}
