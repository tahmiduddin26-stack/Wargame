import { useEffect, useState } from 'react';
import { onlineClient, useOnline } from '@/multiplayer/client';

export function OnlineAccount() {
  const online = useOnline();
  const [mode, setMode] = useState<'register' | 'login' | 'password' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const disabled = online.connection !== 'online' || online.accountBusy || !!online.queue;
  useEffect(() => {
    if (online.accountMessage && !online.accountError) {
      setPassword(''); setCurrentPassword(''); setConfirmation(''); setMode(null); setError('');
    }
  }, [online.accountMessage, online.accountError]);
  function choose(next: typeof mode) {
    setMode(next); setPassword(''); setCurrentPassword(''); setConfirmation(''); setError('');
  }
  return <section className="online__panel online-account panel">
    <h3>Commander account</h3>
    {online.account ? <>
      <p>Signed in as <strong>{online.account.username}</strong>. Use this account on another device to keep your online rating, friends and battle record.</p>
      <div className="online__actions">
        <button className="btn" disabled={disabled} onClick={() => choose('password')}>Change password</button>
        <button className="btn btn--ghost" disabled={disabled} onClick={() => { choose(null); onlineClient.accountAction({ t: 'account_logout' }); }}>Sign out</button>
      </div>
    </> : <>
      <p>You are a guest. Create an account to keep this commander if your browser data is cleared, or sign in to an existing commander.</p>
      <div className="online__actions">
        <button className="btn" disabled={disabled} onClick={() => choose('register')}>Create account</button>
        <button className="btn btn--ghost" disabled={disabled} onClick={() => choose('login')}>Sign in</button>
      </div>
    </>}
    {mode && <form className="online-account__form" onSubmit={(event) => {
      event.preventDefault(); setError('');
      if (mode !== 'login' && password !== confirmation) { setError('Passwords do not match.'); return; }
      if (mode === 'password') onlineClient.accountAction({ t: 'account_password', currentPassword, password });
      else onlineClient.accountAction({ t: mode === 'register' ? 'account_register' : 'account_login', username, password });
    }}>
      <h4>{mode === 'register' ? 'Save this commander' : mode === 'login' ? 'Recover your commander' : 'Choose a new password'}</h4>
      {mode !== 'password' && <label>Username<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={username} onChange={(event) => setUsername(event.target.value)} /></label>}
      {mode === 'password' && <label>Current password<input name="current-password" type="password" autoComplete="current-password" required minLength={15} maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>}
      <label>{mode === 'password' ? 'New password' : 'Password'}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={15} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {mode !== 'login' && <label>Confirm password<input name="confirm-password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>}
      <p>{mode === 'login' ? 'Signing in replaces the online commander on this device. Offline campaign progress stays on this device.' : 'Use 15–128 characters. Keep these details in your password manager. Email password reset is not available yet.'}</p>
      <div className="online__actions">
        <button className="btn btn--primary" type="submit" disabled={disabled}>{online.accountBusy ? 'Working…' : mode === 'register' ? 'Save account' : mode === 'login' ? 'Recover account' : 'Update password'}</button>
        <button className="btn btn--ghost" type="button" disabled={online.accountBusy} onClick={() => choose(null)}>Cancel</button>
      </div>
    </form>}
    {(error || online.accountMessage) && <p className={error || online.accountError ? 'online-account__error' : 'online-account__status'} role={error || online.accountError ? 'alert' : 'status'}>{error || online.accountMessage}</p>}
    <button className="btn btn--ghost" aria-expanded={showPrivacy} onClick={() => setShowPrivacy(!showPrivacy)}>Online data & privacy</button>
    {showPrivacy && <div className="online-account__privacy">
      <p>The server stores your commander name, friend code, friends, rating and finished online battles. An account adds a private username and a salted password hash. Your password is never stored as readable text.</p>
      <p>Commander names, friend codes and ranked scores are visible to other players. Your account username and battle history are private to your account. This browser remembers your online session; sign out on shared devices.</p>
      <p>Campaign saves stay in this browser and are separate from your online account. No payments, email addresses or advertising trackers are used in this build.</p>
    </div>}
  </section>;
}
