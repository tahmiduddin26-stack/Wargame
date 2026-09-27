import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { canPairRanked, rankForRating } from '../src/multiplayer/ranks.ts';

assert.equal(rankForRating(1000), 'Bronze');
assert.equal(rankForRating(1100), 'Silver');
assert.equal(rankForRating(1300), 'Gold');
assert.equal(rankForRating(1500), 'Platinum');
assert.equal(rankForRating(1700), 'Diamond');
assert(canPairRanked(1000, 1100, 0));
assert(!canPairRanked(1000, 1300, 0));
assert(canPairRanked(1000, 1300, 30000));
assert(canPairRanked(1000, 1700, 90000));

const url = process.env.MULTIPLAYER_URL ?? 'ws://127.0.0.1:8787/ws';

class TestClient {
  constructor() {
    this.ws = new WebSocket(url);
    this.messages = [];
    this.waiters = [];
    this.ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      const index = this.waiters.findIndex((entry) => entry.match(message));
      if (index >= 0) this.waiters.splice(index, 1)[0].resolve(message);
      else this.messages.push(message);
    });
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
  }
  send(message) { this.ws.send(JSON.stringify(message)); }
  take(match) {
    const index = this.messages.findIndex(match);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const entry = { match, resolve: (value) => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== entry);
        reject(new Error('Timed out waiting for server message'));
      }, 5000);
      this.waiters.push(entry);
    });
  }
  close() { this.ws.close(); }
}

const clients = [];
async function connect(token) {
  const client = new TestClient();
  clients.push(client);
  await client.open();
  client.send({ t: 'hello', token });
  const welcome = await client.take((m) => m.t === 'welcome');
  return { client, welcome };
}

try {
  const a = await connect();
  const b = await connect();
  a.client.ws.send('null');
  a.client.send({ t: 'queue', mode: '__proto__' });
  assert.notEqual(a.welcome.profile.code, b.welcome.profile.code);
  a.client.send({ t: 'set_name', name: 'Sketch One' });
  await a.client.take((m) => m.t === 'profile' && m.profile.name === 'Sketch One');
  a.client.send({ t: 'friend_add', code: b.welcome.profile.code });
  const friends = await a.client.take((m) => m.t === 'profile' && m.friends.length === 1);
  assert.equal(friends.friends[0].id, b.welcome.profile.id);
  a.client.send({ t: 'challenge', friendId: b.welcome.profile.id });
  const invite = await b.client.take((m) => m.t === 'invite');
  assert.equal(invite.from.id, a.welcome.profile.id);
  b.client.send({ t: 'challenge_answer', fromId: a.welcome.profile.id, accept: true });
  const friendA = await a.client.take((m) => m.t === 'match' && m.mode === 'friend');
  const friendB = await b.client.take((m) => m.t === 'match' && m.mode === 'friend');
  assert.equal(friendA.matchId, friendB.matchId);
  const stateA = await a.client.take((m) => m.t === 'state' && m.matchId === friendA.matchId);
  const stateB = await b.client.take((m) => m.t === 'state' && m.matchId === friendA.matchId);
  assert.equal(stateA.state.player.baseX, stateB.state.player.baseX);
  assert.equal(stateA.state.player.baseHp, stateB.state.enemy.baseHp);
  a.client.send({ t: 'command', matchId: friendA.matchId, command: { t: 'unit', id: 'made-up-unit' } });
  assert.equal((await a.client.take((m) => m.t === 'reject')).reason, 'locked');
  a.client.send({ t: 'command', matchId: friendA.matchId, command: { t: 'unit', id: 'clubman' } });
  const deployed = await a.client.take((m) => m.t === 'state' && m.state.units.some((u) => u.def.id === 'clubman'));
  assert(deployed.state.units.some((u) => u.faction === 'player'));
  b.client.send({ t: 'leave', matchId: friendA.matchId });
  const friendResult = await a.client.take((m) => m.t === 'result' && m.matchId === friendA.matchId);
  assert.equal(friendResult.won, true);
  assert.equal(friendResult.ratingDelta, 0);
  assert.equal(friendResult.rating, 1000);
  assert.equal((await b.client.take((m) => m.t === 'result' && m.matchId === friendA.matchId)).won, false);

  a.client.send({ t: 'queue', mode: 'random' });
  await a.client.take((m) => m.t === 'queued' && m.mode === 'random');
  b.client.send({ t: 'queue', mode: 'random' });
  const randomA = await a.client.take((m) => m.t === 'match' && m.mode === 'random');
  const randomB = await b.client.take((m) => m.t === 'match' && m.mode === 'random');
  assert.equal(randomA.matchId, randomB.matchId);
  a.client.send({ t: 'leave', matchId: randomA.matchId });
  const casualResult = await a.client.take((m) => m.t === 'result' && m.matchId === randomA.matchId);
  assert.equal(casualResult.ratingDelta, 0);
  assert.equal(casualResult.rating, 1000);
  await b.client.take((m) => m.t === 'result' && m.matchId === randomA.matchId);

  a.client.send({ t: 'queue', mode: 'ranked' });
  await a.client.take((m) => m.t === 'queued' && m.mode === 'ranked');
  b.client.send({ t: 'queue', mode: 'ranked' });
  const rankedA = await a.client.take((m) => m.t === 'match' && m.mode === 'ranked');
  const rankedB = await b.client.take((m) => m.t === 'match' && m.mode === 'ranked');
  assert.equal(rankedA.matchId, rankedB.matchId);
  b.client.send({ t: 'leave', matchId: rankedA.matchId });
  const resultA = await a.client.take((m) => m.t === 'result' && m.matchId === rankedA.matchId);
  const resultB = await b.client.take((m) => m.t === 'result' && m.matchId === rankedA.matchId);
  assert.equal(resultA.ratingDelta, 16);
  assert.equal(resultB.ratingDelta, -16);
  a.client.send({ t: 'leaderboard' });
  const board = await a.client.take((m) => m.t === 'leaderboard' && m.entries.some((p) => p.id === a.welcome.profile.id && p.rating === 1016));
  assert(board.entries.find((p) => p.id === b.welcome.profile.id).rating === 984);

  const reconnect = await connect(a.welcome.token);
  assert.equal(reconnect.welcome.profile.id, a.welcome.profile.id);
  assert.equal(reconnect.welcome.profile.rating, 1016);
  console.log('Multiplayer protocol passed: friends, invite, mirrored state, validation, random, ranked, rating, leaderboard, token reconnect.');
} finally {
  for (const client of clients) client.close();
}
