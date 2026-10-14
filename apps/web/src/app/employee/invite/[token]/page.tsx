'use client';

import { FormEvent, use, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, UserRoundCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EmployeeInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/employee/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const value = await response.json();
      if (!response.ok) setError(value.error || 'Unable to activate account');
      else setComplete(true);
    } catch {
      setError('Unable to activate account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-10 text-slate-200">
      <section className="w-full max-w-md rounded-3xl border border-white/[.08] bg-white/[.035] p-7 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-300 text-slate-950"><UserRoundCheck className="h-5 w-5" /></div>
        {complete ? (
          <div className="mt-7">
            <CheckCircle2 className="h-8 w-8 text-teal-300" />
            <h1 className="mt-4 text-2xl font-semibold text-white">Account activated</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Your employee account is ready. Sign in with your email and new password.</p>
            <button onClick={() => router.push('/login')} className="mt-6 w-full rounded-xl bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950">Continue to sign in</button>
          </div>
        ) : (
          <>
            <div className="mt-7"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-teal-300"><KeyRound className="h-4 w-4" /> Secure activation</p><h1 className="mt-3 text-2xl font-semibold text-white">Create your employee password</h1><p className="mt-2 text-sm leading-6 text-slate-400">Choose a strong password to activate your LodgeCore employee account.</p></div>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block text-sm text-slate-300">Password<input required minLength={12} type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="field mt-2 w-full" autoComplete="new-password" /></label>
              <label className="block text-sm text-slate-300">Confirm password<div className="relative"><input required minLength={12} type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} className="field mt-2 w-full pr-11" autoComplete="new-password" /><button type="button" aria-label={show ? 'Hide passwords' : 'Show passwords'} onClick={() => setShow(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
              {error && <p className="rounded-lg border border-red-400/20 bg-red-400/[.07] p-3 text-sm text-red-200">{error}</p>}
              <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Activate account</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
