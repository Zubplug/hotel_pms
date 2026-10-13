'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmployeePortalFeedbackDialog, type EmployeePortalFeedback } from '@/components/hr/EmployeePortalFeedbackDialog';

const categories = [
  { key: 'CRITICAL', label: 'Critical alerts', description: 'Security and important payroll events', icon: ShieldCheck },
  { key: 'APPROVALS', label: 'Approvals', description: 'Leave, profile and HR request updates', icon: Check },
  { key: 'OPERATIONS', label: 'Workplace updates', description: 'Shifts, attendance and announcements', icon: Bell },
  { key: 'REPORTS', label: 'Reports and documents', description: 'Payslips and document reminders', icon: Mail },
];

type Preference = { email: boolean; inApp: boolean };

export default function EmployeeSecurityPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, Preference>>({});
  const [preferenceSaving, setPreferenceSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<EmployeePortalFeedback | null>(null);

  useEffect(() => {
    fetch('/api/hr/self-service/notification-preferences').then(async (response) => {
      if (!response.ok) throw new Error('Unable to load preferences');
      const json = await response.json();
      setPreferences(Object.fromEntries(json.preferences.map((item: any) => [item.category, { email: item.email, inApp: item.inApp }])));
    }).catch(() => setFeedback({ type: 'error', title: 'Preferences unavailable', message: 'We could not load your notification preferences. Please refresh and try again.' }));
  }, []);

  const passwordScore = useMemo(() => {
    const password = form.newPassword;
    return [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  }, [form.newPassword]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setFeedback({ type: 'error', title: 'Passwords do not match', message: 'Confirm your new password before saving the change.' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/hr/self-service/security', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to change password');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setFeedback({ type: 'success', title: 'Password updated', message: json.message || 'Your password was changed successfully. You may need to sign in again on other devices.' });
    } catch (error: any) {
      setFeedback({ type: 'error', title: 'Password was not changed', message: error.message || 'Please verify your current password and try again.' });
    } finally { setSaving(false); }
  }

  async function updatePreference(category: string, key: keyof Preference, value: boolean) {
    const next = { ...(preferences[category] || { email: true, inApp: true }), [key]: value };
    setPreferences((current) => ({ ...current, [category]: next }));
    setPreferenceSaving(category);
    try {
      const response = await fetch('/api/hr/self-service/notification-preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, ...next }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to save preference');
      setFeedback({ type: 'success', title: 'Preference saved', message: `${category.toLowerCase()} notifications have been updated.` });
    } catch (error: any) {
      setFeedback({ type: 'error', title: 'Preference not saved', message: error.message || 'Please try again.' });
    } finally { setPreferenceSaving(null); }
  }

  const PasswordToggle = ({ visible, onClick }: { visible: boolean; onClick: () => void }) => <button type="button" onClick={onClick} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>;

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">
      <header className="relative overflow-hidden rounded-3xl border border-teal-400/15 bg-gradient-to-br from-[#0c2530] via-[#0b1726] to-[#09121e] p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-300 ring-1 ring-teal-300/20"><ShieldCheck className="h-7 w-7" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">Personal security</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Account security</h1><p className="mt-1 max-w-xl text-sm text-slate-400">Keep your employee portal account protected and control how workplace updates reach you.</p></div></div><div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Account protected</div></div>
      </header>

      <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-800 bg-[#0b1624] p-5"><div className="flex items-center justify-between"><KeyRound className="h-5 w-5 text-teal-300" /><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Active</span></div><h2 className="mt-4 text-sm font-bold text-white">Password protection</h2><p className="mt-1 text-xs leading-5 text-slate-500">Use a unique password and update it regularly.</p></div><div className="rounded-2xl border border-slate-800 bg-[#0b1624] p-5"><div className="flex items-center justify-between"><Smartphone className="h-5 w-5 text-violet-300" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Managed</span></div><h2 className="mt-4 text-sm font-bold text-white">Session security</h2><p className="mt-1 text-xs leading-5 text-slate-500">Password changes invalidate older sessions.</p></div><div className="rounded-2xl border border-slate-800 bg-[#0b1624] p-5"><div className="flex items-center justify-between"><Bell className="h-5 w-5 text-amber-300" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Configurable</span></div><h2 className="mt-4 text-sm font-bold text-white">Notifications</h2><p className="mt-1 text-xs leading-5 text-slate-500">Choose which workplace updates you receive.</p></div></section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-[#0b1624] p-5 shadow-xl shadow-black/10 sm:p-6"><div className="mb-6 flex items-start gap-3"><div className="rounded-xl bg-teal-400/10 p-2.5 text-teal-300"><LockKeyhole className="h-5 w-5" /></div><div><h2 className="text-base font-bold text-white">Change password</h2><p className="mt-1 text-xs text-slate-500">Re-authentication is required before this security change.</p></div></div><div className="space-y-4"><label className="block text-xs font-medium text-slate-300">Current password<div className="relative mt-2"><Input required type={showCurrent ? 'text' : 'password'} value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} className="h-10 border-slate-700 bg-slate-950 pr-10 text-slate-100" /><PasswordToggle visible={showCurrent} onClick={() => setShowCurrent(!showCurrent)} /></div></label><label className="block text-xs font-medium text-slate-300">New password<div className="relative mt-2"><Input required minLength={8} type={showNew ? 'text' : 'password'} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className="h-10 border-slate-700 bg-slate-950 pr-10 text-slate-100" /><PasswordToggle visible={showNew} onClick={() => setShowNew(!showNew)} /></div></label><div className="space-y-2"><div className="flex gap-1">{[0, 1, 2, 3].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${passwordScore > item ? (passwordScore < 3 ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-800'}`} />)}</div><p className="text-[10px] text-slate-500">Use 8+ characters with uppercase, numbers, and symbols.</p></div><label className="block text-xs font-medium text-slate-300">Confirm new password<div className="relative mt-2"><Input required minLength={8} type={showConfirm ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="h-10 border-slate-700 bg-slate-950 pr-10 text-slate-100" /><PasswordToggle visible={showConfirm} onClick={() => setShowConfirm(!showConfirm)} /></div></label></div><Button disabled={saving} className="mt-6 h-10 w-full bg-teal-600 text-xs text-white shadow-lg shadow-teal-950/30 hover:bg-teal-500">{saving ? 'Updating password…' : 'Update password'}</Button></form>

        <div className="rounded-2xl border border-slate-800 bg-[#0b1624] p-5 shadow-xl shadow-black/10 sm:p-6"><div className="mb-6 flex items-start gap-3"><div className="rounded-xl bg-violet-400/10 p-2.5 text-violet-300"><Sparkles className="h-5 w-5" /></div><div><h2 className="text-base font-bold text-white">Notification preferences</h2><p className="mt-1 text-xs text-slate-500">Critical security notices remain protected.</p></div></div><div className="space-y-2">{categories.map(({ key, label, description, icon: Icon }) => { const preference = preferences[key] || { email: true, inApp: true }; return <div key={key} className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-slate-800 p-2 text-slate-300"><Icon className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-200">{label}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{description}</p></div>{preferenceSaving === key && <span className="text-[10px] text-teal-300">Saving…</span>}</div><div className="mt-3 flex gap-2 pl-10"><label className="flex flex-1 cursor-pointer items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-[10px] text-slate-400 hover:border-slate-700"><span className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${preference.inApp ? 'bg-teal-400' : 'bg-slate-700'}`} />In-app</span><input type="checkbox" checked={preference.inApp} onChange={(event) => updatePreference(key, 'inApp', event.target.checked)} className="accent-teal-500" /></label><label className="flex flex-1 cursor-pointer items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-[10px] text-slate-400 hover:border-slate-700"><span className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${preference.email ? 'bg-teal-400' : 'bg-slate-700'}`} />Email</span><input type="checkbox" checked={preference.email} onChange={(event) => updatePreference(key, 'email', event.target.checked)} className="accent-teal-500" /></label></div></div>; })}</div></div>
      </section>
      <EmployeePortalFeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
    </main>
  );
}
