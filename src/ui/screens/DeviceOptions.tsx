import { applyGameUpdate, installGame, useAvailability } from '@/state/appAvailability';

export function DeviceOptions() {
  const app = useAvailability();
  return (
    <section className="st__group device">
      <h3 className="st__label">Play on this device</h3>
      <p className="st__note" role="status">{app.offline === 'ready' ? 'Campaign and survival are saved for offline play.' : app.offline === 'loading' ? 'Saving the game for offline play…' : 'Offline installation is unavailable here. Use the production game over HTTPS, or localhost for testing.'} Multiplayer needs a connection.</p>
      {app.installAvailable ? <button className="btn btn--primary" onClick={() => void installGame()}>Install game</button> : <p className="st__note">{app.installed ? 'Game is running as an installed app.' : 'To add the game to your home screen, use your browser’s Install or Add to Home Screen option.'}</p>}
      {app.updateReady && <div className="device__update"><p>A new game version is ready. Your progress is kept.</p><button className="btn btn--primary" onClick={applyGameUpdate}>Update and reload</button></div>}
    </section>
  );
}
