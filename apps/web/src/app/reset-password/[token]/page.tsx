'use client';

import Link from 'next/link';
import { FormEvent, use, useState } from 'react';
import { Hotel } from 'lucide-react';

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirmPassword')) { setError('The passwords do not match.'); setLoading(false); return; }
    const response = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: form.get('password') }) });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(data.error || 'Unable to update your password.'); return; }
    setDone(true);
  }

  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"><div className="mb-8 text-center"><div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600"><Hotel className="h-7 w-7 text-white" /></div><h1 className="text-2xl font-bold text-white">{done ? 'Password updated' : 'Choose a new password'}</h1><p className="mt-2 text-sm text-slate-400">LodgeCore PMS</p></div>{done ? <><p className="text-sm leading-6 text-slate-300">Your password has been updated successfully.</p><Link href="/login" className="mt-6 flex w-full justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">Continue to sign in</Link></> : <form onSubmit={submit} className="space-y-5"><p className="text-sm text-slate-400">Use at least 12 characters.</p><div className="space-y-1.5"><label htmlFor="new-password" className="text-sm font-medium text-slate-300">New password</label><input id="new-password" required minLength={12} type="password" name="password" autoComplete="new-password" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50" /></div><div className="space-y-1.5"><label htmlFor="confirm-password" className="text-sm font-medium text-slate-300">Confirm new password</label><input id="confirm-password" required minLength={12} type="password" name="confirmPassword" autoComplete="new-password" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50" /></div>{error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}<button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{loading ? 'Updating…' : 'Update password'}</button></form>}</div></main>;
}
