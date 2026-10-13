'use client';

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EmployeeSecurityPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, { email: boolean; inApp: boolean }>>({});
  const [preferenceMessage, setPreferenceMessage] = useState('');

  React.useEffect(() => {
    fetch('/api/hr/self-service/notification-preferences').then((response) => response.ok ? response.json() : null).then((json) => {
      if (json?.preferences) setPreferences(Object.fromEntries(json.preferences.map((item: any) => [item.category, { email: item.email, inApp: item.inApp }])));
    }).catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/hr/self-service/security', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to change password');
      setMessage(json.message || 'Password changed successfully'); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (cause: any) { setError(cause.message); } finally { setSaving(false); }
  }

  async function updatePreference(category: string, key: 'email' | 'inApp', value: boolean) {
    const next = { ...preferences, [category]: { ...(preferences[category] || { email: true, inApp: true }), [key]: value } };
    setPreferences(next);
    const response = await fetch('/api/hr/self-service/notification-preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, ...next[category] }) });
    if (response.ok) setPreferenceMessage('Notification preferences saved');
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <div><div className="mb-2 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300"><ShieldCheck className="h-5 w-5" /></div><div><h1 className="text-xl font-bold text-white">Account security</h1><p className="text-xs text-slate-400">Protect your employee portal account.</p></div></div></div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-[#090e17] p-5">
        <div><label className="mb-1 block text-xs text-slate-400">Current password</label><Input required type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} className="border-slate-800 bg-slate-950 text-slate-100" /></div>
        <div><label className="mb-1 block text-xs text-slate-400">New password</label><Input required minLength={8} type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className="border-slate-800 bg-slate-950 text-slate-100" /><p className="mt-1 text-[10px] text-slate-500">Use at least 8 characters.</p></div>
        <div><label className="mb-1 block text-xs text-slate-400">Confirm new password</label><Input required minLength={8} type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="border-slate-800 bg-slate-950 text-slate-100" /></div>
        {error && <p className="text-xs text-rose-400">{error}</p>}{message && <p className="text-xs text-emerald-400">{message}</p>}
        <Button disabled={saving} className="bg-teal-600 text-xs hover:bg-teal-500">{saving ? 'Saving…' : 'Change password'}</Button>
      </form>
      <section className="rounded-2xl border border-slate-800 bg-[#090e17] p-5">
        <h2 className="text-sm font-bold text-white">Notification preferences</h2>
        <p className="mt-1 text-xs text-slate-500">Control routine alerts. Critical security and payroll notices may still be delivered.</p>
        <div className="mt-4 divide-y divide-slate-800">
          {['CRITICAL', 'APPROVALS', 'OPERATIONS', 'REPORTS'].map((category) => {
            const preference = preferences[category] || { email: true, inApp: true };
            return <div key={category} className="flex items-center justify-between gap-4 py-3"><span className="text-xs font-semibold text-slate-200">{category.toLowerCase()}</span><div className="flex gap-4 text-xs text-slate-400"><label className="flex items-center gap-2"><input type="checkbox" checked={preference.inApp} onChange={(event) => updatePreference(category, 'inApp', event.target.checked)} />In-app</label><label className="flex items-center gap-2"><input type="checkbox" checked={preference.email} onChange={(event) => updatePreference(category, 'email', event.target.checked)} />Email</label></div></div>;
          })}
        </div>
        {preferenceMessage && <p className="mt-3 text-xs text-emerald-400">{preferenceMessage}</p>}
      </section>
    </main>
  );
}
