import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TakeoffButton, TakeoffInput } from '@takeoff-tokyo/ui';
import { api } from './client';

export function EmailSignIn({ client, purpose = 'tickets', transferToken }: { client: SupabaseClient; purpose?: 'tickets' | 'orders' | 'transfer' | 'admin'; transferToken?: string }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));

  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  async function sendCode(recipient: string) {
    if (busy || remaining > 0) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const address = recipient.trim().toLowerCase();
      await api('/auth/request-code', 'POST', { email: address, purpose, ...(purpose === 'transfer' ? { transferToken } : {}) });
      setSentTo(address); setCode(''); setNow(Date.now()); setRetryAt(Date.now() + 60000);
      setNotice('Code sent.');
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error: failure } = await client.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' });
      if (failure) throw failure;
      if (!data.session) throw new Error('Sign-in could not be completed. Please request a new code.');
      // Supabase's auth-state listener updates the parent after verification.
      setCode('');
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="ticket-form sign-in-form" aria-busy={busy}>
    {!sentTo ? <form className="ticket-form" onSubmit={event => { event.preventDefault(); void sendCode(email); }}>
      <label>Email<TakeoffInput type="email" autoFocus value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" maxLength={254} /></label>
      <TakeoffButton type="submit" variant="cyan" disabled={busy || remaining > 0}>{remaining > 0 ? `Send code in ${remaining}s` : 'Email me a code'}</TakeoffButton>
    </form> : <>
      <form className="ticket-form" onSubmit={verifyCode}>
        <p>{sentTo}</p>
        <label>One-time code<TakeoffInput className="otp-input" value={code} onChange={event => setCode(event.target.value)} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus /></label>
        <TakeoffButton type="submit" variant="cyan" disabled={busy}>{busy ? 'Please wait…' : 'Verify and sign in'}</TakeoffButton>
      </form>
      <div className="ticket-actions">
        <TakeoffButton type="button" variant="secondary" disabled={busy || remaining > 0} onClick={() => void sendCode(sentTo)}>{remaining > 0 ? `Resend in ${remaining}s` : 'Resend code'}</TakeoffButton>
        <TakeoffButton type="button" variant="ghost" disabled={busy} onClick={() => { setSentTo(''); setCode(''); setError(''); setNotice(''); }}>Use a different email</TakeoffButton>
      </div>
    </>}
    {notice && <p role="status" className="ticket-notice">{notice}</p>}
    {error && <p role="alert" className="ticket-error">{error}</p>}
  </section>;
}
