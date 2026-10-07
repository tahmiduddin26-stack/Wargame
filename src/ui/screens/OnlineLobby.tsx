import { useEffect, useState } from 'react';
import { onlineClient, useOnline } from '@/multiplayer/client';
import { nextRankForRating, rankForRating } from '@/multiplayer/ranks';
import { useGame } from '@/state/store';
import { OnlineAccount } from './OnlineAccount';
import { OnlineHistory } from './OnlineHistory';

export function OnlineLobby() {
  const go = useGame((s) => s.go);
  const online = useOnline();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => { onlineClient.connect(); }, []);
  useEffect(() => { if (online.match) go('battle'); }, [online.match, go]);
  useEffect(() => { if (online.profile) setName(online.profile.name); }, [online.profile?.id]);

  const connected = online.connection === 'online';
  const myRank = online.profile ? rankForRating(online.profile.rating) : null;
  const nextRank = online.profile ? nextRankForRating(online.profile.rating) : null;
  const resultRank = online.result?.mode === 'ranked' ? rankForRating(online.result.rating) : null;
  const previousRank = online.result?.mode === 'ranked' ? rankForRating(online.result.rating - online.result.ratingDelta) : null;
  return (
    <div className="st online">
      <header className="st__head">
        <button className="btn btn--ghost" onClick={() => { onlineClient.cancelQueue(); onlineClient.disconnect(); go('menu'); }}>Back</button>
        <h2 className="st__title">Multiplayer</h2>
        <span className="label">{online.connection === 'online' ? '● Online' : online.connection === 'connecting' ? 'Connecting…' : '○ Offline'}</span>
      </header>
      <div className="hazard-rule" />
      <div className="online__body scroll-y">
        {online.message && <p className="online__notice" role="status">{online.message}</p>}
        {!connected && <section className="online__panel panel">
          <h3>Server connection</h3>
          <p>The multiplayer server is needed for friends, matchmaking and ranked results.</p>
          <button className="btn btn--primary" onClick={() => onlineClient.connect()}>Reconnect</button>
        </section>}

        {online.result && <section className="online__result panel">
          <h3>{online.result.won ? 'Victory' : 'Defeat'}</h3>
          <p>{online.result.reason === 'forfeit' ? 'Match ended by forfeit.' : online.result.reason === 'disconnect' ? 'A commander disconnected.' : `Decided by ${online.result.reason}.`}</p>
          {resultRank ? <>
            <p className="online__rating"><strong>{resultRank}</strong> · <span className="num">{online.result.rating} rating ({online.result.ratingDelta >= 0 ? '+' : ''}{online.result.ratingDelta})</span></p>
            {resultRank !== previousRank && <p>{online.result.ratingDelta > 0 ? `Promoted to ${resultRank}!` : `Moved to ${resultRank}.`}</p>}
          </> : <p>Rank and rating unchanged.</p>}
          <p>{Math.floor(online.result.seconds / 60)}:{String(Math.floor(online.result.seconds % 60)).padStart(2, '0')} · {online.result.kills} kills / {online.result.losses} losses · Final age {online.result.peakAge + 1}</p>
          <button className="btn" onClick={() => onlineClient.clearMatch()}>Close result</button>
        </section>}

        <div className="online__columns">
          <div className="online__stack">
            <section className="online__panel panel">
              <h3>Find a battle</h3>
              <p>Casual pairs available players without changing rank. Ranked starts near your rating, then searches other ranks if needed. Both use equal armies at normal speed.</p>
              <p>A brief disconnect can rejoin the same battle. The match keeps running; explicit Leave forfeits immediately.</p>
              <div className="online__actions">
                <button className="btn btn--primary" disabled={!connected || online.accountBusy || !!online.queue} onClick={() => onlineClient.queue('random')}>Casual battle</button>
                <button className="btn" disabled={!connected || online.accountBusy || !!online.queue} onClick={() => onlineClient.queue('ranked')}>Ranked battle</button>
                {online.queue && <button className="btn btn--ghost" onClick={() => onlineClient.cancelQueue()}>Cancel search</button>}
              </div>
            </section>

            <section className="online__panel panel">
              <h3>Your commander</h3>
              {online.profile && <>
                <div className="online__name">
                  <input aria-label="Commander name" maxLength={20} value={name} onChange={(event) => setName(event.target.value)} />
                  <button className="btn" disabled={!connected || online.accountBusy} onClick={() => onlineClient.setName(name)}>Save</button>
                </div>
                <p>Friend code <strong className="num">{online.profile.code}</strong></p>
                <p className="online__rank-line"><strong className={`online__rank online__rank--${myRank?.toLowerCase()}`}>{myRank}</strong> <span className="num">{online.profile.rating} rating</span></p>
                <p className="online__rank-note">{nextRank ? `${nextRank.min - online.profile.rating} rating to ${nextRank.name}` : 'Highest rank reached'} · Ranked {online.profile.wins} W / {online.profile.losses} L</p>
              </>}
            </section>

            <OnlineAccount />
            <section className="online__panel panel">
              <h3>Friends</h3>
              <div className="online__name">
                <input aria-label="Friend code" placeholder="Enter friend code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
                <button className="btn" disabled={!connected || online.accountBusy} onClick={() => { onlineClient.addFriend(code); setCode(''); }}>Add</button>
              </div>
              {online.friends.length === 0 && <p>Share your code, then add a friend to challenge them.</p>}
              <ul className="online__friends">
                {online.friends.map((friend) => <li key={friend.id}>
                  <span><b>{friend.name}</b><small>{friend.online ? 'Online' : 'Offline'} · {rankForRating(friend.rating)} · {friend.rating} rating</small></span>
                  <button className="btn" disabled={!friend.online || !connected || online.accountBusy} onClick={() => onlineClient.challenge(friend.id)}>Challenge</button>
                </li>)}
              </ul>
            </section>
            <OnlineHistory />
          </div>

          <section className="online__panel panel online__leaders">
            <h3>Ranked leaderboard</h3>
            <p>Ranked wins raise your rating; losses lower it. The server decides every result.</p>
            <button className="btn btn--ghost" disabled={!connected} onClick={() => onlineClient.requestLeaderboard()}>Refresh</button>
            <ol>
              {online.leaderboard.length === 0 && <li>Complete a ranked battle to start the leaderboard.</li>}
              {online.leaderboard.map((entry) => <li key={entry.id} className={entry.id === online.profile?.id ? 'online__self' : ''}>
                <span>{entry.name}<small>{rankForRating(entry.rating)}</small></span><strong className="num">{entry.rating}</strong><small>{entry.wins}–{entry.losses}</small>
              </li>)}
            </ol>
          </section>
        </div>
      </div>

      {online.invite && <div className="online__invite">
        <div className="panel online__invite-card">
          <h3>Friend challenge</h3>
          <p>{online.invite.name} wants a battle.</p>
          <div className="online__actions">
            <button className="btn btn--primary" onClick={() => onlineClient.answerInvite(online.invite!.id, true)}>Accept</button>
            <button className="btn" onClick={() => onlineClient.answerInvite(online.invite!.id, false)}>Decline</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
