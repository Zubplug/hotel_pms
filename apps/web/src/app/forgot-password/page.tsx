'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Hotel } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: form.get('email') }) });
    setLoading(false);
    setSent(true);
  }

  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"><div className="mb-8 text-center"><div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600"><Hotel className="h-7 w-7 text-white" /></div><h1 className="text-2xl font-bold text-white">Reset your password</h1><p className="mt-2 text-sm text-slate-400">LodgeCore PMS</p></div>{sent ? <><p className="text-sm leading-6 text-slate-300">If an account exists for that email, we’ve sent a secure reset link. Check your inbox and spam folder.</p><Link href="/login" className="mt-6 flex w-full justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">Back to sign in</Link></> : <><p className="mb-6 text-sm leading-6 text-slate-400">Enter your account or staff email. We’ll send a link to update your password.</p><form onSubmit={submit} className="space-y-5"><div className="space-y-1.5"><label htmlFor="reset-email" className="text-sm font-medium text-slate-300">Email address</label><input id="reset-email" required type="email" name="email" autoComplete="email" placeholder="you@yourproperty.com" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50" /></div><button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{loading ? 'Sending…' : 'Send reset link'}</button></form><Link href="/login" className="mt-6 block text-center text-xs text-slate-400 hover:text-white">← Back to sign in</Link></>}</div></main>;
}
