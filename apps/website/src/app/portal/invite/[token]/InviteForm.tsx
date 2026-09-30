'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export function InviteForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'error' | 'done'>('idle');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) { setState('error'); setMessage('Passwords do not match.'); return; }
    setState('saving');
    const response = await fetch('/api/portal/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setState('error'); setMessage(data.error || 'Unable to activate this invitation.'); return; }
    setState('done');
    window.setTimeout(() => { window.location.href = `/portal/login?email=${encodeURIComponent(data.email || '')}`; }, 900);
  }
  return <main className="site-shell invite-page"><div className="invite-card"><Link href="/" className="brand">Lodge<span>Core</span></Link><div className="section-kicker">Customer portal</div><h1>Set your password.</h1><p>Your LodgeCore workspace is ready. Choose a password to finish activating your account.</p>{state === 'done' ? <div className="invite-success">Account activated. Redirecting you to sign in…</div> : <form onSubmit={submit} className="invite-form"><label>New password<input required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label><label>Confirm password<input required minLength={12} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" /></label>{state === 'error' && <p className="invite-error">{message}</p>}<button disabled={state === 'saving'} className="button button-primary">{state === 'saving' ? 'Activating…' : 'Activate account ↗'}</button></form>}<Link href="/portal/login" className="invite-back">Already activated? Sign in →</Link></div></main>;
}
