import { onlineClient, useOnline } from '@/multiplayer/client';

export function OnlineHistory() {
  const online = useOnline();
  return <section className="online__panel online-history panel">
    <h3>Recent online battles</h3>
    <p>Your last 20 finished battles, saved by the server.</p>
    <button className="btn btn--ghost" disabled={online.connection !== 'online' || online.accountBusy} onClick={() => onlineClient.requestHistory()}>Refresh battles</button>
    {online.history.length === 0 ? <p>Finish a casual, friend or ranked battle to start your record.</p> :
      <ol className="online-history__list">{online.history.map((battle) => <li key={battle.matchId}>
        <div><strong>{battle.won ? 'Victory' : 'Defeat'}</strong><span>{battle.mode === 'random' ? 'Casual' : battle.mode === 'ranked' ? 'Ranked' : 'Friend'} · vs {battle.opponent.name}</span></div>
        <p>{new Date(battle.finishedAt).toLocaleDateString()} · {Math.floor(battle.seconds / 60)}:{String(Math.floor(battle.seconds % 60)).padStart(2, '0')} · {battle.reason === 'forfeit' ? 'Forfeit' : battle.reason === 'disconnect' ? 'Disconnect' : `Decided by ${battle.reason}`}</p>
        <p>{battle.kills} kills / {battle.losses} losses · {battle.mode === 'ranked' ? `${battle.rating} rating (${battle.ratingDelta >= 0 ? '+' : ''}${battle.ratingDelta})` : 'Rating unchanged'}</p>
      </li>)}</ol>}
  </section>;
}
