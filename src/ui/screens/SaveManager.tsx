import { useRef, useState } from 'react';
import { commanderRank } from '@/data/career';
import { LEVELS } from '@/data/levels';
import { MAX_BACKUP_BYTES, createBackup, parseBackup } from '@/state/backup';
import { useGame } from '@/state/store';

export function SaveManager() {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const exportSave = () => {
    const url = URL.createObjectURL(new Blob([createBackup(useGame.getState())], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `war-game-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    setError(false);
    setMessage('Backup download requested. Keep the file somewhere you can find again.');
  };
  const readFile = async (file: File) => {
    setReading(true); setPreview(null); setMessage(''); setError(false);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('This file is too large to be a game backup.');
      setPreview(parseBackup(await file.text()));
    } catch (e) {
      setError(true); setMessage(e instanceof Error ? e.message : 'Could not read this backup.');
    } finally { setReading(false); }
  };
  return (
    <section className="st__group save">
      <h3 className="st__label">Save backup</h3>
      <p className="st__note">Keep a copy of your campaign, XP, credits, skills, paints, battle record and settings. Restore it here on another device. Your online commander and rating are separate.</p>
      <div className="save__actions">
        <button className="btn btn--primary" onClick={exportSave}>Export backup</button>
        <button className="btn btn--ghost" disabled={reading} onClick={() => input.current?.click()}>{reading ? 'Reading…' : 'Choose backup'}</button>
      </div>
      <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Save backup file" onChange={(e) => {
        const file = e.currentTarget.files?.[0]; e.currentTarget.value = '';
        if (file) void readFile(file);
      }} />
      {message && <p className={`save__message${error ? ' save__message--error' : ''}`} role={error ? 'alert' : 'status'}>{message}</p>}
      {preview && <div className="save__preview">
        <h4>Backup ready to restore</h4>
        <p>Saved {new Date(preview.exportedAt).toLocaleString('en-GB')}</p>
        <dl>
          <div><dt>Operations cleared</dt><dd>{LEVELS.filter((l) => preview.progress.records[l.id]?.cleared).length} / {LEVELS.length}</dd></div>
          <div><dt>Commander rank</dt><dd>{commanderRank(preview.progress.careerXp)}</dd></div>
          <div><dt>Credits</dt><dd>{preview.progress.credits.toLocaleString('en-GB')}</dd></div>
          <div><dt>Army paints</dt><dd>{preview.progress.ownedSkins.length}</dd></div>
        </dl>
        <p>This replaces the offline save on this device. Export your current save first if you want to keep both.</p>
        <div className="save__actions">
          <button className="btn btn--danger" onClick={() => useGame.getState().restoreProgress(preview.progress)}>Restore this backup</button>
          <button className="btn btn--ghost" onClick={() => setPreview(null)}>Cancel restore</button>
        </div>
      </div>}
    </section>
  );
}
